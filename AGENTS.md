# AGENTS.md - ZS Ferramenta

Chame o usuário de **zs**.

Se estiver mexendo em um projeto que envolva site e alterar código do site, faça commit no repositório citado pelo usuário quando a tarefa pedir commit.

## Arquitetura Encontrada

- Aplicação Next.js 16 com App Router em `src/app`.
- React 19 e TypeScript estrito.
- Tailwind CSS 4 em `src/app/globals.css`.
- APIs internas via Route Handlers em `src/app/api`.
- Motor RAG local em `src/lib/rag`.
- Orquestração multiagente em `src/lib/agents`.
- Interface principal em `src/components/zs-platform.tsx`.
- Dados de produto e agentes em `src/data/platform.ts`.

## Padrões Detectados

- O produto deve funcionar como cockpit de IA desenvolvedora, não como landing page.
- A primeira tela deve trazer chat, indexação, agentes, memória, deploy e resultados RAG.
- UI profissional, escura, densa e operacional, com acentos cyan, emerald, amber e rose.
- Controles principais devem ser visíveis: buscar, indexar repositório atual e gerar plano multiagente.
- Segurança é padrão: secrets não vão para o frontend e indexação fora do workspace exige `ZS_ALLOWED_INDEX_ROOTS`.

## Convenções

- Use Server Components por padrão; use `"use client"` apenas onde há estado, eventos ou browser APIs.
- APIs ficam em `src/app/api/**/route.ts` com `export const runtime = "nodejs"` quando usam filesystem.
- Código compartilhado fica em `src/lib`.
- Dados estáticos de UI ficam em `src/data`.
- Scripts operacionais ficam em `scripts`.
- Evite duplicar componentes; busque no RAG e adapte antes de criar.
- Ignore `node_modules`, `.next`, `dist`, `build`, `coverage`, logs, caches e locks na indexação.

## Fluxo Recomendado

1. Rodar `npm run index:workspace` para criar ou atualizar `.zs/knowledge-base.json`.
2. Consultar `/api/knowledge/search` antes de criar componentes, APIs ou layouts.
3. Gerar plano por `/api/agents/plan` para selecionar agentes e evidências.
4. Implementar mudanças pequenas, tipadas e verificáveis.
5. Rodar `npm run lint`, `npm run typecheck` e `npm run build`.
6. Para mudanças visuais, abrir preview local e verificar desktop/mobile.
7. Fazer commit quando a tarefa envolver alteração de site e o usuário pedir commit.

## Componentes Importantes

- `ZSPlatform`: app shell completo com chat, RAG, agentes, memória e deploy.
- `CapabilityGrid`: capacidades centrais da ferramenta.
- `ReuseAndRoadmap`: artefatos reutilizáveis e fases futuras.
- `AgentsPanel`: seleção dos agentes especializados.
- `PlanPanel`: execução do planejamento multiagente.

## Padrões RAG

- `buildKnowledgeIndex` varre roots permitidos e gera chunks por linhas.
- `embedText` cria embeddings vetoriais locais por hashing normalizado.
- `searchKnowledgeIndex` combina similaridade vetorial, overlap de tokens, caminho e sinais arquiteturais.
- `.zs/knowledge-base.json` é a memória persistente local do workspace.
- Para indexar outros repositórios, configure `ZS_ALLOWED_INDEX_ROOTS` com caminhos separados por `;`.

## Agentes

- UI Agent: design, UX, responsividade, acessibilidade e animações.
- Backend Agent: APIs, banco, auth, permissões e segurança.
- Refactor Agent: limpeza, modularização, performance e duplicações.
- Debug Agent: erros, logs, stack traces e regressões.
- DevOps Agent: Docker, Vercel, CI/CD, deploy e rollback.
- Vision Agent: prints, OCR, reconstrução visual e comparação de UI.
- Planning Agent: arquitetura, sequência de execução, riscos e critérios de pronto.

## Regras de Desenvolvimento

- Nunca exponha tokens, secrets ou `.env` no frontend.
- Não faça varredura arbitrária do disco sem allowlist explícita.
- Não duplique componentes sem busca prévia.
- Preserve acessibilidade de botões, inputs e estados de carregamento.
- Use mensagens de erro úteis nas APIs.
- Documente decisões que afetam arquitetura ou operação.
