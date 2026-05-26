# ZS Ferramenta

Sistema de IA desenvolvedora full stack para transformar repositórios em uma base de conhecimento viva, recuperar padrões por RAG e orquestrar agentes especializados.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Route Handlers em Node.js
- RAG local com embeddings vetoriais por hashing

## Comandos

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run index:workspace
```

## RAG Local

O índice persistente fica em `.zs/knowledge-base.json`.

```bash
npm run index:workspace
```

Por segurança, a aplicação indexa apenas o workspace atual por padrão. Para permitir outros repositórios locais:

```bash
$env:ZS_ALLOWED_INDEX_ROOTS="C:\caminho\repo1;C:\caminho\repo2"
npm run index:workspace -- --root C:\caminho\repo1
```

## APIs

- `GET /api/knowledge/index`: retorna status do índice.
- `POST /api/knowledge/index`: cria índice para roots permitidos.
- `POST /api/knowledge/search`: busca semântica/contextual na base.
- `POST /api/agents/plan`: gera plano multiagente usando evidências RAG.

## Estrutura

```text
src/app                  rotas, layout e APIs
src/components           interface da plataforma
src/data                 agentes, prompts e dados de produto
src/lib/rag              indexação, embeddings, busca e store
src/lib/agents           seleção e orquestração de agentes
scripts                  comandos operacionais
docs                     documentação técnica
```

## Fluxo De Trabalho

1. Indexe o workspace.
2. Busque componentes, APIs e padrões similares.
3. Gere um plano multiagente.
4. Implemente com TypeScript estrito.
5. Rode lint, typecheck e build.
6. Verifique preview quando houver UI.
7. Faça commit com escopo claro.
