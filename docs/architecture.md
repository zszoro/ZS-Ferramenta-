# Arquitetura - ZS Ferramenta

## Fluxo principal

```mermaid
flowchart LR
  A["Landing + login local"] --> B["Onboarding"]
  B --> C["Chat da IA"]
  C --> D["Criar projeto ou mensagem livre"]
  D --> E["POST /api/ai/chat"]
  E --> F["Motor local"]
  F --> G["Resposta"]
  F --> H["Projeto gerado/editado"]
  H --> I["Preview iframe sandbox"]
  H --> J["Arquivos no chat"]
```

## Pecas principais

- `AiBuilderApp`: controla landing, auth local, onboarding, chat, preview, tokens, planos, configuracoes e conta.
- `CreateProjectModal`: coleta nome da empresa, WhatsApp, email, nicho e cor principal antes de gerar.
- `respondToBuilderMessage`: interpreta conversa normal, criacao de projeto e edicao do projeto atual.
- `buildProjectFromBrief`: gera site a partir do briefing estruturado.
- `buildProjectFromPrompt`: gera a primeira versao do site/SaaS.
- `POST /api/ai/chat`: contrato principal para chat, criacao e edicao.
- `POST /api/ai/build`: rota preservada para compatibilidade com chamadas antigas.
- `POST /api/billing/mercado-pago`: ponto preparado para criar preferencias reais do Mercado Pago.

## Estado atual

- Autenticacao, perfis salvos, tokens e configuracoes funcionam via `localStorage`.
- Cada conta nova recebe 500 tokens e o reset semanal e calculado no cliente.
- O preview continua isolado com `iframe sandbox`.
- O motor de IA e local e deterministico para manter o deploy funcionando sem API key.
- A geracao de sites usa imagens gratuitas do Unsplash por nicho, com fallback de negocios digitais.

## Para producao real

- Persistir usuarios, projetos, tokens, planos e sessoes em Vercel Postgres, Neon ou Supabase.
- Trocar senha local por auth segura no backend.
- Criar preferencias reais do Mercado Pago usando `MERCADO_PAGO_ACCESS_TOKEN`.
- Conectar um modelo real no Route Handler, mantendo segredos somente no backend.
