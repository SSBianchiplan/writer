#!/usr/bin/env bash
# Publica o GPlanSiS|Writer num servidor Linux com PostgreSQL e Caddy (produção: writer.gplansis.com).
# Uso, da raiz do repositório:
#   WRITER_HOST=<alias-ssh> WRITER_MASTER=<email-do-admin> [WRITER_MASTER_NOME="Nome"] bash deploy/vps/publicar.sh
# WRITER_HOST é um alias do ~/.ssh/config com acesso root (defina WRITER_HOST).
set -euo pipefail
: "${WRITER_MASTER:?defina WRITER_MASTER com o e-mail do administrador master}"
cd "$(dirname "$0")/../.."
HOST=${WRITER_HOST:?defina WRITER_HOST=<servidor ssh>}
node --check web/writer.js; node --check web/plataforma.js; node --check web/pwa.js; node --check web/sw.js
python3 -c "import json; json.load(open('web/manifest.webmanifest'))"
python3 -c "import ast; [ast.parse(open(f).read()) for f in ('server/app.py', 'server/ia_cota.py')]"
STG=$(mktemp -d); mkdir -p "$STG/web" "$STG/server" "$STG/deploy"
cp web/index.html web/writer.js web/writer.css web/plataforma.js web/plataforma.css web/tema.js web/icon.svg web/pwa.js web/sw.js web/manifest.webmanifest web/icon-32.png web/icon-192.png web/icon-512.png web/icon-maskable-512.png web/apple-touch-icon.png "$STG/web/"; cp -R web/vendor "$STG/web/"
cp server/app.py server/ia_cota.py server/schema.sql server/requirements.txt "$STG/server/"
cp deploy/vps/writer.service deploy/vps/writer.caddy deploy/vps/instalar.remoto.sh "$STG/deploy/"
# versão nos links de CSS/JS e no service worker muda a cada publicação (cache imutável no navegador; o SW troca o cache do shell)
V=$(date +%Y%m%d%H%M%S)
sed -i '' "s/__V__/$V/g" "$STG/web/index.html" "$STG/web/sw.js"
rsync -a --delete "$STG/" "$HOST:/tmp/writer-pacote/"
ssh "$HOST" "WRITER_MASTER=$(printf %q "${WRITER_MASTER:?defina WRITER_MASTER}") WRITER_MASTER_NOME=$(printf %q "${WRITER_MASTER_NOME:-Administrador}") bash /tmp/writer-pacote/deploy/instalar.remoto.sh"
rm -rf "$STG"
echo "publicado em https://writer.gplansis.com"
