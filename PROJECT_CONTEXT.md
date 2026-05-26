# PROJECT_CONTEXT.md - ZS Ferramenta

## Produto

ZS Ferramenta e uma plataforma de IA desenvolvedora com chat, preview vivo e geracao de sites/SaaS.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Vercel

## Fluxo Atual

1. Usuario entra na plataforma.
2. Cria ou acessa uma conta local.
3. Passa briefing no modal Criar projeto.
4. API `/api/ai/chat` chama o motor local.
5. Motor gera projeto, arquivos sugeridos e HTML de preview.
6. Preview renderiza em iframe sandbox.
7. Usuario pede edicoes em linguagem natural.

## Evolucao Planejada

- Trocar auth local por sessao segura.
- Persistir usuarios, tokens, projetos e historico em Postgres/Supabase.
- Conectar modelo real no backend.
- Expandir RAG para indexar repositorios GitHub e gerar embeddings reais.
- Adicionar editor Monaco, file explorer e terminal integrado.
