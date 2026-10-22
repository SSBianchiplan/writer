"""Cota e limites do Assistente IA (ia_cota.py).

Precisa de um PostgreSQL descartável:  WRITER_TEST_DSN=postgresql://postgres@127.0.0.1:55432/writer_teste
    cd server && python -m pytest tests -q
Nenhum teste fala com a Anthropic: o cliente é trocado por um falso.
"""
from __future__ import annotations

import hashlib
import json
import os
import secrets
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

DSN = os.environ.get("WRITER_TEST_DSN")
pytestmark = pytest.mark.skipif(not DSN, reason="defina WRITER_TEST_DSN (PostgreSQL descartável)")
if DSN:
    os.environ["WRITER_DSN"] = DSN
    os.environ["WRITER_COOKIE_SEGURO"] = "0"
    os.environ.pop("ANTHROPIC_API_KEY", None)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import anthropic  # noqa: E402
import httpx  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

CHAVE_FALSA = "sk-ant-teste-" + "x" * 30
H = {"x-writer": "1"}


@pytest.fixture(scope="module")
def mod():
    import app as m
    with TestClient(m.app) as c:
        m._cli = c
        yield m


def cria_usuario(m, papel: str) -> tuple[int, str]:
    tok = secrets.token_urlsafe(24)
    with m.db() as c:
        uid = c.execute("insert into writer.usuarios(login, nome, papel, senha_hash, trocar_senha) values (%s,%s,%s,'x',false) returning id",
                        (f"{secrets.token_hex(4)}@exemplo.com", "Teste", papel)).fetchone()["id"]
        c.execute("insert into writer.sessoes(token_hash, usuario_id, expira_em) values (%s,%s, now() + interval '1 hour')",
                  (hashlib.sha256(tok.encode()).hexdigest(), uid))
    return uid, tok


def cliente(m, tok):
    m._cli.cookies.clear()
    m._cli.cookies.set("writer_s", tok)
    return m._cli


def liga_ia(m, monkeypatch, chave=CHAVE_FALSA):
    monkeypatch.setattr(m, "IA_KEY_ENV", chave)
    m._IA_CACHE.update(t=0.0, v=None)


class StreamFalso:
    def __init__(self, ctx):
        self.ctx = ctx
        self.current_message_snapshot = None

    async def __aenter__(self):
        if self.ctx.get("erro"):
            raise self.ctx["erro"]
        return self

    async def __aexit__(self, *a):
        return False

    def __aiter__(self):
        async def gen():
            yield SimpleNamespace(type="text", text='{"resumo": "ok", "operacoes": []}')
        return gen()

    async def get_final_message(self):
        u = SimpleNamespace(input_tokens=1000, output_tokens=500, cache_read_input_tokens=0, cache_creation_input_tokens=0)
        return SimpleNamespace(model="claude-opus-5-5", usage=u, stop_reason="end_turn",
                               content=[SimpleNamespace(type="text", text='{"resumo": "ok", "operacoes": []}')])


@pytest.fixture
def falso(mod, monkeypatch):
    ctx = {"chamadas": 0}

    def cli(chave):
        def stream(**kw):
            ctx["chamadas"] += 1
            ctx["kw"] = kw
            return StreamFalso(ctx)
        return SimpleNamespace(beta=SimpleNamespace(messages=SimpleNamespace(stream=stream)))
    monkeypatch.setattr(mod, "cliente_ia", cli)
    return ctx


def eventos(txt: str) -> list[tuple[str, dict]]:
    out = []
    for bloco in txt.strip().split("\n\n"):
        linhas = dict(l.split(": ", 1) for l in bloco.split("\n") if ": " in l)
        out.append((linhas.get("event"), json.loads(linhas.get("data", "{}"))))
    return out


def gasta(m, uid, valor):
    with m.db() as c:
        c.execute("insert into writer.ia_uso(usuario_id, recurso, modelo, custo_usd, ok) values (%s,'teste','claude-opus-5-5',%s,true)", (uid, valor))


def test_sem_chave_503(mod, falso, monkeypatch):
    liga_ia(mod, monkeypatch, "")
    _, tok = cria_usuario(mod, "EDITOR")
    r = cliente(mod, tok).post("/api/ia/texto", json={"prompt": "olá mundo"}, headers=H)
    assert r.status_code == 503 and "não configurado" in r.json()["detail"]
    assert falso["chamadas"] == 0


def test_cota_estourada_402_sem_chamar(mod, falso, monkeypatch):
    liga_ia(mod, monkeypatch)
    uid, tok = cria_usuario(mod, "EDITOR")
    gasta(mod, uid, 25)  # padrão é US$ 20
    for rota, corpo in (("/api/ia/texto", {"prompt": "olá mundo"}),
                        ("/api/ia/editar", {"pedido": "melhore", "documento": "[[B1]] <p>x</p>"})):
        r = cliente(mod, tok).post(rota, json=corpo, headers=H)
        assert r.status_code == 402, r.text
        assert "Cota de IA do mês" in r.json()["detail"]
    assert falso["chamadas"] == 0


