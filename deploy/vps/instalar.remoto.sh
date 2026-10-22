#!/usr/bin/env bash
# Roda NO SERVIDOR como root (chamado por deploy/vps/publicar.sh). Idempotente.
set -euo pipefail
APP=/opt/writer; SRC=/tmp/writer-pacote
# e-mail do administrador master e nome exibido: vêm do ambiente (publicar.sh repassa WRITER_MASTER e WRITER_MASTER_NOME)
MASTER=${WRITER_MASTER:?defina WRITER_MASTER com o e-mail do administrador master}
MASTER_NOME=${WRITER_MASTER_NOME:-Administrador}
id writer >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin writer
mkdir -p "$APP/web" "$APP/server"
CARIMBO=$(date +%Y%m%d-%H%M%S)
[ "$(ls -A $APP/web 2>/dev/null)" ] && cp -a "$APP/web" "$APP/web.bak-$CARIMBO" && cp -a "$APP/server" "$APP/server.bak-$CARIMBO"
rsync -a --delete "$SRC/web/" "$APP/web/"
rsync -a --delete "$SRC/server/" "$APP/server/"
# banco: papel e base próprios, autenticação peer pelo socket (sem senha em arquivo)
sudo -u postgres psql -tAc "select 1 from pg_roles where rolname='writer'" | grep -q 1 || sudo -u postgres psql -qc "create role writer login"
sudo -u postgres psql -tAc "select 1 from pg_database where datname='writer'" | grep -q 1 || sudo -u postgres psql -qc "create database writer owner writer"
# venv
[ -x "$APP/.venv/bin/python" ] || python3 -m venv "$APP/.venv"
"$APP/.venv/bin/pip" -q install --upgrade pip >/dev/null
"$APP/.venv/bin/pip" -q install -r "$APP/server/requirements.txt"
# .env (preserva o existente; a chave da IA é colada pelo painel)
if [ ! -f "$APP/.env" ]; then
  cat > "$APP/.env" <<ENV
WRITER_DSN=postgresql:///writer?host=/var/run/postgresql
WRITER_MASTER=$MASTER
WRITER_SESSAO_HORAS=12
# IA: prefira colar a chave em Configurações › Assistente IA; esta fica como reserva
ANTHROPIC_API_KEY=
WRITER_IA_MODELO=claude-opus-5-5
ENV
fi
# segredo que cifra a chave da IA guardada pelo painel (gerado uma vez; perdê-lo exige recolar a chave)
grep -q '^WRITER_SEGREDO=' "$APP/.env" || echo "WRITER_SEGREDO=$("$APP/.venv/bin/python" -c 'from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())')" >> "$APP/.env"
chown -R root:writer "$APP"; chmod 751 "$APP"; chmod 640 "$APP/.env"; chmod -R a+rX "$APP/web"
# administrador master: criado uma única vez (senha temporária impressa abaixo, troca obrigatória)
( cd "$APP/server" && sudo -u writer env WRITER_DSN="postgresql:///writer?host=/var/run/postgresql" WRITER_MASTER="$MASTER" "$APP/.venv/bin/python" app.py criar-admin "$MASTER" --nome "$MASTER_NOME" --se-nao-existir )
install -m 644 "$SRC/deploy/writer.service" /etc/systemd/system/writer.service
systemctl daemon-reload
systemctl enable writer >/dev/null 2>&1
systemctl restart writer
# Caddy: bloco próprio + import único no Caddyfile, validado antes do reload
cp -a /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.bak-writer-$CARIMBO"
[ -f /etc/caddy/writer.caddy ] && cp -a /etc/caddy/writer.caddy "/etc/caddy/writer.caddy.bak-$CARIMBO"
install -m 644 "$SRC/deploy/writer.caddy" /etc/caddy/writer.caddy
touch /var/log/caddy/writer.log; chown caddy:caddy /var/log/caddy/writer.log
grep -q 'import /etc/caddy/writer.caddy' /etc/caddy/Caddyfile || printf '\n# GPlanSiS|Writer (deploy separado — ver /etc/caddy/writer.caddy)\nimport /etc/caddy/writer.caddy\n' >> /etc/caddy/Caddyfile
if caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then systemctl reload caddy; echo "caddy recarregado"
else echo "CADDY INVALIDO — restaurando"; cp -a "/etc/caddy/Caddyfile.bak-writer-$CARIMBO" /etc/caddy/Caddyfile; rm -f /etc/caddy/writer.caddy; caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile 2>&1 | tail -3; exit 1; fi
# espera os workers subirem: uma falha na partida só aparece depois de alguns segundos
sleep 12
systemctl is-active --quiet writer || { echo "SERVIÇO PAROU NA PARTIDA"; journalctl -u writer -n 30 --no-pager; exit 1; }
for i in 1 2 3; do curl -fsS -m 5 http://127.0.0.1:8976/api/saude && break || sleep 3; done; echo
systemctl is-active writer
# mantém só os 5 backups mais recentes do pacote
ls -dt $APP/web.bak-* 2>/dev/null | tail -n +6 | xargs -r rm -rf; ls -dt $APP/server.bak-* 2>/dev/null | tail -n +6 | xargs -r rm -rf
