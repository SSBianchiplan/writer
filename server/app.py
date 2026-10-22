"""GPlanSiS|Writer — servidor (FastAPI + PostgreSQL).

Papel do servidor:
  * autenticação por sessão (cookie HttpOnly), bloqueio por tentativas, troca obrigatória
    da senha temporária;
  * usuários com papel (ADMIN, EDITOR, REVISOR, LEITOR) e permissões individuais;
  * perfil com avatar e preferências por usuário;
  * documentos guardados no servidor, com versão (controle otimista: PUT com a versão-base,
    409 se outra gravação chegou antes), histórico, lixeira, compartilhamento e trava de edição;
  * notas privadas e pastas de cada usuário;
  * proxy do Assistente IA (a chave da Anthropic fica só no servidor);
  * registro de acessos e alterações (auditoria).

Invariantes no servidor: quem não tem a permissão não grava; só ADMIN gerencia usuários;
o administrador master não pode ser rebaixado, desativado nem perder o acesso;
sempre resta ao menos um ADMIN ativo.
"""
from __future__ import annotations

import asyncio
import base64
import binascii
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

import anthropic
import httpx
from cryptography.fernet import Fernet, InvalidToken
from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse, StreamingResponse
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool
from pydantic import BaseModel, Field

DSN = os.environ.get("WRITER_DSN", "postgresql:///writer")
MASTER = os.environ.get("WRITER_MASTER", "").strip().lower()
IA_KEY_ENV = os.environ.get("ANTHROPIC_API_KEY", "").strip()
IA_MODELO_PADRAO = os.environ.get("WRITER_IA_MODELO", "claude-opus-5-5")
SEGREDO = os.environ.get("WRITER_SEGREDO", "").strip()
SESSAO_H = int(os.environ.get("WRITER_SESSAO_HORAS", "12"))
COOKIE = "writer_s"
COOKIE_SEGURO = os.environ.get("WRITER_COOKIE_SEGURO", "1") != "0"
VERSOES_MAX = 40
VERSAO_INTERVALO_MIN = 10
DOC_MAX = 25 * 1024 * 1024
NOTA_MAX = 8 * 1024 * 1024
TRAVA_S = 60
ID_RE = re.compile(r"^[A-Za-z0-9_-]{4,64}$")

# Permissões (código → rótulo). A interface lê esta lista do servidor.
PERMS = {
    "criar": "Criar documentos",
    "editar": "Editar documentos (próprios e compartilhados com edição)",
    "notas": "Usar o módulo Notas",
    "excluir": "Excluir documentos (lixeira)",
    "compartilhar": "Compartilhar documentos",
    "importar": "Abrir e importar arquivos (.docx, .odt, .rtf, backup…)",
    "exportar": "Exportar, imprimir/PDF e fazer backup",
    "ia": "Usar o Assistente IA",
    "enviar_docs": "Enviar documentos ao GPlanSiS|Docs",
    "auditoria": "Ver o registro de acessos",
    "usuarios": "Gerenciar usuários e permissões",
}
PADRAO = {
    "ADMIN": list(PERMS),
    "EDITOR": ["criar", "editar", "notas", "excluir", "compartilhar", "importar", "exportar", "ia", "enviar_docs"],
    "REVISOR": ["editar", "notas", "exportar", "ia"],
    "LEITOR": [],
}
PAPEIS = list(PADRAO)
PAPEL_ROTULO = {"ADMIN": "Administrador", "EDITOR": "Editor", "REVISOR": "Revisor", "LEITOR": "Leitor"}

pool: ConnectionPool | None = None


