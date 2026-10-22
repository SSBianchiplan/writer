"""GPlanSiS|Writer — servidor de desenvolvimento local (um processo só).

Em produção o Caddy serve web/ e repassa /api/* ao uvicorn. Aqui, para quem quer
contribuir sem instalar proxy, a própria API também serve os arquivos de web/.

Uso, da raiz do repositório (ver README, "Como rodar localmente"):
    cd server && WRITER_DSN=... WRITER_COOKIE_SEGURO=0 \
        uvicorn --app-dir ../dev local:app --port 8976 --reload
"""
from __future__ import annotations

import sys
from pathlib import Path

from fastapi.responses import FileResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.staticfiles import StaticFiles

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "server"))

from app import app  # noqa: E402  (a API de produção, sem alterações)

WEB = RAIZ / "web"


class SPA(StaticFiles):
    """Arquivos de web/; qualquer rota desconhecida devolve index.html (como o try_files do Caddy)."""

    async def get_response(self, path, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as e:
            if e.status_code == 404 and not path.startswith("api/"):
                return FileResponse(WEB / "index.html")
            raise


app.mount("/", SPA(directory=WEB, html=True), name="web")
