# API_PATTERNS.md - Padroes de API

## Rotas Atuais

- `POST /api/ai/chat`: recebe mensagem, projeto atual e briefing opcional.
- `GET|POST /api/ai/context`: busca contexto RAG local.
- `POST /api/billing/mercado-pago`: placeholder seguro para checkout real.

## Contratos

- Toda resposta deve conter `ok`.
- Erros retornam `{ ok: false, error }`.
- Segredos ficam somente em Route Handlers.
- Frontend nunca recebe token de provider, Mercado Pago ou banco.

## Futuro

- `POST /api/ai/index`: indexar arquivos permitidos.
- `POST /api/ai/deploy`: acionar deploy aprovado pelo usuario.
- `POST /api/projects`: persistir projeto e historico.
- `POST /api/editor/apply`: aplicar patch aprovado.