# ---------------------------------------------------------------- senhas
def hash_senha(s: str) -> str:
    salt = secrets.token_bytes(16)
    h = hashlib.scrypt(s.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return "scrypt$16384$8$1$%s$%s" % (base64.b64encode(salt).decode(), base64.b64encode(h).decode())


def confere_senha(s: str, guardado: str) -> bool:
    try:
        _, n, r, p, salt, h = guardado.split("$")
        calc = hashlib.scrypt(s.encode(), salt=base64.b64decode(salt), n=int(n), r=int(r), p=int(p), dklen=32)
        return hmac.compare_digest(calc, base64.b64decode(h))
    except Exception:
        return False


def senha_temporaria() -> str:
    alfa = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "-".join("".join(secrets.choice(alfa) for _ in range(4)) for _ in range(3))


def valida_senha_nova(s: str) -> None:
    if len(s) < 10:
        raise HTTPException(422, "A senha precisa ter ao menos 10 caracteres")
    if s.lower() == s or s.upper() == s or not any(c.isdigit() for c in s):
        raise HTTPException(422, "Use letras maiúsculas, minúsculas e ao menos um número")


def th(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ---------------------------------------------------------------- banco
def db():
    return pool.connection()


def ip_de(req: Request) -> str:
    return (req.headers.get("x-forwarded-for", "").split(",")[0].strip() or (req.client.host if req.client else ""))


def registra(cur, evento: str, req: Request | None, usuario: dict | None = None, login: str | None = None, detalhe: str = ""):
    cur.execute(
        "insert into writer.acessos(usuario_id, login, evento, ip, ua, detalhe) values (%s,%s,%s,%s,%s,%s)",
        (usuario and usuario["id"], login or (usuario and usuario["login"]), evento,
         ip_de(req) if req else None, (req.headers.get("user-agent", "")[:300] if req else None), detalhe[:500]),
    )


def perms_efetivas(u: dict) -> list[str]:
    base = u["permissoes"] if u.get("permissoes") is not None else PADRAO[u["papel"]]
    out = [p for p in PERMS if p in base]
    if u["papel"] != "ADMIN" and "usuarios" in out:
        out.remove("usuarios")
    return out


def tem(u: dict, perm: str) -> bool:
    return perm in perms_efetivas(u)


def publico(u: dict) -> dict:
    return {
        "id": u["id"], "login": u["login"], "nome": u["nome"], "cargo": u.get("cargo"), "papel": u["papel"],
        "permissoes": u.get("permissoes"), "permissoesEfetivas": perms_efetivas(u), "ativo": u["ativo"],
        "master": u["master"], "trocarSenha": u["trocar_senha"], "avatarVer": u.get("avatar_ver") or 0,
        "temAvatar": u.get("avatar_tipo") is not None,
        "ultimoLogin": u["ultimo_login"].isoformat() if u.get("ultimo_login") else None,
        "criadoEm": u["criado_em"].isoformat() if u.get("criado_em") else None,
        "bloqueadoAte": u["bloqueado_ate"].isoformat() if u.get("bloqueado_ate") else None,
        "falhas": u.get("falhas", 0),
    }


@asynccontextmanager
async def vida(app):
    global pool
    pool = ConnectionPool(DSN, min_size=1, max_size=8, kwargs={"row_factory": dict_row, "autocommit": False}, open=True)
    with db() as c:
        # com vários workers, só um prepara o banco por vez (DDL simultâneo dá deadlock); a trava some no commit
        c.execute("select pg_advisory_xact_lock(hashtext('writer:inicio'))")
        c.execute((Path(__file__).parent / "schema.sql").read_text())
        if MASTER:
            c.execute("update writer.usuarios set master = (lower(login) = %s), papel = case when lower(login) = %s then 'ADMIN' else papel end,"
                      " ativo = case when lower(login) = %s then true else ativo end", (MASTER, MASTER, MASTER))
        c.execute("delete from writer.sessoes where expira_em < now()")
        c.execute("delete from writer.documentos where excluido_em < now() - interval '30 days'")
    yield
    pool.close()


app = FastAPI(title="GPlanSiS|Writer", lifespan=vida, docs_url=None, redoc_url=None, openapi_url=None)


@app.middleware("http")
async def csrf(request: Request, call_next):
    # Mutação só com cabeçalho próprio: formulário de outro site não consegue enviá-lo.
    if request.method not in ("GET", "HEAD", "OPTIONS") and request.url.path.startswith("/api/") \
            and request.url.path != "/api/integracao/docs/evento":
        if request.headers.get("x-writer") != "1":
            return JSONResponse({"detail": "Requisição recusada (CSRF)"}, status_code=403)
    resp = await call_next(request)
    if request.url.path.startswith("/api/") and "cache-control" not in resp.headers:
        resp.headers["Cache-Control"] = "no-store"
    return resp


# ---------------------------------------------------------------- sessão
def usuario_atual(request: Request) -> dict:
    tok = request.cookies.get(COOKIE)
    if not tok:
        raise HTTPException(401, "Não autenticado")
    with db() as c:
        cur = c.cursor()
        cur.execute("""select u.*, s.expira_em from writer.sessoes s join writer.usuarios u on u.id = s.usuario_id
                       where s.token_hash = %s and s.expira_em > now()""", (th(tok),))
        u = cur.fetchone()
        if not u or not u["ativo"]:
            raise HTTPException(401, "Sessão expirada")
        if u["expira_em"] - datetime.now(timezone.utc) < timedelta(hours=SESSAO_H / 2):
            cur.execute("update writer.sessoes set expira_em = now() + make_interval(hours => %s), ultimo_uso = now() where token_hash = %s", (SESSAO_H, th(tok)))
        else:
            cur.execute("update writer.sessoes set ultimo_uso = now() where token_hash = %s and ultimo_uso < now() - interval '1 minute'", (th(tok),))
    u["_tok"] = th(tok)
    return u


def ativo_ok(u: dict = Depends(usuario_atual)) -> dict:
    """Usuário autenticado e já fora da senha temporária."""
    if u["trocar_senha"]:
        raise HTTPException(403, "Troque a senha temporária antes de continuar")
    return u


def exige(perm: str):
    def dep(u: dict = Depends(ativo_ok)) -> dict:
        if not tem(u, perm):
            raise HTTPException(403, f"Sem permissão: {PERMS[perm]}")
        return u
    return dep


exige_admin = exige("usuarios")

FALHAS_IP: dict[str, deque] = defaultdict(deque)


class Login(BaseModel):
    login: str = Field(max_length=160)
    senha: str = Field(max_length=200)


@app.get("/api/saude")
def saude():
    with db() as c:
        c.execute("select 1")
    return {"ok": True, "app": "writer", "ia": ia_cfg()["pronta"]}


@app.post("/api/auth/login")
def login(body: Login, request: Request, response: Response):
    ip = ip_de(request)
    q = FALHAS_IP[ip]
    agora = time.time()
    while q and q[0] < agora - 900:
        q.popleft()
    if len(q) >= 20:
        raise HTTPException(429, "Muitas tentativas deste endereço — aguarde 15 minutos")
    lg = body.login.strip().lower()
    with db() as c:
        cur = c.cursor()
        cur.execute("select * from writer.usuarios where lower(login) = %s", (lg,))
        u = cur.fetchone()
        if u and u["bloqueado_ate"] and u["bloqueado_ate"] > datetime.now(timezone.utc):
            registra(cur, "LOGIN_BLOQUEADO", request, u)
            c.commit()
            raise HTTPException(423, "Usuário bloqueado temporariamente por tentativas inválidas — aguarde 15 minutos ou peça desbloqueio ao administrador")
        if not u or not u["ativo"] or not confere_senha(body.senha, u["senha_hash"]):
            q.append(agora)
            if u:
                cur.execute("""update writer.usuarios set falhas = falhas + 1,
                               bloqueado_ate = case when falhas + 1 >= 5 then now() + interval '15 minutes' else bloqueado_ate end
                               where id = %s""", (u["id"],))
            registra(cur, "LOGIN_FALHA", request, u, login=lg)
            c.commit()
            time.sleep(0.4)
            raise HTTPException(401, "E-mail ou senha inválidos")
        tok = secrets.token_urlsafe(32)
        cur.execute("insert into writer.sessoes(token_hash, usuario_id, expira_em, ip, ua) values (%s,%s, now() + make_interval(hours => %s), %s, %s)",
                    (th(tok), u["id"], SESSAO_H, ip, request.headers.get("user-agent", "")[:300]))
        cur.execute("update writer.usuarios set falhas = 0, bloqueado_ate = null, ultimo_login = now() where id = %s returning *", (u["id"],))
        u = cur.fetchone()
        registra(cur, "LOGIN", request, u)
    response.set_cookie(COOKIE, tok, max_age=SESSAO_H * 3600 * 2, httponly=True, secure=COOKIE_SEGURO, samesite="strict", path="/")
    return me_payload(u)


def me_payload(u: dict) -> dict:
    return {**publico(u), "prefs": u.get("prefs") or {}, "ia": ia_cfg()["pronta"], "docs": bool(DOCS_SEG), "docsUrl": DOCS_URL, "perms": PERMS,
            "papeis": PADRAO, "papelRotulo": PAPEL_ROTULO}


@app.post("/api/auth/logout")
def logout(request: Request, response: Response):
    tok = request.cookies.get(COOKIE)
    if tok:
        with db() as c:
            cur = c.cursor()
            cur.execute("delete from writer.sessoes where token_hash = %s returning usuario_id", (th(tok),))
            r = cur.fetchone()
            if r:
                cur.execute("update writer.documentos set editando_id = null, editando_ate = null where editando_id = %s", (r["usuario_id"],))
                registra(cur, "LOGOUT", request, {"id": r["usuario_id"], "login": None})
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


@app.get("/api/auth/me")
def me(u: dict = Depends(usuario_atual)):
    return me_payload(u)


class TrocaSenha(BaseModel):
    atual: str = Field(max_length=200)
    nova: str = Field(max_length=200)


@app.post("/api/auth/senha")
def troca_senha(body: TrocaSenha, request: Request, u: dict = Depends(usuario_atual)):
    if not confere_senha(body.atual, u["senha_hash"]):
        raise HTTPException(422, "Senha atual incorreta")
    valida_senha_nova(body.nova)
    if body.nova == body.atual:
        raise HTTPException(422, "A nova senha deve ser diferente da atual")
    with db() as c:
        cur = c.cursor()
        cur.execute("update writer.usuarios set senha_hash = %s, trocar_senha = false, atualizado_em = now() where id = %s returning *",
                    (hash_senha(body.nova), u["id"]))
        u2 = cur.fetchone()
        cur.execute("delete from writer.sessoes where usuario_id = %s and token_hash <> %s", (u["id"], u["_tok"]))
        registra(cur, "SENHA_ALTERADA", request, u)
    return me_payload(u2)


@app.get("/api/auth/sessoes")
def minhas_sessoes(u: dict = Depends(usuario_atual)):
    with db() as c:
        cur = c.cursor()
        cur.execute("select token_hash, criado_em, ultimo_uso, ip, ua from writer.sessoes where usuario_id = %s and expira_em > now() order by ultimo_uso desc", (u["id"],))
        rows = cur.fetchall()
    return {"sessoes": [{"atual": r["token_hash"] == u["_tok"], "criadoEm": r["criado_em"].isoformat(), "ultimoUso": r["ultimo_uso"].isoformat(),
                         "ip": r["ip"], "ua": r["ua"]} for r in rows]}


@app.delete("/api/auth/sessoes")
def encerra_outras(request: Request, u: dict = Depends(usuario_atual)):
    with db() as c:
        cur = c.cursor()
        cur.execute("delete from writer.sessoes where usuario_id = %s and token_hash <> %s", (u["id"], u["_tok"]))
        n = cur.rowcount
        registra(cur, "SESSOES_ENCERRADAS", request, u, detalhe=str(n))
    return {"encerradas": n}


# ---------------------------------------------------------------- perfil e avatar
class PerfilPatch(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=120)
    cargo: str | None = Field(default=None, max_length=120)
    prefs: dict | None = None


@app.patch("/api/perfil")
def altera_perfil(body: PerfilPatch, request: Request, u: dict = Depends(usuario_atual)):
    if body.prefs is not None and len(json.dumps(body.prefs)) > 20_000:
        raise HTTPException(413, "Preferências grandes demais")
    with db() as c:
        cur = c.cursor()
        cur.execute("""update writer.usuarios set nome = coalesce(%s, nome), cargo = case when %s then %s else cargo end,
                       prefs = coalesce(%s, prefs), atualizado_em = now() where id = %s returning *""",
                    (body.nome and body.nome.strip(), body.cargo is not None, (body.cargo or "").strip() or None,
                     Jsonb(body.prefs) if body.prefs is not None else None, u["id"]))
        u2 = cur.fetchone()
        if body.nome or body.cargo is not None:
            registra(cur, "PERFIL_ALTERADO", request, u)
    return me_payload(u2)


class AvatarIn(BaseModel):
    dataUrl: str = Field(max_length=600_000)


def decodifica_avatar(data_url: str) -> tuple[bytes, str]:
    m = re.match(r"^data:(image/(?:webp|png|jpeg));base64,([A-Za-z0-9+/=]+)$", data_url)
    if not m:
        raise HTTPException(422, "Imagem inválida (use PNG, JPEG ou WebP)")
    try:
        raw = base64.b64decode(m.group(2), validate=True)
    except binascii.Error:
        raise HTTPException(422, "Imagem inválida")
    if len(raw) > 400_000:
        raise HTTPException(413, "Imagem grande demais (máx. 400 KB)")
    assinaturas = {"image/png": b"\x89PNG", "image/jpeg": b"\xff\xd8\xff"}
    tipo = m.group(1)
    if (tipo in assinaturas and not raw.startswith(assinaturas[tipo])) or (tipo == "image/webp" and raw[8:12] != b"WEBP"):
        raise HTTPException(422, "O conteúdo não corresponde ao tipo de imagem")
    return raw, tipo


def grava_avatar(uid: int, data_url: str | None) -> dict:
    raw, tipo = decodifica_avatar(data_url) if data_url else (None, None)
    with db() as c:
        cur = c.cursor()
        cur.execute("update writer.usuarios set avatar = %s, avatar_tipo = %s, avatar_ver = avatar_ver + 1, atualizado_em = now() where id = %s returning *",
                    (raw, tipo, uid))
        r = cur.fetchone()
        if not r:
            raise HTTPException(404, "Usuário não encontrado")
        return r


@app.put("/api/perfil/avatar")
def troca_avatar(body: AvatarIn, u: dict = Depends(usuario_atual)):
    return me_payload(grava_avatar(u["id"], body.dataUrl))


@app.delete("/api/perfil/avatar")
def remove_avatar(u: dict = Depends(usuario_atual)):
    return me_payload(grava_avatar(u["id"], None))


@app.get("/api/avatar/{uid}")
def avatar(uid: int, u: dict = Depends(usuario_atual)):
    with db() as c:
        cur = c.cursor()
        cur.execute("select avatar, avatar_tipo from writer.usuarios where id = %s", (uid,))
        r = cur.fetchone()
    if not r or not r["avatar"]:
        raise HTTPException(404, "Sem avatar")
    # a URL leva ?v=<versão>, então pode ficar em cache privado
    return Response(bytes(r["avatar"]), media_type=r["avatar_tipo"], headers={"Cache-Control": "private, max-age=31536000, immutable"})


@app.get("/api/diretorio")
def diretorio(u: dict = Depends(ativo_ok)):
    with db() as c:
        cur = c.cursor()
        cur.execute("select id, login, nome, cargo, papel, avatar_ver, avatar_tipo from writer.usuarios where ativo order by nome")
        rows = cur.fetchall()
    return {"usuarios": [{"id": r["id"], "login": r["login"], "nome": r["nome"], "cargo": r["cargo"], "papel": r["papel"],
                          "avatarVer": r["avatar_ver"], "temAvatar": r["avatar_tipo"] is not None} for r in rows]}


# ---------------------------------------------------------------- usuários (admin)
class UsuarioIn(BaseModel):
    login: str = Field(min_length=5, max_length=160)
    nome: str = Field(min_length=2, max_length=120)
    cargo: str | None = Field(default=None, max_length=120)
    papel: str
    permissoes: list[str] | None = None
    ativo: bool = True


class UsuarioPatch(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=120)
    cargo: str | None = Field(default=None, max_length=120)
    papel: str | None = None
    permissoes: list[str] | None = None
    usarPadrao: bool = False
    ativo: bool | None = None


def valida_papel_perms(papel: str | None, perms: list[str] | None):
    if papel is not None and papel not in PAPEIS:
        raise HTTPException(422, "Papel inválido")
    if perms is not None:
        ruins = [p for p in perms if p not in PERMS]
        if ruins:
            raise HTTPException(422, f"Permissões inválidas: {', '.join(ruins)}")


@app.get("/api/usuarios")
def lista_usuarios(u: dict = Depends(exige_admin)):
    with db() as c:
        cur = c.cursor()
        cur.execute("""select u.*, (select count(*) from writer.sessoes s where s.usuario_id = u.id and s.expira_em > now()) as sessoes,
                              (select count(*) from writer.documentos d where d.dono_id = u.id and d.excluido_em is null) as documentos,
                              (select count(*) from writer.notas n where n.dono_id = u.id) as notas,
                              coalesce((select sum(bytes) from writer.documentos d where d.dono_id = u.id), 0)
                                + coalesce((select sum(bytes) from writer.notas n where n.dono_id = u.id), 0) as bytes
                       from writer.usuarios u order by u.ativo desc, u.master desc, u.nome""")
        rows = cur.fetchall()
    return {"usuarios": [{**publico(r), "sessoes": r["sessoes"], "documentos": r["documentos"], "notas": r["notas"], "bytes": int(r["bytes"])} for r in rows]}


@app.post("/api/usuarios")
def cria_usuario(body: UsuarioIn, request: Request, adm: dict = Depends(exige_admin)):
    valida_papel_perms(body.papel, body.permissoes)
    lg = body.login.strip().lower()
    if not EMAIL_RE.match(lg):
        raise HTTPException(422, "Informe um e-mail válido como login")
    temp = senha_temporaria()
    with db() as c:
        cur = c.cursor()
        cur.execute("select 1 from writer.usuarios where lower(login) = %s", (lg,))
        if cur.fetchone():
            raise HTTPException(409, "Já existe um usuário com este e-mail")
        cur.execute("""insert into writer.usuarios(login, nome, cargo, papel, permissoes, ativo, master, senha_hash, trocar_senha, criado_por)
                       values (%s,%s,%s,%s,%s,%s,%s,%s,true,%s) returning *""",
                    (lg, body.nome.strip(), (body.cargo or "").strip() or None, body.papel, body.permissoes, body.ativo,
                     lg == MASTER, hash_senha(temp), adm["login"]))
        novo = cur.fetchone()
        registra(cur, "USUARIO_CRIADO", request, adm, detalhe=f"{lg} ({body.papel})")
    return {"usuario": publico(novo), "senhaTemporaria": temp}


@app.patch("/api/usuarios/{uid}")
def altera_usuario(uid: int, body: UsuarioPatch, request: Request, adm: dict = Depends(exige_admin)):
    valida_papel_perms(body.papel, body.permissoes)
    with db() as c:
        cur = c.cursor()
        cur.execute("select * from writer.usuarios where id = %s for update", (uid,))
        alvo = cur.fetchone()
        if not alvo:
            raise HTTPException(404, "Usuário não encontrado")
        if alvo["master"] and ((body.papel and body.papel != "ADMIN") or body.ativo is False
                               or (body.permissoes is not None and set(body.permissoes) != set(PERMS))):
            raise HTTPException(409, "O administrador master não pode ser rebaixado, desativado nem perder permissões")
        if uid == adm["id"] and ((body.papel and body.papel != "ADMIN") or body.ativo is False):
            raise HTTPException(409, "Você não pode rebaixar ou desativar a si mesmo")
        papel = body.papel or alvo["papel"]
        ativo = alvo["ativo"] if body.ativo is None else body.ativo
        perms = None if body.usarPadrao else (body.permissoes if body.permissoes is not None else alvo["permissoes"])
        if alvo["papel"] == "ADMIN" and alvo["ativo"] and (papel != "ADMIN" or not ativo):
            cur.execute("select count(*) n from writer.usuarios where papel = 'ADMIN' and ativo and id <> %s", (uid,))
            if cur.fetchone()["n"] == 0:
                raise HTTPException(409, "É preciso manter ao menos um administrador ativo")
        cur.execute("""update writer.usuarios set nome = %s, cargo = %s, papel = %s, permissoes = %s, ativo = %s, atualizado_em = now()
                       where id = %s returning *""",
                    (body.nome or alvo["nome"], alvo["cargo"] if body.cargo is None else (body.cargo.strip() or None),
                     papel, perms, ativo, uid))
        novo = cur.fetchone()
        if not ativo:
            cur.execute("delete from writer.sessoes where usuario_id = %s", (uid,))
        mud = [k for k in ("nome", "cargo", "papel", "permissoes", "ativo") if novo[k] != alvo[k]]
        registra(cur, "USUARIO_ALTERADO", request, adm, detalhe=f"{alvo['login']}: {', '.join(mud) or 'sem mudança'}")
    return {"usuario": publico(novo)}


@app.post("/api/usuarios/{uid}/senha")
def redefine_senha(uid: int, request: Request, adm: dict = Depends(exige_admin)):
    temp = senha_temporaria()
    with db() as c:
        cur = c.cursor()
        cur.execute("""update writer.usuarios set senha_hash = %s, trocar_senha = true, falhas = 0, bloqueado_ate = null, atualizado_em = now()
                       where id = %s returning *""", (hash_senha(temp), uid))
        alvo = cur.fetchone()
        if not alvo:
            raise HTTPException(404, "Usuário não encontrado")
        cur.execute("delete from writer.sessoes where usuario_id = %s", (uid,))
        registra(cur, "SENHA_REDEFINIDA", request, adm, detalhe=alvo["login"])
    return {"senhaTemporaria": temp}


@app.post("/api/usuarios/{uid}/desbloquear")
def desbloqueia(uid: int, request: Request, adm: dict = Depends(exige_admin)):
    with db() as c:
        cur = c.cursor()
        cur.execute("update writer.usuarios set falhas = 0, bloqueado_ate = null where id = %s returning login", (uid,))
        r = cur.fetchone()
        if not r:
            raise HTTPException(404, "Usuário não encontrado")
        registra(cur, "USUARIO_DESBLOQUEADO", request, adm, detalhe=r["login"])
    return {"ok": True}


@app.post("/api/usuarios/{uid}/sessoes/encerrar")
def encerra_sessoes(uid: int, request: Request, adm: dict = Depends(exige_admin)):
    with db() as c:
        cur = c.cursor()
        cur.execute("delete from writer.sessoes where usuario_id = %s and token_hash <> %s", (uid, adm["_tok"]))
        n = cur.rowcount
        registra(cur, "SESSOES_ENCERRADAS", request, adm, detalhe=f"usuário {uid}: {n}")
    return {"encerradas": n}


@app.put("/api/usuarios/{uid}/avatar")
def avatar_de_usuario(uid: int, body: AvatarIn, request: Request, adm: dict = Depends(exige_admin)):
    return {"usuario": publico(grava_avatar(uid, body.dataUrl))}


@app.get("/api/auditoria")
def auditoria(limite: int = 300, evento: str | None = None, u: dict = Depends(exige("auditoria"))):
    limite = max(1, min(limite, 2000))
    with db() as c:
        cur = c.cursor()
        if evento:
            cur.execute("select * from writer.acessos where evento = %s order by ts desc limit %s", (evento, limite))
        else:
            cur.execute("select * from writer.acessos order by ts desc limit %s", (limite,))
        rows = cur.fetchall()
    return {"eventos": [{"ts": r["ts"].isoformat(), "login": r["login"], "evento": r["evento"], "ip": r["ip"], "detalhe": r["detalhe"]} for r in rows]}


@app.get("/api/admin/documentos")
def todos_documentos(u: dict = Depends(exige_admin)):
    """Visão de governança: todos os documentos, sem o conteúdo."""
    with db() as c:
        cur = c.cursor()
        cur.execute("""select d.id, d.titulo, d.versao, d.bytes, d.palavras, d.equipe, d.atualizado_em, d.atualizado_por, d.excluido_em,
                              u.nome as dono_nome, u.login as dono_login,
                              (select count(*) from writer.documento_acesso a where a.documento_id = d.id) as convidados
                       from writer.documentos d join writer.usuarios u on u.id = d.dono_id
                       order by d.excluido_em nulls first, d.atualizado_em desc limit 2000""")
        rows = cur.fetchall()
    return {"documentos": [{"id": r["id"], "titulo": r["titulo"], "versao": r["versao"], "bytes": r["bytes"], "palavras": r["palavras"],
                            "equipe": r["equipe"], "convidados": r["convidados"], "dono": r["dono_nome"], "donoLogin": r["dono_login"],
                            "atualizadoEm": r["atualizado_em"].isoformat(), "atualizadoPor": r["atualizado_por"],
                            "excluidoEm": r["excluido_em"].isoformat() if r["excluido_em"] else None} for r in rows]}


# ---------------------------------------------------------------- documentos
NIVEL_ORDEM = {None: 0, "LER": 1, "EDITAR": 2, "DONO": 3}


def nivel_de(cur, u: dict, d: dict) -> str | None:
    if d["dono_id"] == u["id"] or u["papel"] == "ADMIN":
        return "DONO"
    cur.execute("select nivel from writer.documento_acesso where documento_id = %s and usuario_id = %s", (d["id"], u["id"]))
    r = cur.fetchone()
    return max((r and r["nivel"]), d["equipe"], key=lambda x: NIVEL_ORDEM[x])


def carrega(cur, did: str, u: dict, minimo: str = "LER", lixeira: bool = False, trava: bool = False) -> tuple[dict, str]:
    cur.execute("select * from writer.documentos where id = %s" + (" for update" if trava else ""), (did,))
    d = cur.fetchone()
    if not d or (d["excluido_em"] is not None) != lixeira:
        raise HTTPException(404, "Documento não encontrado")
    n = nivel_de(cur, u, d)
    if NIVEL_ORDEM[n] < NIVEL_ORDEM[minimo]:
        raise HTTPException(404 if n is None else 403, "Documento não encontrado" if n is None else "Você só tem acesso de leitura a este documento")
    return d, n


def dono_pub(r: dict | None) -> dict | None:
    if not r:
        return None
    return {"id": r["id"], "nome": r["nome"], "login": r.get("login"), "avatarVer": r.get("avatar_ver") or 0, "temAvatar": r.get("avatar_tipo") is not None}


def doc_saida(d: dict, nivel: str, dono: dict | None = None, convidados: int | None = None) -> dict:
    """O objeto do editor com os metadados do servidor em campos `_` (o editor ignora; o servidor descarta na volta)."""
    out = dict(d["dados"])
    out.update(id=d["id"], _v=d["versao"], _nivel=nivel, _equipe=d["equipe"], _por=d["atualizado_por"],
               _em=d["atualizado_em"].isoformat(), _dono=dono_pub(dono) if dono else {"id": d["dono_id"]})
    if convidados is not None:
        out["_conv"] = convidados
    return out


def cabecalho(d: dict, nivel: str, dono: dict | None = None, convidados: int | None = None) -> dict:
    return {"id": d["id"], "v": d["versao"], "nivel": nivel, "equipe": d["equipe"], "por": d["atualizado_por"],
            "em": d["atualizado_em"].isoformat(), "dono": dono_pub(dono) if dono else {"id": d["dono_id"]}, "conv": convidados}


def limpa_doc(doc: dict, did: str) -> tuple[dict, str, int]:
    """Descarta os campos `_` do cliente e confere o mínimo que o editor precisa."""
    if not isinstance(doc.get("html"), str):
        raise HTTPException(422, "Documento inválido (sem 'html')")
    limpo = {k: v for k, v in doc.items() if not k.startswith("_")}
    limpo["id"] = did
    titulo = str(limpo.get("title") or "Documento sem título").strip()[:200] or "Documento sem título"
    limpo["title"] = titulo
    corpo = json.dumps(limpo, ensure_ascii=False, separators=(",", ":"))
    if len(corpo.encode()) > DOC_MAX:
        raise HTTPException(413, f"Documento grande demais ({len(corpo.encode()) // 1048576} MB; máx. {DOC_MAX // 1048576} MB) — reduza ou remova imagens")
    return limpo, corpo, len(corpo.encode())


def palavras_de(doc: dict) -> int:
    try:
        return max(0, int(doc.get("words") or 0))
    except (TypeError, ValueError):
        return 0


SQL_VISIVEIS = """
  select d.id, d.versao, d.equipe, d.atualizado_em, d.atualizado_por, d.dono_id,
         case when d.dono_id = %(me)s then 'DONO'
              when a.nivel = 'EDITAR' or d.equipe = 'EDITAR' then 'EDITAR' else 'LER' end as nivel,
         (select count(*) from writer.documento_acesso x where x.documento_id = d.id) as convidados
  from writer.documentos d
  left join writer.documento_acesso a on a.documento_id = d.id and a.usuario_id = %(me)s
  where d.excluido_em is null and (d.dono_id = %(me)s or a.usuario_id is not null or d.equipe is not null)"""


def donos(cur, ids) -> dict:
    cur.execute("select id, nome, login, avatar_ver, avatar_tipo from writer.usuarios where id = any(%s)", (list(set(ids)),))
    return {r["id"]: r for r in cur.fetchall()}


@app.get("/api/sync")
def sync(u: dict = Depends(ativo_ok)):
    """Índice leve do que este usuário enxerga: documentos (id, versão, nível), notas (id, relógio) e pastas.
    O navegador compara com a cópia local e só pede o conteúdo do que mudou (POST /api/docs/lote, /api/notas/lote)."""
    with db() as c:
        cur = c.cursor()
        cur.execute(SQL_VISIVEIS, {"me": u["id"]})
        rows = cur.fetchall()
        dn = donos(cur, [r["dono_id"] for r in rows])
        cur.execute("select id, atualizado_ms from writer.notas where dono_id = %s", (u["id"],))
        notas = cur.fetchall()
        cur.execute("select pastas, pastas_ms from writer.usuarios where id = %s", (u["id"],))
        p = cur.fetchone()
        cur.execute("select count(*) n from writer.documentos where excluido_em is not null and dono_id = %s", (u["id"],))
        lix = cur.fetchone()["n"]
        cur.execute("""select documento_id, codigo, revisao_label, revisao_status,
                              (select count(*) from jsonb_array_elements(coalesce(estado->'comments', '[]'::jsonb)) x
                                where x->>'status' = 'ABERTO') as abertos
                       from writer.docs_vinculo where documento_id = any(%s)""", ([r["id"] for r in rows],))
        edms = {r["documento_id"]: {"codigo": r["codigo"], "rev": r["revisao_label"], "status": r["revisao_status"], "abertos": r["abertos"]}
                for r in cur.fetchall()}
    return {"docs": [cabecalho(r, r["nivel"], dn.get(r["dono_id"]), r["convidados"]) for r in rows],
            "notas": [{"id": r["id"], "ms": r["atualizado_ms"]} for r in notas],
            "pastas": {"lista": p["pastas"], "ms": p["pastas_ms"]}, "lixeira": lix, "edms": edms, "agora": datetime.now(timezone.utc).isoformat()}


class Ids(BaseModel):
    ids: list[str] = Field(max_length=2000)


@app.post("/api/docs/lote")
def docs_lote(body: Ids, u: dict = Depends(ativo_ok)):
    ids = [i for i in body.ids if ID_RE.match(i)][:2000]
    if not ids:
        return {"docs": []}
    with db() as c:
        cur = c.cursor()
        cur.execute(f"""select d.*, v.nivel, v.convidados from writer.documentos d join ({SQL_VISIVEIS}) v on v.id = d.id
                        where d.id = any(%(ids)s)""", {"me": u["id"], "ids": ids})
        rows = cur.fetchall()
        dn = donos(cur, [r["dono_id"] for r in rows])
    return {"docs": [doc_saida(r, r["nivel"], dn.get(r["dono_id"]), r["convidados"]) for r in rows]}


class DocPut(BaseModel):
    versaoBase: int = 0
    doc: dict
    forcar: bool = False


@app.put("/api/docs/{did}")
def salva_doc(did: str, body: DocPut, request: Request, u: dict = Depends(ativo_ok)):
    if not ID_RE.match(did):
        raise HTTPException(422, "Identificador inválido")
    limpo, corpo, nbytes = limpa_doc(body.doc, did)
    pal = palavras_de(limpo)
    with db() as c:
        cur = c.cursor()
        cur.execute("select * from writer.documentos where id = %s for update", (did,))
        d = cur.fetchone()
        if d is None:
            if not tem(u, "criar"):
                raise HTTPException(403, f"Sem permissão: {PERMS['criar']}")
            cur.execute("""insert into writer.documentos(id, dono_id, titulo, dados, bytes, palavras, atualizado_por)
                           values (%s,%s,%s,%s::jsonb,%s,%s,%s) returning *""",
                        (did, u["id"], limpo["title"], corpo, nbytes, pal, u["login"]))
            d = cur.fetchone()
            cur.execute("""insert into writer.documento_versoes(documento_id, versao, titulo, dados, bytes, palavras, salvo_por)
                           values (%s,1,%s,%s::jsonb,%s,%s,%s)""", (did, d["titulo"], corpo, nbytes, pal, u["login"]))
            registra(cur, "DOC_CRIADO", request, u, detalhe=f"{did} {d['titulo']}")
            return {"doc": cabecalho(d, "DONO", u, 0)}
        nv = nivel_de(cur, u, d)
        if d["excluido_em"] is not None or nv is None:
            # o id existe mas não é deste usuário (ex.: backup de outra conta): o navegador gera outro id e tenta de novo
            return JSONResponse({"detail": "id_em_uso"}, status_code=409)
        if NIVEL_ORDEM[nv] < NIVEL_ORDEM["EDITAR"]:
            raise HTTPException(403, "Você só tem acesso de leitura a este documento")
        if not tem(u, "editar"):
            raise HTTPException(403, f"Sem permissão: {PERMS['editar']}")
        if d["versao"] != body.versaoBase and not body.forcar:
            dn = donos(cur, [d["dono_id"]])
            return JSONResponse({"detail": "conflito", "versao": d["versao"], "atualizadoPor": d["atualizado_por"],
                                 "doc": doc_saida(d, nv, dn.get(d["dono_id"]))}, status_code=409)
        nova = d["versao"] + 1
        cur.execute("""update writer.documentos set titulo = %s, dados = %s::jsonb, versao = %s, bytes = %s, palavras = %s,
                       atualizado_em = now(), atualizado_por = %s where id = %s returning *""",
                    (limpo["title"], corpo, nova, nbytes, pal, u["login"], did))
        d2 = cur.fetchone()
        # retrato no histórico: a cada 10 min de edição ou quando outra pessoa grava
        cur.execute("select salvo_em, salvo_por from writer.documento_versoes where documento_id = %s order by versao desc limit 1", (did,))
        ult = cur.fetchone()
        if not ult or ult["salvo_por"] != u["login"] or ult["salvo_em"] < datetime.now(timezone.utc) - timedelta(minutes=VERSAO_INTERVALO_MIN):
            cur.execute("""insert into writer.documento_versoes(documento_id, versao, titulo, dados, bytes, palavras, salvo_por)
                           values (%s,%s,%s,%s::jsonb,%s,%s,%s) on conflict do nothing""", (did, nova, d2["titulo"], corpo, nbytes, pal, u["login"]))
            cur.execute("""delete from writer.documento_versoes where documento_id = %s and versao not in
                           (select versao from writer.documento_versoes where documento_id = %s order by versao desc limit %s)""", (did, did, VERSOES_MAX))
        if body.forcar:
            registra(cur, "DOC_SOBRESCRITO", request, u, detalhe=f"{did} v{nova}")
        cur.execute("select count(*) n from writer.documento_acesso where documento_id = %s", (did,))
        conv = cur.fetchone()["n"]
        dn = donos(cur, [d2["dono_id"]])
    return {"doc": cabecalho(d2, nv, dn.get(d2["dono_id"]), conv)}


def exige_dono(cur, did: str, u: dict, lixeira: bool = False) -> dict:
    d, nv = carrega(cur, did, u, "LER", lixeira)
    if nv != "DONO":
        raise HTTPException(403, "Só o dono do documento (ou um administrador) pode fazer isto")
    return d


@app.delete("/api/docs/{did}")
def exclui_doc(did: str, request: Request, u: dict = Depends(exige("excluir"))):
    with db() as c:
        cur = c.cursor()
        d = exige_dono(cur, did, u)
        cur.execute("update writer.documentos set excluido_em = now(), editando_id = null where id = %s", (did,))
        registra(cur, "DOC_NA_LIXEIRA", request, u, detalhe=f"{did} {d['titulo']}")
    return {"ok": True}


@app.get("/api/lixeira")
def lixeira(u: dict = Depends(ativo_ok)):
    with db() as c:
        cur = c.cursor()
        cur.execute("""select id, titulo, palavras, bytes, excluido_em, atualizado_em from writer.documentos
                       where excluido_em is not null and dono_id = %s order by excluido_em desc""", (u["id"],))
        rows = cur.fetchall()
    return {"docs": [{"id": r["id"], "titulo": r["titulo"], "palavras": r["palavras"], "bytes": r["bytes"],
                      "excluidoEm": r["excluido_em"].isoformat(), "atualizadoEm": r["atualizado_em"].isoformat()} for r in rows]}


@app.post("/api/docs/{did}/restaurar")
def restaura_doc(did: str, request: Request, u: dict = Depends(exige("excluir"))):
    with db() as c:
        cur = c.cursor()
        d = exige_dono(cur, did, u, lixeira=True)
        cur.execute("update writer.documentos set excluido_em = null where id = %s returning *", (did,))
        d = cur.fetchone()
        registra(cur, "DOC_RESTAURADO", request, u, detalhe=f"{did} {d['titulo']}")
        dn = donos(cur, [d["dono_id"]])
    return {"doc": doc_saida(d, "DONO", dn.get(d["dono_id"]))}


@app.delete("/api/docs/{did}/definitivo")
def exclui_definitivo(did: str, request: Request, u: dict = Depends(exige("excluir"))):
    with db() as c:
        cur = c.cursor()
        d = exige_dono(cur, did, u, lixeira=True)
        cur.execute("delete from writer.documentos where id = %s", (did,))
        registra(cur, "DOC_EXCLUIDO_DEFINITIVO", request, u, detalhe=f"{did} {d['titulo']}")
    return {"ok": True}


@app.get("/api/docs/{did}/versoes")
def versoes(did: str, u: dict = Depends(ativo_ok)):
    with db() as c:
        cur = c.cursor()
        carrega(cur, did, u)
        cur.execute("select versao, titulo, bytes, palavras, salvo_em, salvo_por from writer.documento_versoes where documento_id = %s order by versao desc", (did,))
        rows = cur.fetchall()
    return {"versoes": [{"versao": r["versao"], "titulo": r["titulo"], "bytes": r["bytes"], "palavras": r["palavras"],
                         "salvoEm": r["salvo_em"].isoformat(), "salvoPor": r["salvo_por"]} for r in rows]}


@app.get("/api/docs/{did}/versoes/{v}")
def versao(did: str, v: int, u: dict = Depends(ativo_ok)):
    with db() as c:
        cur = c.cursor()
        carrega(cur, did, u)
        cur.execute("select dados, titulo, salvo_em, salvo_por from writer.documento_versoes where documento_id = %s and versao = %s", (did, v))
        r = cur.fetchone()
    if not r:
        raise HTTPException(404, "Versão não encontrada")
    return {"dados": r["dados"], "titulo": r["titulo"], "versao": v, "salvoEm": r["salvo_em"].isoformat(), "salvoPor": r["salvo_por"]}


@app.get("/api/docs/{did}/compartilhamento")
def ve_compartilhamento(did: str, u: dict = Depends(ativo_ok)):
    with db() as c:
        cur = c.cursor()
        d = exige_dono(cur, did, u)
        cur.execute("""select a.usuario_id, a.nivel, u.nome, u.login, u.avatar_ver, u.avatar_tipo from writer.documento_acesso a
                       join writer.usuarios u on u.id = a.usuario_id where a.documento_id = %s order by u.nome""", (did,))
        rows = cur.fetchall()
    return {"equipe": d["equipe"], "donoId": d["dono_id"],
            "usuarios": [{"id": r["usuario_id"], "nivel": r["nivel"], "nome": r["nome"], "login": r["login"],
                          "avatarVer": r["avatar_ver"], "temAvatar": r["avatar_tipo"] is not None} for r in rows]}


class Acesso(BaseModel):
    id: int
    nivel: str


class Compartilha(BaseModel):
    equipe: str | None = None
    usuarios: list[Acesso] = []


@app.put("/api/docs/{did}/compartilhamento")
def compartilha(did: str, body: Compartilha, request: Request, u: dict = Depends(exige("compartilhar"))):
    if body.equipe not in (None, "LER", "EDITAR") or any(a.nivel not in ("LER", "EDITAR") for a in body.usuarios):
        raise HTTPException(422, "Nível inválido")
    with db() as c:
        cur = c.cursor()
        d = exige_dono(cur, did, u)
        cur.execute("update writer.documentos set equipe = %s where id = %s", (body.equipe, did))
        cur.execute("delete from writer.documento_acesso where documento_id = %s", (did,))
        for a in body.usuarios:
            if a.id == d["dono_id"]:
                continue
            cur.execute("insert into writer.documento_acesso(documento_id, usuario_id, nivel) values (%s,%s,%s) on conflict do nothing", (did, a.id, a.nivel))
        registra(cur, "DOC_COMPARTILHADO", request, u, detalhe=f"{did} equipe={body.equipe or '-'} convidados={len(body.usuarios)}")
    return {"ok": True}


class Editando(BaseModel):
    ativo: bool = True
    forcar: bool = False


@app.post("/api/docs/{did}/editando")
def editando(did: str, body: Editando, u: dict = Depends(ativo_ok)):
    """Trava de edição cooperativa: quem abre para editar renova a cada 25 s; os outros abrem em leitura,
    com a opção de assumir. Evita duas pessoas gravando por cima uma da outra no mesmo documento."""
    with db() as c:
        cur = c.cursor()
        try:
            d, nv = carrega(cur, did, u, trava=True)
        except HTTPException as e:
            if e.status_code == 404:
                return {"outro": None, "minha": False}   # documento ainda não chegou ao servidor
            raise
        agora = datetime.now(timezone.utc)
        outro = d["editando_id"] if d["editando_id"] and d["editando_id"] != u["id"] and d["editando_ate"] and d["editando_ate"] > agora else None
        if not body.ativo:
            if d["editando_id"] == u["id"]:
                cur.execute("update writer.documentos set editando_id = null, editando_ate = null where id = %s", (did,))
            return {"outro": None, "minha": False}
        if outro and not body.forcar:
            cur.execute("select id, nome, login, avatar_ver, avatar_tipo from writer.usuarios where id = %s", (outro,))
            return {"outro": dono_pub(cur.fetchone()), "minha": False, "v": d["versao"]}
        if NIVEL_ORDEM[nv] >= NIVEL_ORDEM["EDITAR"] and tem(u, "editar"):
            cur.execute("update writer.documentos set editando_id = %s, editando_ate = now() + make_interval(secs => %s) where id = %s",
                        (u["id"], TRAVA_S, did))
            return {"outro": None, "minha": True, "v": d["versao"]}
        return {"outro": None, "minha": False, "v": d["versao"]}


# ---------------------------------------------------------------- notas (privadas) e pastas
class NotaPut(BaseModel):
    nota: dict


@app.post("/api/notas/lote")
def notas_lote(body: Ids, u: dict = Depends(ativo_ok)):
    ids = [i for i in body.ids if ID_RE.match(i)][:5000]
    with db() as c:
        cur = c.cursor()
        cur.execute("select dados from writer.notas where dono_id = %s and id = any(%s)", (u["id"], ids))
        rows = cur.fetchall()
    return {"notas": [r["dados"] for r in rows]}


@app.put("/api/notas/{nid}")
def salva_nota(nid: str, body: NotaPut, u: dict = Depends(exige("notas"))):
    if not ID_RE.match(nid):
        raise HTTPException(422, "Identificador inválido")
    n = {k: v for k, v in body.nota.items() if not k.startswith("_")}
    n["id"] = nid
    corpo = json.dumps(n, ensure_ascii=False, separators=(",", ":"))
    if len(corpo.encode()) > NOTA_MAX:
        raise HTTPException(413, "Nota grande demais — reduza as imagens")
    try:
        ms = int(n.get("updatedAt") or 0)
    except (TypeError, ValueError):
        ms = 0
    with db() as c:
        cur = c.cursor()
        # a gravação mais recente (relógio do editor) vence; uma cópia antiga de outro aparelho não apaga a nova
        cur.execute("""insert into writer.notas(dono_id, id, dados, atualizado_ms, bytes) values (%s,%s,%s::jsonb,%s,%s)
                       on conflict (dono_id, id) do update set dados = excluded.dados, atualizado_ms = excluded.atualizado_ms,
                         bytes = excluded.bytes, atualizado_em = now()
                       where writer.notas.atualizado_ms <= excluded.atualizado_ms
                       returning atualizado_ms""", (u["id"], nid, corpo, ms, len(corpo.encode())))
        r = cur.fetchone()
    return {"ok": True, "aplicada": r is not None}


@app.delete("/api/notas/{nid}")
def exclui_nota(nid: str, u: dict = Depends(exige("notas"))):
    with db() as c:
        c.execute("delete from writer.notas where dono_id = %s and id = %s", (u["id"], nid))
    return {"ok": True}


class Pastas(BaseModel):
    lista: list[str] = Field(max_length=500)
    ms: int = 0


@app.put("/api/pastas")
def salva_pastas(body: Pastas, u: dict = Depends(exige("notas"))):
    lista = [str(p).strip()[:80] for p in body.lista if str(p).strip()]
    with db() as c:
        c.execute("update writer.usuarios set pastas = %s, pastas_ms = %s where id = %s and pastas_ms <= %s",
                  (Jsonb(list(dict.fromkeys(lista))), body.ms, u["id"], body.ms))
    return {"ok": True}


# ---------------------------------------------------------------- IA
MODELOS_IA = [
    ("claude-opus-5-5", "Claude Opus 5.5 — recomendado"),
    ("claude-sonnet-5-5", "Claude Sonnet 5.5 — mais rápido e econômico"),
    ("claude-haiku-5-5", "Claude Haiku 5.5 — o mais barato, para pedidos simples"),
    ("claude-fable-5-1", "Claude Fable 5.1 — o mais capaz, custo alto"),
]
# Modelos que aceitam o fallback de servidor no formato "default"
COM_FALLBACK = {"claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"}
_IA_CACHE: dict = {"t": 0.0, "v": None}


def fernet() -> Fernet | None:
    return Fernet(SEGREDO.encode()) if SEGREDO else None


def ia_cfg(forcar: bool = False) -> dict:
    """Configuração efetiva da IA: painel (cifrada no banco) tem prioridade sobre o .env.
    Cache curto por processo — com 2 workers, uma mudança vale em até 10 s nos dois."""
    if not forcar and _IA_CACHE["v"] and time.time() - _IA_CACHE["t"] < 10:
        return _IA_CACHE["v"]
    with db() as c:
        r = c.execute("select valor, atualizado_em, atualizado_por from writer.config where chave = 'ia'").fetchone()
    v = (r and r["valor"]) or {}
    chave, origem = None, None
    if v.get("chave_cifrada") and fernet():
        try:
            chave, origem = fernet().decrypt(v["chave_cifrada"].encode()).decode(), "painel"
        except InvalidToken:
            chave = None
    if not chave and IA_KEY_ENV:
        chave, origem = IA_KEY_ENV, "env"
    ativo = v.get("ativo", True)
    out = {"chave": chave, "origem": origem, "ativo": ativo, "modelo": v.get("modelo") or IA_MODELO_PADRAO,
           "pronta": bool(chave and ativo), "final": v.get("final") or (chave[-4:] if chave else None),
           "atualizadoEm": r["atualizado_em"].isoformat() if r else None, "atualizadoPor": r["atualizado_por"] if r else None}
    _IA_CACHE.update(t=time.time(), v=out)
    return out


def cliente_ia(chave: str) -> anthropic.AsyncAnthropic:
    return anthropic.AsyncAnthropic(api_key=chave, timeout=280.0, max_retries=1)


def erro_ia(e: Exception) -> HTTPException:
    if isinstance(e, anthropic.AuthenticationError):
        return HTTPException(502, "Chave da Anthropic recusada (inválida ou revogada)")
    if isinstance(e, anthropic.PermissionDeniedError):
        return HTTPException(502, "A chave não tem permissão para este modelo")
    if isinstance(e, anthropic.NotFoundError):
        return HTTPException(502, "Modelo não encontrado para esta chave — escolha outro em Configurações › Assistente IA")
    if isinstance(e, anthropic.RateLimitError):
        return HTTPException(429, "Limite de uso da Anthropic atingido — tente em instantes")
    if isinstance(e, anthropic.APIStatusError):
        return HTTPException(502, f"A Anthropic respondeu {e.status_code}: {str(e.message)[:200]}")
    if isinstance(e, anthropic.APIConnectionError):
        return HTTPException(502, "Sem conexão com a Anthropic a partir do servidor")
    return HTTPException(502, f"Falha na IA: {e}")


def sse(evento: str, dados: dict) -> str:
    return f"event: {evento}\ndata: {json.dumps(dados, ensure_ascii=False)}\n\n"


class IATexto(BaseModel):
    prompt: str = Field(min_length=2, max_length=200_000)
    acao: str = Field(default="", max_length=80)


@app.post("/api/ia/texto")
async def ia_texto(body: IATexto, request: Request, u: dict = Depends(exige("ia"))):
    """Assistente de escrita em streaming (SSE): 'txt' com cada trecho, 'pulso' quando a resposta demora,
    depois 'fim' ou 'erro'. A conexão nunca fica muda, então nem o proxy nem o navegador cortam pedidos longos."""
    cfg = ia_cfg()
    if not cfg["chave"]:
        raise HTTPException(503, "Assistente IA não configurado — um administrador cola a chave em Configurações › Assistente IA")
    if not cfg["ativo"]:
        raise HTTPException(503, "Assistente IA desligado pelo administrador")
    extra = {"betas": ["server-side-fallback-2026-07-01"], "fallbacks": "default"} if cfg["modelo"] in COM_FALLBACK else {}
    fila: asyncio.Queue = asyncio.Queue()

    async def corre():
        try:
            async with cliente_ia(cfg["chave"]).beta.messages.stream(
                model=cfg["modelo"], max_tokens=32000, messages=[{"role": "user", "content": body.prompt}], **extra,
            ) as st:
                async for ev in st:
                    if ev.type == "text":
                        await fila.put(("txt", ev.text))
                await fila.put(("fim", await st.get_final_message()))
        except Exception as e:  # noqa: BLE001 — devolvido ao cliente como evento de erro
            await fila.put(("erro", e))

    async def eventos():
        t0 = time.time()
        tarefa = asyncio.create_task(corre())
        try:
            while True:
                try:
                    tipo, v = await asyncio.wait_for(fila.get(), timeout=3)
                except asyncio.TimeoutError:
                    if await request.is_disconnected():
                        tarefa.cancel()
                        return
                    yield sse("pulso", {"s": int(time.time() - t0)})
                    continue
                if tipo == "txt":
                    yield sse("txt", {"t": v})
                    continue
                if tipo == "erro":
                    e = v if isinstance(v, HTTPException) else (erro_ia(v) if isinstance(v, anthropic.APIError) else HTTPException(502, f"Falha na IA: {v}"))
                    yield sse("erro", {"detail": e.detail})
                    return
                msg = v
                if msg.stop_reason == "refusal":
                    yield sse("erro", {"detail": "A IA recusou este pedido — reformule"})
                    return
                with db() as c:
                    registra(c.cursor(), "IA", request, u, detalhe=f"[{msg.model} · {int(time.time() - t0)} s] {body.acao[:80]}")
                yield sse("fim", {"modelo": msg.model, "truncado": msg.stop_reason == "max_tokens", "s": int(time.time() - t0)})
                return
        finally:
            if not tarefa.done():
                tarefa.cancel()

    return StreamingResponse(eventos(), media_type="text/event-stream", headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})


EDICAO_SISTEMA = """Você é o assistente de edição do GPlanSiS|Writer, um editor de documentos técnicos e corporativos.
Você recebe o documento aberto como blocos numerados ([[B1]], [[B2]]…), cada um seguido do HTML do bloco, e um pedido da pessoa.
Responda com operações sobre os blocos:
- "substituir": troca o bloco indicado pelo HTML novo (um ou mais blocos);
- "inserir_depois" / "inserir_antes": insere HTML novo junto ao bloco indicado (use bloco 0 com "inserir_depois" para o início do documento);
- "excluir": remove o bloco (html vazio).
Regras:
- Altere somente o que o pedido pede; não reescreva blocos que não precisam mudar.
- Se houver um ESCOPO, altere apenas os blocos do escopo (e insira só junto deles).
- HTML simples: p, h1, h2, h3, ul, ol, li, strong, em, u, s, a, blockquote, table, thead, tbody, tr, th, td, br. Sem estilos inline, sem scripts.
- Preserve exatamente marcadores como __IMG_0__ e elementos <sup class="fn" data-fn="…">; nunca altere blocos marcados como (sumário automático).
- Escreva no idioma do documento, salvo se o pedido disser outro. Não invente fatos, números, nomes nem datas; quando faltar um dado, escreva [dado a confirmar].
- "resumo": 1 a 3 frases em português dizendo o que foi feito. Se o pedido for só uma pergunta, responda no resumo e deixe "operacoes" vazio."""

EDICAO_ESQUEMA = {
    "type": "object", "additionalProperties": False, "required": ["resumo", "operacoes"],
    "properties": {
        "resumo": {"type": "string"},
        "operacoes": {"type": "array", "items": {
            "type": "object", "additionalProperties": False, "required": ["op", "bloco", "html"],
            "properties": {"op": {"type": "string", "enum": ["substituir", "inserir_depois", "inserir_antes", "excluir"]},
                           "bloco": {"type": "integer"}, "html": {"type": "string"}}}},
    },
}


class IAEdicao(BaseModel):
    pedido: str = Field(min_length=2, max_length=20_000)
    documento: str = Field(min_length=1, max_length=400_000)
    escopo: str = Field(default="", max_length=2_000)
    titulo: str = Field(default="", max_length=300)
    idioma: str = Field(default="pt-BR", max_length=10)


@app.post("/api/ia/editar")
async def ia_editar(body: IAEdicao, request: Request, u: dict = Depends(exige("ia"))):
    """Edição do documento aberto pela IA: devolve operações sobre blocos (JSON validado por esquema) em SSE —
    'pulso' enquanto pensa, depois 'final' com {resumo, operacoes} ou 'erro'. Quem aplica é o navegador,
    como alteração controlada e com desfazer: a IA propõe, a pessoa decide."""
    cfg = ia_cfg()
    if not cfg["chave"]:
        raise HTTPException(503, "Assistente IA não configurado — um administrador cola a chave em Configurações › Assistente IA")
    if not cfg["ativo"]:
        raise HTTPException(503, "Assistente IA desligado pelo administrador")
    conteudo = (f"Título do documento: {body.titulo}\nIdioma do documento: {body.idioma}\n"
                + (f"ESCOPO: {body.escopo}\n" if body.escopo else "")
                + f"\nDocumento:\n<<<\n{body.documento}\n>>>\n\nPedido: {body.pedido}")
    extra = {"betas": ["server-side-fallback-2026-07-01"], "fallbacks": "default"} if cfg["modelo"] in COM_FALLBACK else {}
    fila: asyncio.Queue = asyncio.Queue()

    async def corre():
        try:
            async with cliente_ia(cfg["chave"]).beta.messages.stream(
                model=cfg["modelo"], max_tokens=32000, system=EDICAO_SISTEMA, messages=[{"role": "user", "content": conteudo}],
                output_config={"format": {"type": "json_schema", "schema": EDICAO_ESQUEMA}}, **extra,
            ) as st:
                async for ev in st:
                    if ev.type == "text":
                        await fila.put(("txt", ev.text))
                await fila.put(("fim", await st.get_final_message()))
        except Exception as e:  # noqa: BLE001 — devolvido ao cliente como evento de erro
            await fila.put(("erro", e))

    async def eventos():
        t0, nchars = time.time(), 0
        tarefa = asyncio.create_task(corre())
        try:
            while True:
                try:
                    tipo, v = await asyncio.wait_for(fila.get(), timeout=3)
                except asyncio.TimeoutError:
                    if await request.is_disconnected():
                        tarefa.cancel()
                        return
                    yield sse("pulso", {"s": int(time.time() - t0), "chars": nchars})
                    continue
                if tipo == "txt":
                    nchars += len(v)
                    continue
                if tipo == "erro":
                    e = v if isinstance(v, HTTPException) else (erro_ia(v) if isinstance(v, anthropic.APIError) else HTTPException(502, f"Falha na IA: {v}"))
                    yield sse("erro", {"detail": e.detail})
                    return
                msg = v
                if msg.stop_reason == "refusal":
                    yield sse("erro", {"detail": "A IA recusou este pedido — reformule"})
                    return
                if msg.stop_reason == "max_tokens":
                    yield sse("erro", {"detail": "A resposta ficou grande demais — selecione um trecho menor ou divida o pedido"})
                    return
                try:
                    out = json.loads("".join(b.text for b in msg.content if b.type == "text"))
                except ValueError:
                    yield sse("erro", {"detail": "A IA não devolveu uma resposta válida — tente de novo"})
                    return
                out["_modelo"], out["_s"] = msg.model, int(time.time() - t0)
                with db() as c:
                    registra(c.cursor(), "IA", request, u, detalhe=f"[{msg.model} · editar · {out['_s']} s · {len(out.get('operacoes') or [])} op] {body.pedido.strip()[:200]}")
                yield sse("final", out)
                return
        finally:
            if not tarefa.done():
                tarefa.cancel()

    return StreamingResponse(eventos(), media_type="text/event-stream", headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})


