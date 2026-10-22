# Manual de operação — GPlanSiS|Writer 1.1

> Documento técnico herdado do LEIA-ME do projeto. Visão geral e instalação rápida estão no [README](../README.md).

Editor de documentos no estilo Word com módulo de Notas integrado, num único arquivo HTML.
Funciona no navegador do computador, tablet ou celular, sem instalação e sem backend.

## Arquivos

| Arquivo | Uso |
|---|---|
| `standalone/GPlanSiS-Writer-offline.html` (1,2 MB) | Funciona **sem internet**. Fontes IBM Plex, JSZip 3.10.1 e Mammoth 1.6.0 estão embutidos. Recomendado. |
| `standalone/GPlanSiS-Writer-online.html` (0,2 MB) | Mais leve. Carrega fontes do Google Fonts e as bibliotecas do cdnjs na primeira vez que importa ou exporta .docx. |
| `deploy/estatico/` | Imagem nginx + compose para publicar atrás do Traefik. Usa a versão offline como `index.html`. |

## Uso local

Dê dois cliques no arquivo ou arraste-o para o Chrome, Edge, Safari ou Firefox.

## Publicar no servidor (Docker + Traefik) — só a versão estática, sem login

> A produção atual (https://writer.gplansis.com, com login) **não** usa este caminho: ela é publicada
> por `bash deploy/vps/publicar.sh` — ver “Versão servidor” mais abaixo.


```bash
cd deploy/estatico
cp ../../standalone/GPlanSiS-Writer-offline.html index.html
cp .env.example .env          # ajuste WRITER_HOST e os nomes do seu Traefik
docker compose up -d --build
docker compose ps             # o estado deve ficar "healthy"
curl -I https://$WRITER_HOST  # confira os cabeçalhos de segurança
```

Pré-requisitos: rede externa do Traefik já criada (`TRAEFIK_NETWORK`), entrypoint HTTPS e
certresolver configurados. O compose não expõe porta no host; o acesso é só pelo Traefik.

Atualizar: troque `deploy/estatico/index.html` pela versão nova, suba `WRITER_VERSION` no `.env` e rode
`docker compose up -d --build`. Para voltar, restaure o `index.html` anterior e repita.

Sem Docker: qualquer servidor estático serve (nginx, IIS, Apache). Copie `standalone/GPlanSiS-Writer-offline.html`
como `index.html` e aplique os cabeçalhos de `deploy/estatico/nginx.conf`.

## Onde ficam os dados

Fora do Claude, documentos e notas ficam no **armazenamento do navegador** de cada pessoa
(localStorage, normalmente até ~5 MB). Não há sincronização entre computadores nem entre usuários.

- Faça backup por **Exportar › Backup completo (.json)** e restaure por **Abrir arquivo**.
- Limpar os dados do navegador apaga os documentos. Oriente os usuários a exportar o backup.
- Imagens grandes ocupam espaço rápido; o Writer reduz fotos acima de 600 kB para 1600 px.

Dentro do Claude (artifact publicado), os dados sincronizam na conta da pessoa.

## Recursos que dependem do ambiente

- **Assistente com IA**: só funciona com a página aberta no Claude. Na versão publicada no seu
  servidor, os botões aparecem, mas informam que o assistente está indisponível.
- **PDF**: usa a impressão do navegador (Ctrl+P → Salvar como PDF). Cabeçalho, rodapé e
  "Página X de Y" saem corretos no Chrome e no Edge recentes.
- **Ler em voz alta**: depende das vozes em português instaladas no sistema.

## Formatos

| Formato | Abrir | Salvar | Observação |
|---|---|---|---|
| Word .docx | sim | sim | Estilos, listas, tabelas, imagens, cabeçalho/rodapé, alterações controladas e comentários. |
| Word 97–2003 .doc | sim | sim | Ao abrir um .doc binário, vêm texto, parágrafos, tabelas e quebras de página; a formatação original não é lida. Ao salvar, o .doc é gerado no formato HTML do Word e abre normalmente no Word. |
| OpenDocument .odt | sim | sim | LibreOffice, Google Docs e Word abrem. |
| Rich Text .rtf | sim | sim | Negrito, itálico, sublinhado, listas, tabelas, cabeçalho e rodapé. |
| Texto .txt | sim | sim | Detecta UTF-8, UTF-16 e Windows-1252 ao abrir; salva em UTF-8. |
| Markdown .md | sim | sim | |
| HTML .html | sim | sim | |
| CSV / TSV | sim | — | Vira uma tabela (separador `,`, `;` ou tab detectado). |
| PDF | — | sim | Pela impressão do navegador. |
| Backup .json | sim | sim | Todos os documentos e notas. |

Dá para abrir vários arquivos de uma vez, ou arrastá-los para a janela. No módulo Notas, os arquivos
abertos viram notas. Arquivos protegidos por senha não são abertos.

## Atalhos

| Ação | Atalho |
|---|---|
| Nota rápida | Ctrl+Shift+N |
| Localizar / substituir | Ctrl+F / Ctrl+H |
| Link | Ctrl+K |
| Quebra de página | Ctrl+Enter |
| Comentário | Ctrl+Alt+M |
| Título 1, 2, 3 / Normal | Ctrl+Alt+1, 2, 3 / Ctrl+Alt+0 |
| Imprimir / PDF | Ctrl+P |
| Sair do modo foco | Esc |

## Limitações conhecidas

- A paginação é por bloco: um parágrafo maior que meia página atravessa a quebra.
- Os números de página do sumário seguem a paginação do Writer; o Word pode recalcular diferente.
- Notas de fim ficam no final do documento, não no rodapé de cada página.
- Um .docx de terceiros é importado com o conteúdo e a estrutura; formatações muito
  específicas do Word (caixas de texto, seções múltiplas) podem não vir.

## Licenças de terceiros

IBM Plex (SIL Open Font License 1.1), JSZip (MIT ou GPLv3), Mammoth (BSD-2-Clause).

---

## Versão servidor — https://writer.gplansis.com

O mesmo editor, com login, documentos e notas guardados no servidor, compartilhamento e permissões por usuário.

| Pasta | Conteúdo |
|---|---|
| `web/` | `index.html` + `writer.js`/`writer.css` (o editor, extraído do arquivo online; ajustes marcados com `[servidor]`) + `plataforma.js`/`plataforma.css` (login, sincronização, compartilhamento, configurações) + `vendor/` (JSZip 3.10.1 e Mammoth 1.6.0 servidos pelo próprio domínio) |
| `server/` | API FastAPI + PostgreSQL (`app.py`, `schema.sql`) |
| `deploy/vps/` | `publicar.sh` (rodar no Mac), `instalar.remoto.sh`, unidade systemd e bloco Caddy. O `deploy/estatico/` com Docker/nginx continua servindo a versão estática sem login. |

- **Publicar** (procedimento real da produção): da raiz do repositório, `WRITER_HOST=<alias-ssh> WRITER_MASTER=<email-do-admin> bash deploy/vps/publicar.sh`. O script confere a sintaxe (JS, manifesto, Python), monta o pacote, troca `__V__` pela data/hora em `index.html` e `sw.js`, envia para `<servidor>:/tmp/writer-pacote/` e roda `deploy/vps/instalar.remoto.sh` no servidor, que: copia `/opt/writer/web` e `/opt/writer/server` para `*.bak-AAAAMMDD-HHMMSS`, sincroniza os novos (`rsync --delete`), atualiza o venv, reinicia o serviço systemd `writer` (uvicorn em 127.0.0.1:8976), instala `/etc/caddy/writer.caddy` (com backup `writer.caddy.bak-*`), valida o Caddyfile e recarrega o Caddy (restaura se inválido) e confere `/api/saude`. Mantém os 5 últimos backups do pacote; o banco `writer` nunca é tocado por um envio. Arquivo novo em `web/` precisa entrar na lista `cp` do `publicar.sh`.
- **Voltar uma publicação**: `ssh <servidor> 'cp -a /opt/writer/web.bak-<carimbo>/. /opt/writer/web/'` (idem `server`, e `systemctl restart writer`).
- **Administrador master**: o e-mail definido em `WRITER_MASTER` (não pode ser rebaixado, desativado nem perder permissões). Nova senha temporária, se precisar: `ssh <servidor> 'cd /opt/writer/server && sudo -u writer env WRITER_DSN="postgresql:///writer?host=/var/run/postgresql" WRITER_MASTER=<email> /opt/writer/.venv/bin/python app.py criar-admin <email> --nome "<Nome>"'`.
- **Papéis**: Administrador, Editor, Revisor e Leitor, com ajuste permissão por permissão (criar, editar, notas, excluir, compartilhar, importar, exportar/imprimir, IA, auditoria, usuários). Todos leem o que for compartilhado com eles; o Revisor edita o que recebe com permissão de edição, mas não cria; o Leitor só lê.
- **Documentos**: salvos sozinhos no servidor; histórico de até 40 versões por documento (um retrato a cada 10 min de edição e sempre que outra pessoa grava), com restaurar ou abrir cópia; lixeira de 30 dias.
- **Compartilhamento**: com toda a equipe ou por pessoa, em leitura ou edição. **Trava de edição**: quem abre primeiro edita; os outros abrem em leitura, veem as gravações chegarem e podem assumir a edição. Se duas gravações se cruzarem, a do servidor fica aberta e a sua é guardada como “(minha versão — conflito)” — nada se perde.
- **Notas e pastas**: privadas de cada usuário, sincronizadas entre aparelhos.
- **Sem conexão**: o editor continua funcionando; uma cópia de trabalho por usuário fica no navegador e é enviada quando a rede volta. Ao sair com tudo enviado, essa cópia é apagada. Documentos do Writer usado antes do login, no mesmo navegador, podem ser enviados para a conta no primeiro acesso.
- **Configurações** (menu do avatar): perfil com foto (enquadrar e salvar), senha e sessões, preferências (tema, página e margens padrão, reabrir o último documento), usuários e permissões, todos os documentos (visão de governança, sem conteúdo), Assistente IA e registro de acessos.
- **Assistente IA**: um administrador cola a chave da Anthropic em Configurações › Assistente IA (testa a conexão, escolhe o modelo, liga/desliga). A chave fica cifrada no banco com `WRITER_SEGREDO` (gerado no `.env` pela instalação) e nunca volta ao navegador. Respostas em streaming por `/api/ia/texto`.
- Exportar, imprimir e importar são bloqueados na interface conforme a permissão; como o documento é aberto no navegador, isso não impede quem tem leitura de copiar o texto por outros meios. Criar, editar, excluir, compartilhar, notas e IA são conferidos também no servidor.

## Integração com o GPlanSiS|Docs

Mesmo desenho da integração Drawings ↔ Docs.

- **Enviar ao Docs** (Exportar › Enviar ao GPlanSiS|Docs, permissão “Enviar documentos ao GPlanSiS|Docs”): o 1º envio cria o documento na lista mestra do projeto escolhido (tipos de texto: RT, MD, ET, PR…; numerado pela máscara do Docs). Depois, reenvia na revisão aberta (substitui só os arquivos que o Writer mandou, marca `.writer.`) ou abre a próxima revisão. Vão o **PDF** (gerado pelo Chromium do Gotenberg do Docs a partir do mesmo HTML de impressão: papel, margens, cabeçalho, rodapé, “Página X de Y” e o código/revisão no canto superior direito), o **Word (.docx)** e o JSON nativo. Opcionalmente já inicia o fluxo de verificação com os responsáveis.
- **Volta do Docs**: eventos de revisão e comentário (gatilhos no Docs, fila `integracao_evento` com `sistema = 'writer'`) chegam assinados em `POST /api/integracao/docs/evento`. O selo na barra superior mostra código · revisão · situação · comentários abertos; clicar abre revisões e comentários (com a página do PDF). A lista de documentos mostra o código e a revisão.
- **Entrada única**: botão “Docs” no Writer; no Docs, menu **Writer** (área só com os documentos de `metadata.origem = 'writer'`), botão “Writer” no topo e “Abrir no Writer” no documento, que abre o documento certo (`#w<id>`). Código assinado (HMAC, 2 min, uso único); a pessoa precisa existir com o mesmo e-mail nos dois sistemas.
- **Configuração**: o mesmo segredo em `/opt/writer/.env` (`WRITER_DOCS_SEGREDO`) e `/opt/gplansis-docs/.env` (`INTEGRACAO_WRITER_SEGREDO`). As chamadas do Writer ao Docs usam `x-integracao` + `x-em-nome-de`: valem os papéis do usuário no projeto do Docs e a auditoria registra a pessoa.

## Aplicativo instalável (PWA) e celular

O Writer em https://writer.gplansis.com pode ser instalado como aplicativo:

- **Computador (Chrome/Edge)**: ícone “Instalar” na barra de endereço, ou menu ⋮ › Transmitir, salvar e compartilhar › Instalar página como app.
- **Android (Chrome)**: menu ⋮ › Instalar app (ou Adicionar à tela inicial).
- **iPhone/iPad (Safari)**: Compartilhar › Adicionar à Tela de Início.

| Arquivo (`web/`) | Papel |
|---|---|
| `manifest.webmanifest` | nome “GPlanSiS\|Writer”, curto “Writer”, `start_url`/`scope` `/`, `display: standalone`, `lang pt-BR`, tema `#1f2428`, fundo `#15181b` |
| `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` (180), `icon-32.png` | gerados do `icon.svg` (que continua sendo o favicon principal). Para regenerar, renderize o `icon.svg` nesses tamanhos; o maskable e o da Apple têm fundo âmbar cheio com o “W_” reduzido para a zona segura |
| `sw.js` | service worker no escopo `/`. HTML: rede primeiro, sem rede usa a última cópia do shell. CSS/JS/ícones do próprio domínio: cache primeiro (os links levam `?v=<versão>`). **Nunca** intercepta `/api/*`, métodos que não sejam GET nem outros domínios (fontes do Google seguem pelo navegador). `VERSION` é trocada pelo `publicar.sh` a cada publicação e os caches `writer-*` antigos são apagados na ativação |
| `pwa.js` | registra o service worker e cria o botão de recolher a faixa de ferramentas no celular (sem script inline: a CSP é `script-src 'self'`) |

- **Caddy** (`deploy/vps/writer.caddy`): `/sw.js` e `/manifest.webmanifest` com `no-cache`; o manifesto sai com `Content-Type: application/manifest+json` (o Caddy não conhece a extensão); `pwa.js` entra no cache imutável versionado; ícones com 7 dias. A CSP já tem `manifest-src 'self'` e `worker-src 'self' blob:`.
- **Sem rede**: o aplicativo abre (o shell vem do cache), mas o acesso ainda depende do servidor: sem conexão a tela de entrada mostra “Servidor indisponível — Tentar de novo”. Quem já está com o editor aberto continua trabalhando e envia quando a rede volta (ver “Sem conexão” acima).
- **Layout de celular** (fim de `writer.css`, bloco `[celular]`; vale para largura ≤ 760 px ou celular deitado com altura ≤ 500 px): barra superior e barra de status roláveis na horizontal, sem cortar o avatar; em pé (≤ 480 px) as ações vão para uma segunda linha; a faixa de ferramentas vira uma linha única rolável, sem rótulos de grupo, e recolhe pelo botão ˄ à direita das abas (no celular deitado começa recolhida; a escolha fica salva); tocar numa aba reabre as ferramentas. Botões com no mínimo 40 px, campos com fonte de 16 px (sem zoom automático no iOS), painéis laterais como gaveta sobre o documento, página ajustada à largura e margens de área segura (notch). O layout de computador não muda.

