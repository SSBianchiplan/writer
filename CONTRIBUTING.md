# Como contribuir com o GPlanSiS|Writer

Obrigado pelo interesse! Este guia resume como propor mudanças de forma que elas possam ser revisadas e publicadas com segurança.

## Antes de começar

- Leia o [código de conduta](CODE_OF_CONDUCT.md).
- Para mudanças grandes (novo módulo, troca de biblioteca, mudança de esquema do banco), **abra uma issue primeiro** e descreva a proposta.
- Vulnerabilidades **não** vão para issues públicas: veja [SECURITY.md](SECURITY.md).

## Ambiente de desenvolvimento

Siga “Como rodar localmente” no [README](README.md#como-rodar-localmente). Em resumo: PostgreSQL local, venv com `server/requirements.txt`, `WRITER_COOKIE_SEGURO=0` e `uvicorn --app-dir ../dev local:app` a partir de `server/`.

Use apenas dados fictícios (ex.: `@exemplo.com`). Nunca inclua documentos reais, e-mails de pessoas ou chaves de API em commits, issues ou capturas de tela.

## Convenções do código

- **Idioma**: interface, mensagens, comentários e nomes de domínio em português do Brasil.
- **Front sem build**: JavaScript puro em `web/`. A CSP é `script-src 'self'` — não use script inline nem `eval`. Bibliotecas novas entram em `web/vendor/` (servidas pelo próprio domínio) e precisam de licença compatível.
- Ajustes feitos no editor para a versão servidor são marcados com `[servidor]`; os do layout de celular com `[celular]`.
- Arquivo novo em `web/` precisa entrar na lista `cp` de `deploy/vps/publicar.sh` (e, se for estático versionado, nas regras de cache de `deploy/vps/writer.caddy` e no `PRECACHE` de `web/sw.js`).
- **API**: regras de permissão são conferidas no servidor, nunca só na interface. Toda mutação exige o cabeçalho `x-writer: 1` (CSRF).
- **Banco**: `server/schema.sql` precisa continuar idempotente (`create … if not exists`, `alter … add column if not exists`), porque roda a cada partida.

## Verificações antes do pull request

```bash
node --check web/writer.js && node --check web/plataforma.js && node --check web/pwa.js && node --check web/sw.js
python3 -c "import json; json.load(open('web/manifest.webmanifest'))"
python3 -c "import ast; ast.parse(open('server/app.py').read())"
```

E teste manualmente o fluxo que você mexeu (entrar, criar/editar documento, compartilhar, notas, exportar), em tema claro e escuro e, se tocar no layout, em largura de celular.

## Fluxo

1. Faça um fork e crie uma branch descritiva (`corrige-importacao-odt`, `modelo-oficio`…).
2. Commits pequenos, com mensagem no imperativo explicando o porquê.
3. Abra o pull request preenchendo o modelo, com capturas de tela quando houver mudança visual.
4. A equipe GPlanSiS revisa; a publicação em https://writer.gplansis.com é feita pela GPlanSiS.

## Licença das contribuições

O projeto ainda não tem licença definida (ver README). Ao enviar uma contribuição você declara que tem o direito de enviá-la e concorda que ela seja distribuída sob a licença que a GPlanSiS vier a adotar para o projeto.
