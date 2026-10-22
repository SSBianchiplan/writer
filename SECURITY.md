# Política de segurança

## Versões cobertas

Apenas a versão em produção em https://writer.gplansis.com e a branch `main` deste repositório recebem correções de segurança.

## Como relatar uma vulnerabilidade

**Não abra issue pública.** Escreva para **contato@gplansis.com** com o assunto `[segurança] GPlanSiS|Writer` e inclua:

- descrição do problema e impacto esperado;
- passos para reproduzir (de preferência numa instalação local com dados fictícios);
- versão/commit e navegador, se for relevante.

Respondemos em até 5 dias úteis confirmando o recebimento e combinamos o prazo de correção e divulgação. Pedimos que não acesse dados de outras pessoas, não degrade o serviço e não divulgue o problema antes da correção.

## Boas práticas para quem instala

- Nunca publique o `.env`; `WRITER_SEGREDO` cifra a chave da IA guardada no banco — perdê-lo exige recolar a chave.
- Mantenha `WRITER_COOKIE_SEGURO=1` em produção (HTTPS).
- Use os cabeçalhos de segurança e a CSP de `deploy/vps/writer.caddy`.
- O segredo de integração com o GPlanSiS|Docs (`WRITER_DOCS_SEGREDO`) deve ser longo, aleatório e exclusivo.
