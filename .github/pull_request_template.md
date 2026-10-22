## O que muda

<!-- Descreva a mudança e o motivo. Relacione a issue: "Resolve #123". -->

## Como testar

<!-- Passos para conferir localmente (com dados fictícios). -->

## Capturas de tela

<!-- Obrigatório se houver mudança visual: tema claro e escuro; celular se mexer no layout. -->

## Checklist

- [ ] `node --check` nos JS de `web/` e `ast.parse` em `server/app.py` passam
- [ ] Testei o fluxo afetado no navegador
- [ ] Permissões novas/alteradas são conferidas no servidor
- [ ] `server/schema.sql` continua idempotente (se alterado)
- [ ] Arquivo novo em `web/` entrou em `deploy/vps/publicar.sh`
- [ ] Nenhum segredo, dado real ou e-mail pessoal no diff
