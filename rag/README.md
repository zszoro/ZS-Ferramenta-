# /rag

Sistema RAG local.

Estado atual:

- busca semantica deterministica baseada em tokens
- documentos base em `src/lib/ai-builder/rag.ts`
- endpoint `GET|POST /api/ai/context`

Proximo passo:

- indexar arquivos reais do workspace
- persistir chunks em `/vector-db`
- trocar vetores locais por embeddings reais no backend
- excluir `node_modules`, `.next`, `dist`, `build`, `coverage`, logs e caches