def ia_publica(cfg: dict) -> dict:
    return {"configurada": bool(cfg["chave"]), "ativo": cfg["ativo"], "pronta": cfg["pronta"], "origem": cfg["origem"],
            "final": cfg["final"], "modelo": cfg["modelo"], "modelos": [{"id": m, "nome": n} for m, n in MODELOS_IA],
            "atualizadoEm": cfg["atualizadoEm"], "atualizadoPor": cfg["atualizadoPor"], "cifragem": bool(SEGREDO)}


@app.get("/api/admin/ia")
def ve_ia(u: dict = Depends(exige_admin)):
    return ia_publica(ia_cfg(forcar=True))


class IAConfig(BaseModel):
    chave: str | None = Field(default=None, max_length=300)   # None = manter a atual
    modelo: str = Field(min_length=3, max_length=80)
    ativo: bool = True


CHAVE_RE = re.compile(r"^sk-ant-[A-Za-z0-9_\-]{20,}$")


def grava_ia(valor: dict, u: dict, request: Request, evento: str, detalhe: str):
    with db() as c:
        cur = c.cursor()
        cur.execute("""insert into writer.config(chave, valor, atualizado_em, atualizado_por) values ('ia', %s, now(), %s)
                       on conflict (chave) do update set valor = excluded.valor, atualizado_em = now(), atualizado_por = excluded.atualizado_por""",
                    (Jsonb(valor), u["login"]))
        registra(cur, evento, request, u, detalhe=detalhe)
    return ia_publica(ia_cfg(forcar=True))


