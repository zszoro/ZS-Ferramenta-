# AGENTS.md - ZS Builder

Chame o usuário de **zs**.

Se estiver mexendo em um projeto que envolva site e alterar código do site, faça commit no repositório citado pelo usuário quando a tarefa pedir commit.

## Produto

ZS Builder é uma interface simples: chat à esquerda, preview ao vivo à direita.

O objetivo atual é criar sites e SaaS automaticamente a partir de uma conversa, sem painel pesado e sem botões decorativos que não executam ações reais.

## Arquitetura

- Next.js 16 App Router.
- React 19 com TypeScript.
- Tailwind CSS 4.
- UI principal em `src/components/ai-builder-app.tsx`.
- API de geração em `src/app/api/ai/build/route.ts`.
- Motor local de geração em `src/lib/ai-builder/generator.ts`.

## Regras do Projeto

- A primeira tela deve ser o produto utilizável, não uma landing page.
- Mantenha poucos controles e garanta que todo botão visível tenha ação real.
- O preview deve atualizar quando a IA gerar um projeto.
- HTML gerado deve rodar em `iframe` com `sandbox`.
- Não exponha tokens no frontend.
- Integrações com modelos reais devem ficar em Route Handlers no backend.
- Antes de commitar, rode `npm run lint`, `npm run typecheck` e `npm run build`.
