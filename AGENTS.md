# AGENTS.md - ZS Ferramenta

Chame o usuario de **zs**.

Se estiver mexendo em um projeto que envolva site e alterar codigo do site, faca commit no repositorio citado pelo usuario quando a tarefa pedir commit.

## Produto

ZS Ferramenta e uma interface simples e funcional: chat de IA ocupando a tela e preview ao vivo no lado direito.

O objetivo atual e criar sites, SaaS e sistemas automaticamente a partir de uma conversa, sem painel pesado e sem botoes decorativos que nao executam acoes reais.

## Arquitetura

- Next.js 16 App Router.
- React 19 com TypeScript.
- Tailwind CSS 4.
- UI principal em `src/components/ai-builder-app.tsx`.
- API principal em `src/app/api/ai/chat/route.ts`.
- API legada de geracao em `src/app/api/ai/build/route.ts`.
- Motor local de geracao e edicao em `src/lib/ai-builder/generator.ts`.
- Billing preparado em `src/app/api/billing/mercado-pago/route.ts`.

## Regras do Projeto

- A primeira tela deve ser o produto utilizavel, nao uma landing page vazia.
- Mantenha poucos controles e garanta que todo botao visivel tenha acao real.
- O preview deve atualizar quando a IA gerar ou editar um projeto.
- HTML gerado deve rodar em `iframe` com `sandbox`.
- Nao exponha tokens, secrets ou credenciais no frontend.
- Integracoes com modelos reais devem ficar em Route Handlers no backend.
- Login/tokens locais sao demo funcional; producao real precisa de banco e sessao segura.
- Antes de commitar, rode `npm run lint`, `npm run typecheck` e `npm run build`.