def valor_ia_atual() -> dict:
    with db() as c:
        r = c.execute("select valor from writer.config where chave = 'ia'").fetchone()
    return dict(r["valor"]) if r else {}


@app.put("/api/admin/ia")
def configura_ia(body: IAConfig, request: Request, u: dict = Depends(exige_admin)):
    if not re.match(r"^claude-[a-z0-9\-.]+$", body.modelo):
        raise HTTPException(422, "Modelo inválido")
    v = valor_ia_atual()
    v.update(modelo=body.modelo, ativo=body.ativo)
    det = f"modelo={body.modelo} ativo={body.ativo}"
    if body.chave:
        k = body.chave.strip()
        if not CHAVE_RE.match(k):
            raise HTTPException(422, "Isto não parece uma chave da Anthropic (começa com sk-ant-)")
        if not fernet():
            raise HTTPException(503, "O servidor está sem WRITER_SEGREDO no .env — não é possível guardar a chave cifrada")
        v.update(chave_cifrada=fernet().encrypt(k.encode()).decode(), final=k[-4:])
        det += f" chave=…{k[-4:]}"
    return grava_ia(v, u, request, "IA_CONFIGURADA", det)


@app.delete("/api/admin/ia/chave")
def remove_chave_ia(request: Request, u: dict = Depends(exige_admin)):
    v = valor_ia_atual()
    v.pop("chave_cifrada", None)
    v.pop("final", None)
    return grava_ia(v, u, request, "IA_CHAVE_REMOVIDA", "chave do painel removida")


