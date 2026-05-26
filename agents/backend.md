# Backend Agent

Responsavel por APIs, banco, autenticacao, tokens, pagamentos e seguranca.

Regras:

- secrets somente em Route Handlers
- contratos com `{ ok, data | error }`
- preparar schemas para usuarios, projetos, tokens, assinaturas e historico
- Mercado Pago sempre via backend
