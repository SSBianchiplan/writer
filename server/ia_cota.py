"""GPlanSiS|Writer — cota e limites do Assistente IA (modelo do GPlanSiS|Studio).

* Cada chamada à Anthropic vira uma linha em writer.ia_uso: aberta ANTES da chamada (ok = null,
  "em andamento") e fechada depois com os tokens REAIS da resposta (msg.usage) e o custo em US$.
  Falhas também são gravadas (custo dos tokens que a Anthropic chegou a cobrar, se houver).
* Cota mensal em US$ por pessoa: writer.usuarios.ia_cota (null = padrão global). O padrão global
  fica em writer.config['ia'].cota_usd (20.0 se não definido) e só administrador altera.
  Gasto do mês >= cota → 402.
* Limites por pessoa: 30 chamadas por minuto e 3 simultâneas → 429. São contados no banco (linhas
  da tabela), então valem para todos os workers do uvicorn; uma trava consultiva por usuário evita
  corrida entre a checagem e a abertura da linha.
* Corpo das rotas /api/ia/* limitado (413) antes de o FastAPI ler o JSON.
* Erros vão ao navegador sem detalhe da Anthropic; no registro fica só o tipo.
"""
from __future__ import annotations

import json
import time

import anthropic
from fastapi import Depends, HTTPException, Request
from psycopg.types.json import Jsonb
from pydantic import BaseModel, Field

# ---------------------------------------------------------------- preços (US$ por milhão de tokens)
PRECOS = {
    "claude-fable-5-1": (10.0, 50.0),
    "claude-fable-5": (10.0, 50.0),
    "claude-opus-5-5": (4.0, 20.0),
    "claude-opus-5": (5.0, 25.0),
    "claude-opus-4-8": (5.0, 25.0),
    "claude-sonnet-5-5": (2.0, 10.0),
    "claude-sonnet-5": (2.0, 10.0),
    "claude-haiku-5-5": (0.10, 0.50),
}
PRECO_PADRAO = (5.0, 25.0)  # conservador para modelo desconhecido
COTA_PADRAO = 20.0
POR_MINUTO = 30
SIMULTANEAS = 3
CORPO_MAX = 2 * 1024 * 1024  # /api/ia/editar leva o documento inteiro (até 400 mil caracteres de HTML)

# Tabelas e coluna: ver schema.sql (writer.ia_uso e writer.usuarios.ia_cota), aplicado a cada partida.


def preco(modelo: str) -> tuple[float, float]:
    if modelo in PRECOS:
        return PRECOS[modelo]
    for k in sorted(PRECOS, key=len, reverse=True):
        if (modelo or "").startswith(k):
            return PRECOS[k]
    return PRECO_PADRAO


def custo(modelo: str, u) -> float:
    if u is None:
        return 0.0
    pin, pout = preco(modelo)
    cw = getattr(u, "cache_creation_input_tokens", 0) or 0
    cr = getattr(u, "cache_read_input_tokens", 0) or 0
    return ((getattr(u, "input_tokens", 0) or 0) * pin + cw * pin * 1.25 + cr * pin * 0.1
            + (getattr(u, "output_tokens", 0) or 0) * pout) / 1e6


# ---------------------------------------------------------------- erros sem detalhe
def erro_cliente(e: Exception) -> HTTPException:
    """Mensagem fixa por tipo de falha — nada do texto da Anthropic chega ao navegador."""
    if isinstance(e, HTTPException):
        return e
    if isinstance(e, anthropic.AuthenticationError):
        return HTTPException(502, "Chave da Anthropic recusada — um administrador precisa revisá-la em Configurações › Assistente IA")
    if isinstance(e, anthropic.PermissionDeniedError):
        return HTTPException(502, "A chave não tem permissão para este modelo")
    if isinstance(e, anthropic.NotFoundError):
        return HTTPException(502, "Modelo não encontrado para esta chave — escolha outro em Configurações › Assistente IA")
    if isinstance(e, anthropic.RateLimitError):
        return HTTPException(429, "Limite de uso da Anthropic atingido — tente em instantes")
    if isinstance(e, anthropic.BadRequestError):
        return HTTPException(400, "A IA não aceitou o pedido — reduza o texto ou reformule")
    if isinstance(e, anthropic.APIStatusError):
        return HTTPException(502, "O serviço da Anthropic está instável — tente de novo em instantes")
    if isinstance(e, anthropic.APIConnectionError):
        return HTTPException(502, "Sem conexão com a Anthropic a partir do servidor")
    return HTTPException(502, "Falha inesperada ao chamar a IA — tente de novo")