class IATeste(BaseModel):
    chave: str | None = Field(default=None, max_length=300)
    modelo: str | None = Field(default=None, max_length=80)


@app.post("/api/admin/ia/testar")
async def testa_ia(body: IATeste, u: dict = Depends(exige_admin)):
    """Valida a chave (lista os modelos que ela enxerga) e faz uma chamada curta ao modelo escolhido."""
    cfg = ia_cfg(forcar=True)
    chave = (body.chave or "").strip() or cfg["chave"]
    if not chave:
        raise HTTPException(422, "Cole uma chave para testar")
    modelo = body.modelo or cfg["modelo"]
    cli_ = cliente_ia(chave)
    t0 = time.time()
    try:
        disponiveis = [m.id async for m in cli_.models.list() if m.id.startswith("claude-")]
    except anthropic.APIError as e:
        raise erro_ia(e)
    if modelo not in disponiveis:
        return {"ok": False, "erro": f"A chave é válida, mas não tem acesso a {modelo}", "modelos": disponiveis}
    try:
        msg = await cli_.with_options(timeout=60.0).messages.create(
            model=modelo, max_tokens=256, messages=[{"role": "user", "content": "Responda apenas: OK"}])
    except anthropic.APIError as e:
        raise erro_ia(e)
    txt = "".join(b.text for b in msg.content if b.type == "text").strip()
    return {"ok": True, "modelo": msg.model, "resposta": txt[:60], "ms": int((time.time() - t0) * 1000), "modelos": disponiveis}