def test_uso_real_gravado(mod, falso, monkeypatch):
    liga_ia(mod, monkeypatch)
    uid, tok = cria_usuario(mod, "EDITOR")
    r = cliente(mod, tok).post("/api/ia/texto", json={"prompt": "escreva algo"}, headers=H)
    assert r.status_code == 200
    assert [e for e, _ in eventos(r.text)][-1] == "fim"
    assert falso["kw"]["max_tokens"] == 16000
    r = cliente(mod, tok).post("/api/ia/editar", json={"pedido": "melhore", "documento": "[[B1]] <p>x</p>"}, headers=H)
    assert eventos(r.text)[-1][0] == "final"
    with mod.db() as c:
        rows = c.execute("select * from writer.ia_uso where usuario_id = %s order by id", (uid,)).fetchall()
    assert [x["recurso"] for x in rows] == ["texto", "editar"]
    for x in rows:
        assert x["ok"] is True and x["input_tokens"] == 1000 and x["output_tokens"] == 500
        assert float(x["custo_usd"]) == pytest.approx((1000 * 4 + 500 * 20) / 1e6)
    me = cliente(mod, tok).get("/api/ia/cota").json()
    assert me["gastoUsd"] == pytest.approx(0.028) and me["cotaUsd"] == 20.0


def test_erro_da_anthropic_sem_detalhe(mod, falso, monkeypatch):
    liga_ia(mod, monkeypatch)
    uid, tok = cria_usuario(mod, "EDITOR")
    req = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    falso["erro"] = anthropic.InternalServerError("segredo-interno-XYZ org-123", response=httpx.Response(500, request=req), body=None)
    r = cliente(mod, tok).post("/api/ia/texto", json={"prompt": "escreva"}, headers=H)
    ev, dados = eventos(r.text)[-1]
    assert ev == "erro" and "XYZ" not in dados["detail"] and "org-123" not in r.text
    falso["erro"] = RuntimeError("caminho /opt/writer/.env")
    r = cliente(mod, tok).post("/api/ia/texto", json={"prompt": "escreva"}, headers=H)
    assert ".env" not in r.text and eventos(r.text)[-1][0] == "erro"
    with mod.db() as c:
        erros = [x["erro"] for x in c.execute("select erro, ok from writer.ia_uso where usuario_id = %s order by id", (uid,)).fetchall()]
    assert erros == ["status_500", "RuntimeError"]


def test_corpo_grande_413(mod, falso, monkeypatch):
    liga_ia(mod, monkeypatch)
    _, tok = cria_usuario(mod, "EDITOR")
    grande = json.dumps({"pedido": "x", "documento": "a" * (3 * 1024 * 1024)})
    r = cliente(mod, tok).post("/api/ia/editar", content=grande, headers={**H, "content-type": "application/json"})
    assert r.status_code == 413
    assert falso["chamadas"] == 0


def test_limite_simultaneas_429(mod, falso, monkeypatch):
    liga_ia(mod, monkeypatch)
    uid, tok = cria_usuario(mod, "EDITOR")
    with mod.db() as c:
        for _ in range(3):
            c.execute("insert into writer.ia_uso(usuario_id, recurso) values (%s,'texto')", (uid,))  # ok null = em andamento
    r = cliente(mod, tok).post("/api/ia/texto", json={"prompt": "olá mundo"}, headers=H)
    assert r.status_code == 429


def test_so_admin_altera_cota(mod, falso, monkeypatch):
    liga_ia(mod, monkeypatch)
    uid, tok = cria_usuario(mod, "EDITOR")
    _, adm = cria_usuario(mod, "ADMIN")
    assert cliente(mod, tok).put("/api/admin/ia/cota", json={"cotaUsd": 999}, headers=H).status_code == 403
    assert cliente(mod, tok).put(f"/api/admin/ia/cota/{uid}", json={"cotaUsd": 999}, headers=H).status_code == 403
    assert cliente(mod, tok).get("/api/admin/ia/cota").status_code == 403
    r = cliente(mod, adm).put("/api/admin/ia/cota", json={"cotaUsd": 35}, headers=H)
    assert r.status_code == 200 and r.json()["cotaPadraoUsd"] == 35
    assert cliente(mod, adm).put("/api/admin/ia/cota", json={"cotaUsd": -1}, headers=H).status_code == 422
    # a cota padrão não apaga a configuração existente da IA (modelo, chave)
    with mod.db() as c:
        v = c.execute("select valor from writer.config where chave='ia'").fetchone()["valor"]
    assert v["cota_usd"] == 35
    # cota individual zero bloqueia só essa pessoa
    assert cliente(mod, adm).put(f"/api/admin/ia/cota/{uid}", json={"cotaUsd": 0}, headers=H).status_code == 200
    assert cliente(mod, tok).post("/api/ia/texto", json={"prompt": "olá"}, headers=H).status_code == 402
    assert cliente(mod, adm).put(f"/api/admin/ia/cota/{uid}", json={"cotaUsd": None}, headers=H).json()["cotaUsd"] is None
    assert cliente(mod, tok).get("/api/ia/cota").json()["cotaUsd"] == 35
    assert falso["chamadas"] == 0
    cliente(mod, adm).put("/api/admin/ia/cota", json={"cotaUsd": 20}, headers=H)


def test_configura_ia_preserva_cota(mod, falso, monkeypatch):
    liga_ia(mod, monkeypatch)
    _, adm = cria_usuario(mod, "ADMIN")
    cliente(mod, adm).put("/api/admin/ia/cota", json={"cotaUsd": 12.5}, headers=H)
    r = cliente(mod, adm).put("/api/admin/ia", json={"modelo": "claude-sonnet-5-5", "ativo": True}, headers=H)
    assert r.status_code == 200
    assert cliente(mod, adm).get("/api/admin/ia/cota").json()["cotaPadraoUsd"] == 12.5
    cliente(mod, adm).put("/api/admin/ia/cota", json={"cotaUsd": 20}, headers=H)