def codigo_erro(e: Exception) -> str:
    if isinstance(e, anthropic.APIStatusError):
        return f"status_{e.status_code}"
    return type(e).__name__[:60]


# ---------------------------------------------------------------- limite do corpo (ASGI puro)
class LimiteCorpoIA:
    """Recusa com 413 o POST em /api/ia/* maior que `limite`, lendo em pedaços (sem confiar só no
    Content-Length) e antes de o FastAPI montar o JSON na memória."""

    def __init__(self, app, limite: int = CORPO_MAX, prefixo: str = "/api/ia/"):
        self.app, self.limite, self.prefixo = app, limite, prefixo

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope.get("method") != "POST" or not scope.get("path", "").startswith(self.prefixo):
            return await self.app(scope, receive, send)
        for k, v in scope.get("headers") or []:
            if k == b"content-length" and v.isdigit() and int(v) > self.limite:
                return await self._recusa(send)
        partes, total = [], 0
        while True:
            m = await receive()
            if m["type"] == "http.disconnect":
                return
            corpo = m.get("body", b"")
            total += len(corpo)
            if total > self.limite:
                return await self._recusa(send)
            partes.append(corpo)
            if not m.get("more_body"):
                break
        dados, entregue = b"".join(partes), False

        async def repete():
            nonlocal entregue
            if not entregue:
                entregue = True
                return {"type": "http.request", "body": dados, "more_body": False}
            return await receive()

        return await self.app(scope, repete, send)

    @staticmethod
    async def _recusa(send):
        corpo = json.dumps({"detail": "Pedido grande demais para o Assistente IA — selecione um trecho menor"}).encode()
        await send({"type": "http.response.start", "status": 413,
                    "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(corpo)).encode())]})
        await send({"type": "http.response.body", "body": corpo})


# ---------------------------------------------------------------- cota e uso
class CotaIn(BaseModel):
    cotaUsd: float | None = Field(default=None, ge=0, le=10000)   # None (por usuário) = volta ao padrão


class Cota:
    """Instalada pelo app.py: recebe as funções de banco e de auditoria do servidor."""

    def __init__(self, db, registra):
        self.db, self.registra = db, registra

    def cota_padrao(self, c=None) -> float:
        def le(cx):
            r = cx.execute("select valor from writer.config where chave = 'ia'").fetchone()
            v = (r and r["valor"]) or {}
            try:
                return float(v.get("cota_usd", COTA_PADRAO))
            except (TypeError, ValueError):
                return COTA_PADRAO
        if c is not None:
            return le(c)
        with self.db() as cx:
            return le(cx)

    @staticmethod
    def gasto_mes(c, uid: int) -> float:
        r = c.execute("select coalesce(sum(custo_usd), 0) s from writer.ia_uso where usuario_id = %s "
                      "and ts >= date_trunc('month', now())", (uid,)).fetchone()
        return float(r["s"])

    def cota_de(self, c, u: dict) -> float:
        r = c.execute("select ia_cota from writer.usuarios where id = %s", (u["id"],)).fetchone()
        q = r and r["ia_cota"]
        return float(self.cota_padrao(c) if q is None else q)

    def abre(self, u: dict, recurso: str, modelo: str) -> int:
        """Checa cota (402) e limites (429) e abre a linha de uso. Devolve o id da linha."""
        with self.db() as c:
            c.execute("select pg_advisory_xact_lock(hashtext('writer:ia:' || %s::text))", (u["id"],))
            gasto, cota = self.gasto_mes(c, u["id"]), self.cota_de(c, u)
            if gasto >= cota:
                raise HTTPException(402, f"Cota de IA do mês atingida (US$ {gasto:.2f} de US$ {cota:.2f}). "
                                         "Fale com um administrador.")
            r = c.execute("""select count(*) filter (where ts > now() - interval '1 minute') minuto,
                                    count(*) filter (where ok is null and ts > now() - interval '10 minutes') abertas
                             from writer.ia_uso where usuario_id = %s and ts > now() - interval '10 minutes'""",
                          (u["id"],)).fetchone()
            if r["minuto"] >= POR_MINUTO or r["abertas"] >= SIMULTANEAS:
                raise HTTPException(429, "Muitas chamadas de IA seguidas — aguarde alguns segundos")
            return c.execute("insert into writer.ia_uso(usuario_id, recurso, modelo) values (%s,%s,%s) returning id",
                             (u["id"], recurso, modelo)).fetchone()["id"]

    @staticmethod
    def consumo(modelo: str, stream, msg) -> tuple[str, object]:
        """(modelo, usage) reais: da mensagem final ou, se a chamada caiu no meio, do retrato parcial do stream."""
        if msg is not None:
            return msg.model or modelo, msg.usage
        try:
            snap = stream.current_message_snapshot if stream is not None else None
        except Exception:  # noqa: BLE001 — stream ainda sem nenhum evento
            snap = None
        return ((snap.model or modelo), snap.usage) if snap is not None else (modelo, None)

    def fecha(self, uso_id: int, modelo: str, usage, erro: str | None, t0: float) -> float:
        try:
            return self._fecha(uso_id, modelo, usage, erro, t0)
        except Exception:  # noqa: BLE001 — falha ao registrar não derruba a resposta
            return 0.0

    def _fecha(self, uso_id: int, modelo: str, usage, erro: str | None, t0: float) -> float:
        valor = custo(modelo, usage)
        with self.db() as c:
            c.execute("""update writer.ia_uso set modelo = %s, input_tokens = %s, output_tokens = %s, cache_read = %s,
                         cache_write = %s, custo_usd = %s, ok = %s, erro = %s, ms = %s where id = %s""",
                      (modelo, getattr(usage, "input_tokens", 0) or 0, getattr(usage, "output_tokens", 0) or 0,
                       getattr(usage, "cache_read_input_tokens", 0) or 0, getattr(usage, "cache_creation_input_tokens", 0) or 0,
                       valor, erro is None, (erro or None) and erro[:120], int((time.time() - t0) * 1000), uso_id))
        return valor

    # ---------------------------------------------------------------- rotas de administração
    def instala(self, app, exige_admin, ativo_ok) -> None:
        cota = self

        @app.get("/api/ia/cota")
        def minha_cota(u: dict = Depends(ativo_ok)):
            with cota.db() as c:
                return {"gastoUsd": round(cota.gasto_mes(c, u["id"]), 4), "cotaUsd": cota.cota_de(c, u)}

        @app.get("/api/admin/ia/cota")
        def ve_cotas(u: dict = Depends(exige_admin)):
            with cota.db() as c:
                linhas = c.execute("""select u.id, u.login, u.nome, u.ia_cota, count(a.id) chamadas,
                                             coalesce(sum(a.custo_usd), 0) gasto, coalesce(sum(a.input_tokens), 0) entrada,
                                             coalesce(sum(a.output_tokens), 0) saida
                                      from writer.usuarios u left join writer.ia_uso a
                                        on a.usuario_id = u.id and a.ts >= date_trunc('month', now())
                                      group by u.id order by gasto desc, u.nome""").fetchall()
                padrao = cota.cota_padrao(c)
            return {"cotaPadraoUsd": padrao, "usuarios": [
                {"id": r["id"], "login": r["login"], "nome": r["nome"], "chamadas": r["chamadas"],
                 "cotaUsd": None if r["ia_cota"] is None else float(r["ia_cota"]),
                 "gastoUsd": round(float(r["gasto"]), 4), "tokensEntrada": int(r["entrada"]), "tokensSaida": int(r["saida"])}
                for r in linhas]}

        @app.put("/api/admin/ia/cota")
        def define_cota_padrao(body: CotaIn, request: Request, u: dict = Depends(exige_admin)):
            if body.cotaUsd is None:
                raise HTTPException(422, "Informe a cota padrão em US$")
            with cota.db() as c:
                c.execute("""insert into writer.config(chave, valor, atualizado_em, atualizado_por)
                             values ('ia', %s, now(), %s)
                             on conflict (chave) do update set valor = writer.config.valor || excluded.valor,
                               atualizado_em = now(), atualizado_por = excluded.atualizado_por""",
                          (Jsonb({"cota_usd": body.cotaUsd}), u["login"]))
                cota.registra(c.cursor(), "IA_COTA", request, u, detalhe=f"cota padrão US$ {body.cotaUsd:.2f}")
            return ve_cotas(u)

        @app.put("/api/admin/ia/cota/{uid}")
        def define_cota_usuario(uid: int, body: CotaIn, request: Request, u: dict = Depends(exige_admin)):
            with cota.db() as c:
                r = c.execute("update writer.usuarios set ia_cota = %s where id = %s returning login",
                              (body.cotaUsd, uid)).fetchone()
                if not r:
                    raise HTTPException(404, "Usuário não encontrado")
                cota.registra(c.cursor(), "IA_COTA", request, u,
                              detalhe=f"{r['login']}: " + ("padrão" if body.cotaUsd is None else f"US$ {body.cotaUsd:.2f}"))
            return {"ok": True, "id": uid, "cotaUsd": body.cotaUsd}