# ---------------------------------------------------------------- integração com o GPlanSiS|Docs
# Segredo compartilhado (o mesmo valor no .env dos dois sistemas: WRITER_DOCS_SEGREDO aqui,
# INTEGRACAO_WRITER_SEGREDO no Docs). Dele saem três subchaves, como na integração do Drawings:
#   api     → o servidor do Writer chama o Docs "em nome de" um usuário (cabeçalhos x-integracao / x-em-nome-de);
#   sso     → links de entrada única nos dois sentidos (assinados, 2 min, uso único);
#   webhook → o Docs assina os eventos de revisão e comentário que manda para cá.
DOCS_SEG = os.environ.get("WRITER_DOCS_SEGREDO", "").strip()
DOCS_URL = os.environ.get("WRITER_DOCS_URL", "https://docs.gplansis.com").rstrip("/")
DOCS_API = os.environ.get("WRITER_DOCS_API", "http://127.0.0.1:8945/api").rstrip("/")
WRITER_URL = os.environ.get("WRITER_URL", "https://writer.gplansis.com").rstrip("/")
MARCA_DOCS = ".writer."          # o Docs troca só os arquivos com esta marca ao reenviar a revisão
TIPOS_TEXTO = ("RT", "MD", "ET", "PR", "MC", "LM", "LI", "FD", "CT", "DB")


