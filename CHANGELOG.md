# Histórico de mudanças

Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [1.1] — 2026-10

### Versão servidor (https://writer.gplansis.com)
- Login com sessão, papéis (Administrador, Editor, Revisor, Leitor) e permissões individuais.
- Documentos e notas guardados em PostgreSQL, com histórico de até 40 versões, lixeira de 30 dias, compartilhamento por equipe ou pessoa e trava de edição.
- Trabalho sem conexão com cópia de trabalho no navegador e resolução de conflitos sem perda.
- Configurações: perfil com avatar, preferências, usuários e permissões, governança de documentos, registro de acessos.
- Assistente IA com chave cifrada no servidor e respostas em streaming.
- Integração com o GPlanSiS|Docs (envio de PDF/.docx à lista mestra, revisões, comentários e entrada única).
- Aplicativo instalável (PWA) e layout dedicado para celular.

### Editor
- Abertura e gravação de .docx, .doc, .odt, .rtf, .txt, .md, .html; CSV/TSV como tabela; PDF pela impressão; backup .json.
- Versões arquivo único `offline` (fontes e bibliotecas embutidas) e `online`.