def docs_chave(fin: str) -> bytes:
    if not DOCS_SEG:
        raise HTTPException(503, "Integração com o GPlanSiS|Docs não configurada no servidor")
    return hmac.new(DOCS_SEG.encode(), fin.encode(), hashlib.sha256).digest()


async def docs_req(metodo: str, caminho: str, email: str, bruto: bool = False, **kw):
    """Chamada ao Docs como o usuário `email`: as regras de papel do projeto no Docs valem para ele."""
    hdr = {"x-integracao": docs_chave("api").hex(), "x-em-nome-de": email}
    try:
        async with httpx.AsyncClient(base_url=DOCS_API, timeout=kw.pop("timeout", 90)) as cli:
            r = await cli.request(metodo, caminho, headers=hdr, **kw)
    except httpx.HTTPError as e:
        raise HTTPException(502, f"GPlanSiS|Docs indisponível ({type(e).__name__})")
    if r.status_code >= 400:
        try:
            d = r.json().get("detail")
            msg = d if isinstance(d, str) else "; ".join(x.get("msg", "") for x in d) if isinstance(d, list) else r.text[:200]
        except ValueError:
            msg = r.text[:200]
        raise HTTPException(r.status_code if r.status_code in (401, 403, 404, 409, 413, 422) else 502, f"Docs: {msg}")
    if bruto:
        return r.content
    return r.json() if r.content else None


def _b64u(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _unb64u(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def vinculo_publico(v: dict | None) -> dict | None:
    if not v:
        return None
    e = v.get("estado") or {}
    coms = e.get("comments") or []
    return {"docId": v["doc_id"], "codigo": v["codigo"], "titulo": v["titulo"],
            "projeto": {"id": v["projeto_id"], "codigo": v["projeto_codigo"], "nome": e.get("project_name")},
            "revisao": {"id": v["revisao_id"], "label": v["revisao_label"], "status": v["revisao_status"], "finalidade": v["finalidade"],
                        "retornoCliente": (e.get("revision") or {}).get("client_return_code")},
            "revisoes": e.get("revisions") or [], "comentarios": coms,
            "comentariosAbertos": sum(1 for c in coms if c.get("status") == "ABERTO"),
            "versaoEnviada": v.get("versao_enviada"),
            "enviadoEm": v["enviado_em"].isoformat() if v.get("enviado_em") else None, "enviadoPor": v.get("enviado_por"),
            "atualizadoEm": v["atualizado_em"].isoformat() if v.get("atualizado_em") else None,
            "url": f"{DOCS_URL}/documentos/{v['doc_id']}"}


def grava_estado(cur, documento_id: str, estado: dict, evento: int = 0):
    rev = estado.get("revision") or {}
    cur.execute("""update writer.docs_vinculo set estado = %s, codigo = %s, titulo = %s, projeto_codigo = %s,
                     revisao_id = %s, revisao_label = %s, revisao_status = %s, finalidade = %s,
                     ultimo_evento = greatest(ultimo_evento, %s), atualizado_em = now()
                   where documento_id = %s returning *""",
                (Jsonb(estado), estado.get("code"), estado.get("title"), estado.get("project_code"), rev.get("id"), rev.get("label"),
                 rev.get("status"), rev.get("purpose"), evento, documento_id))
    return cur.fetchone()


@app.get("/api/gpdocs/opcoes")
async def docs_opcoes(u: dict = Depends(exige("enviar_docs"))):
    """Projetos do Docs em que o usuário pode criar documentos, mais o catálogo (disciplinas, tipos de texto, fluxos)."""
    projetos = await docs_req("GET", "/projects", u["login"])
    cat = await docs_req("GET", "/catalog", u["login"])
    return {"projetos": [p for p in projetos if p.get("my_role") in ("ADMIN", "CONTROLADOR", "AUTOR")],
            "disciplinas": cat["disciplines"], "tipos": [t for t in cat["doc_types"] if t["code"] in TIPOS_TEXTO],
            "fluxos": cat["workflow_templates"], "disciplinasProjeto": cat["project_disciplines"]}


@app.get("/api/gpdocs/projetos/{pid}/membros")
async def docs_membros(pid: str, u: dict = Depends(exige("enviar_docs"))):
    return await docs_req("GET", f"/projects/{pid}/members", u["login"])


@app.get("/api/gpdocs/vinculo/{did}")
async def docs_vinculo(did: str, atualizar: bool = False, u: dict = Depends(ativo_ok)):
    with db() as c:
        cur = c.cursor()
        carrega(cur, did, u)
        cur.execute("select * from writer.docs_vinculo where documento_id = %s", (did,))
        v = cur.fetchone()
    if v and atualizar and DOCS_SEG:
        estado = await docs_req("GET", f"/integracao/documentos/{v['doc_id']}/estado", u["login"])
        with db() as c:
            v = grava_estado(c.cursor(), did, estado)
    return {"vinculo": vinculo_publico(v), "ativa": bool(DOCS_SEG)}


class PreparaDocs(BaseModel):
    projetoId: str | None = None
    disciplina: str | None = None
    tipo: str = "RT"
    titulo: str | None = Field(default=None, max_length=200)
    descricao: str | None = Field(default=None, max_length=500)


def _meta_docs(did: str, d: dict, u: dict, extra: dict | None = None) -> dict:
    return {"origem": "writer", "writer_doc_id": did, "writer_versao": str(d["versao"]), "writer_url": f"{WRITER_URL}/#w{did}",
            "palavras": str(d["palavras"]), "enviado_por": u["nome"], "enviado_em": datetime.now(timezone.utc).isoformat(), **(extra or {})}


def doc_para_envio(cur, did: str, u: dict) -> dict:
    d, _ = carrega(cur, did, u, "EDITAR")
    if not tem(u, "editar"):
        raise HTTPException(403, f"Sem permissão: {PERMS['editar']}")
    return d


@app.post("/api/gpdocs/preparar/{did}")
async def docs_preparar(did: str, body: PreparaDocs, request: Request, u: dict = Depends(exige("enviar_docs"))):
    """Passo 1 do envio: cria o documento no Docs (1º envio) ou garante uma revisão aberta (EM_ELABORACAO).
    Devolve código e revisão para o navegador imprimi-los no cabeçalho do PDF antes de enviar os arquivos."""
    with db() as c:
        cur = c.cursor()
        d = doc_para_envio(cur, did, u)
        cur.execute("select * from writer.docs_vinculo where documento_id = %s", (did,))
        v = cur.fetchone()
    email = u["login"]
    if not v:
        titulo = (body.titulo or d["titulo"]).strip()
        if not body.projetoId or not body.disciplina:
            raise HTTPException(422, "Escolha o projeto e a disciplina no Docs")
        if body.tipo not in TIPOS_TEXTO:
            raise HTTPException(422, "Tipo de documento inválido")
        if len(titulo) < 3:
            raise HTTPException(422, "O título precisa de ao menos 3 caracteres")
        novo = await docs_req("POST", "/documents", email, json={
            "project_id": body.projetoId, "title": titulo, "discipline_code": body.disciplina, "doc_type_code": body.tipo,
            "tags": ["writer"], "metadata": _meta_docs(did, d, u)})
        with db() as c:   # grava o vínculo já: se algo falhar depois, o reenvio usa o mesmo documento
            c.execute("""insert into writer.docs_vinculo(documento_id, doc_id, projeto_id, codigo, titulo, revisao_id, revisao_label,
                            revisao_status, enviado_em, enviado_por) values (%s,%s,%s,%s,%s,%s,%s,'EM_ELABORACAO', now(), %s)""",
                      (did, novo["id"], body.projetoId, novo["code"], titulo, novo["revision"]["id"], novo["revision"]["label"], email))
            registra(c.cursor(), "DOCS_DOCUMENTO_CRIADO", request, u, detalhe=f"{did} → {novo['code']}")
        return {"docId": novo["id"], "codigo": novo["code"], "revisaoId": novo["revision"]["id"],
                "revisaoLabel": novo["revision"]["label"], "acao": "criado"}
    estado = await docs_req("GET", f"/integracao/documentos/{v['doc_id']}/estado", email)
    rev = estado.get("revision") or {}
    if rev.get("status") == "EM_ELABORACAO":
        acao = "mesma_revisao"
    else:
        rev = await docs_req("POST", f"/documents/{v['doc_id']}/revisions", email, json={"description": body.descricao})
        acao = "nova_revisao"
    return {"docId": v["doc_id"], "codigo": estado.get("code") or v["codigo"], "revisaoId": rev["id"], "revisaoLabel": rev["label"], "acao": acao}


class EnviaDocs(BaseModel):
    revisaoId: str
    html: str = Field(max_length=60_000_000)           # HTML de impressão (com @page e código/revisão no cabeçalho) → PDF no Docs
    docx: str = Field(max_length=60_000_000)           # base64 do .docx gerado no navegador
    paginas: int | None = None
    fluxo: dict | None = None                          # {"template_id": "...", "assignees": {"1": "<uid>", ...}}


@app.post("/api/gpdocs/enviar/{did}")
async def docs_enviar(did: str, body: EnviaDocs, request: Request, u: dict = Depends(exige("enviar_docs"))):
    """Passo 2: substitui na revisão aberta os arquivos que o Writer mandou antes (PDF, Word, nativo)
    e, se pedido, inicia o fluxo de verificação do Docs."""
    try:
        docx = base64.b64decode(body.docx, validate=True)
    except binascii.Error:
        raise HTTPException(422, "Arquivo Word inválido")
    if not docx.startswith(b"PK"):
        raise HTTPException(422, "Arquivo Word inválido")
    with db() as c:
        cur = c.cursor()
        d = doc_para_envio(cur, did, u)
        cur.execute("select * from writer.docs_vinculo where documento_id = %s", (did,))
        v = cur.fetchone()
    if not v:
        raise HTTPException(409, "Prepare o envio primeiro")
    email, doc_id = u["login"], v["doc_id"]
    estado = await docs_req("GET", f"/integracao/documentos/{doc_id}/estado", email)
    rev = estado.get("revision") or {}
    if rev.get("id") != body.revisaoId or rev.get("status") != "EM_ELABORACAO":
        raise HTTPException(409, "A revisão mudou no Docs enquanto você enviava — tente de novo")
    pdf = await docs_req("POST", "/integracao/pdf", email, bruto=True, timeout=200,
                         files={"arquivo": ("documento.html", body.html.encode(), "text/html")})
    await docs_req("DELETE", f"/integracao/revisoes/{body.revisaoId}/arquivos-writer", email)
    await docs_req("PATCH", f"/documents/{doc_id}", email, json={"metadata": {**(estado.get("metadata") or {}),
                   **_meta_docs(did, d, u, {"paginas": str(body.paginas or "")})}})
    nativo = json.dumps(d["dados"], ensure_ascii=False, separators=(",", ":")).encode()
    base = re.sub(r"[^\w\-]+", "_", f"{estado.get('code') or v['codigo']}_rev{rev['label']}")
    for nome, conteudo, papel, mime in ((f"{base}{MARCA_DOCS}pdf", pdf, "PDF", "application/pdf"),
                                        (f"{base}{MARCA_DOCS}docx", docx, "NATIVO",
                                         "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
                                        (f"{base}{MARCA_DOCS}json", nativo, "ANEXO", "application/json")):
        await docs_req("POST", f"/revisions/{body.revisaoId}/files", email, files={"file": (nome, conteudo, mime)}, data={"role": papel}, timeout=180)
    if body.fluxo:
        await docs_req("POST", f"/revisions/{body.revisaoId}/workflow", email, json=body.fluxo)
    estado = await docs_req("GET", f"/integracao/documentos/{doc_id}/estado", email)
    with db() as c:
        cur = c.cursor()
        cur.execute("""update writer.docs_vinculo set versao_enviada = %s, enviado_em = now(), enviado_por = %s
                       where documento_id = %s""", (d["versao"], email, did))
        v = grava_estado(cur, did, estado)
        registra(cur, "DOCS_ENVIADO", request, u, detalhe=f"{did} → {v['codigo']} rev {rev['label']}{' + verificação' if body.fluxo else ''}")
    return {"vinculo": vinculo_publico(v)}


class SsoIda(BaseModel):
    para: str = Field(default="", max_length=300)


@app.post("/api/gpdocs/sso")
def docs_sso(body: SsoIda, u: dict = Depends(ativo_ok)):
    """Writer → Docs: link de entrada já autenticado no Docs."""
    corpo = _b64u(json.dumps({"email": u["login"], "exp": int(time.time()) + 120, "n": secrets.token_urlsafe(12),
                              "para": body.para, "de": "writer"}, separators=(",", ":")).encode())
    tok = corpo + "." + _b64u(hmac.new(docs_chave("sso"), corpo.encode(), hashlib.sha256).digest())
    return {"url": f"{DOCS_URL}/sso?token={tok}"}


class SsoVolta(BaseModel):
    token: str = Field(max_length=2000)


@app.post("/api/auth/sso")
def auth_sso(body: SsoVolta, request: Request, response: Response):
    """Docs → Writer: troca o código assinado pelo Docs por uma sessão daqui (mesmo e-mail)."""
    try:
        corpo, sig = body.token.split(".", 1)
        ok = hmac.compare_digest(_unb64u(sig), hmac.new(docs_chave("sso"), corpo.encode(), hashlib.sha256).digest())
        dados = json.loads(_unb64u(corpo)) if ok else None
    except (ValueError, TypeError, binascii.Error):
        dados = None
    if not dados or dados.get("de") != "docs":
        raise HTTPException(401, "Link de entrada inválido")
    if dados.get("exp", 0) < time.time():
        raise HTTPException(401, "Link de entrada expirado — clique de novo no botão do Docs")
    with db() as c:
        cur = c.cursor()
        cur.execute("delete from writer.sso_nonce where expira_em < now()")
        cur.execute("insert into writer.sso_nonce(nonce, expira_em) values (%s, now() + interval '5 minutes') on conflict do nothing returning nonce",
                    (dados["n"],))
        if not cur.fetchone():
            raise HTTPException(401, "Este link de entrada já foi usado")
        cur.execute("select * from writer.usuarios where lower(login) = %s", (str(dados["email"]).lower(),))
        u = cur.fetchone()
        if not u or not u["ativo"]:
            c.commit()
            raise HTTPException(403, f"{dados['email']} não tem conta ativa no GPlanSiS|Writer — peça acesso ao administrador")
        tok = secrets.token_urlsafe(32)
        cur.execute("insert into writer.sessoes(token_hash, usuario_id, expira_em, ip, ua) values (%s,%s, now() + make_interval(hours => %s), %s, %s)",
                    (th(tok), u["id"], SESSAO_H, ip_de(request), request.headers.get("user-agent", "")[:300]))
        cur.execute("update writer.usuarios set ultimo_login = now() where id = %s returning *", (u["id"],))
        u = cur.fetchone()
        registra(cur, "LOGIN_SSO", request, u, detalhe="pelo GPlanSiS|Docs")
    response.set_cookie(COOKIE, tok, max_age=SESSAO_H * 3600 * 2, httponly=True, secure=COOKIE_SEGURO, samesite="lax", path="/")
    return {**me_payload(u), "para": dados.get("para") or ""}


@app.post("/api/integracao/docs/evento")
async def docs_evento(request: Request):
    """Recebe do Docs (assinado com HMAC) o estado de um documento após mudança de revisão ou comentário."""
    corpo = await request.body()
    sig = request.headers.get("x-assinatura", "").removeprefix("sha256=")
    if not DOCS_SEG or not hmac.compare_digest(sig, hmac.new(docs_chave("webhook"), corpo, hashlib.sha256).hexdigest()):
        raise HTTPException(401, "Assinatura inválida")
    ev = json.loads(corpo)
    with db() as c:
        cur = c.cursor()
        cur.execute("select documento_id, ultimo_evento from writer.docs_vinculo where doc_id = %s for update", (ev["document_id"],))
        v = cur.fetchone()
        if v and int(ev["id"]) > v["ultimo_evento"]:   # fora de ordem ou repetido: ignora (o estado é completo)
            grava_estado(cur, v["documento_id"], ev["estado"], int(ev["id"]))
    return {"ok": True}


# ---------------------------------------------------------------- linha de comando
def cli():
    import argparse
    ap = argparse.ArgumentParser(prog="app.py")
    sp = ap.add_subparsers(dest="cmd", required=True)
    a = sp.add_parser("criar-admin", help="cria (ou redefine) um administrador e imprime a senha temporária")
    a.add_argument("login")
    a.add_argument("--nome", default="Administrador")
    a.add_argument("--se-nao-existir", action="store_true", help="não faz nada se o login já existir")
    args = ap.parse_args()
    lg = args.login.strip().lower()
    with ConnectionPool(DSN, min_size=1, max_size=1, kwargs={"row_factory": dict_row}) as p, p.connection() as c:
        c.execute((Path(__file__).parent / "schema.sql").read_text())
        existe = c.execute("select id from writer.usuarios where lower(login) = %s", (lg,)).fetchone()
        if existe and args.se_nao_existir:
            print(f"{lg} já existe — nada alterado")
            return
        temp = senha_temporaria()
        c.execute("""insert into writer.usuarios(login, nome, papel, master, senha_hash, trocar_senha, criado_por)
                     values (%s,%s,'ADMIN',%s,%s,true,'cli')
                     on conflict (lower(login)) do update set papel = 'ADMIN', ativo = true, senha_hash = excluded.senha_hash,
                       trocar_senha = true, falhas = 0, bloqueado_ate = null, master = excluded.master""",
                  (lg, args.nome, lg == MASTER, hash_senha(temp)))
        c.execute("insert into writer.acessos(login, evento, detalhe) values (%s, 'ADMIN_CLI', 'criado/redefinido pela linha de comando')", (lg,))
    print(f"login: {lg}\nsenha temporária: {temp}\n(troca obrigatória no primeiro acesso)")


if __name__ == "__main__":
    cli()
