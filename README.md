# ZS Ferramenta

Chat de IA para criar sites, SaaS e sistemas automaticamente com preview ao vivo ao lado.

## O que existe agora

- Tela inicial preta com grid neon, login/cadastro local e onboarding em 5 passos.
- Chat principal para criar projetos e pedir edicoes em linguagem natural.
- Botao `Criar projeto` com briefing inicial: nome da empresa, WhatsApp, email, nicho e cor principal.
- Gerador local em `src/lib/ai-builder/generator.ts` com modos conversa, criacao e edicao.
- Motor externo opcional com OpenRouter, OpenAI, Anthropic, Gemini, DeepSeek, Qwen, Llama e Mistral.
- Selecao de modelo Auto/Rapido/Equilibrado/Avancado e agentes Arquiteto, Designer, Programador, QA e SEO.
- Seletor de modelos gratis do OpenRouter nas configuracoes do app.
- Memoria local de projetos e biblioteca de componentes em `.zs/builder-memory.json`.
- API `POST /api/ai/chat` para conversar, criar e editar o projeto atual.
- API `POST /api/ai/build` preservada para compatibilidade.
- Conta local com 500 tokens iniciais, consumo por uso e reset semanal.
- Modal de planos preparado para conectar Mercado Pago no backend.
- Preview seguro via `iframe srcDoc` com `sandbox`.
- Sites gerados usam imagens gratuitas do Unsplash por nicho quando ha correspondencia.
- Preview redimensionavel, limite de metade da tela, desktop/mobile e tela cheia.
- Arquivos sugeridos aparecem dentro do chat depois de cada geracao.

## Comandos

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
```

## Estrutura

```text
src/app/page.tsx
src/components/ai-builder-app.tsx
src/app/api/ai/chat/route.ts
src/app/api/ai/build/route.ts
src/app/api/ai/models/route.ts
src/app/api/billing/mercado-pago/route.ts
src/lib/ai-builder/generator.ts
src/lib/ai-builder/external-ai.ts
src/lib/ai-builder/project-memory.ts
```

## Proximo passo natural

Copie `.env.example` para `.env.local` e configure pelo menos uma chave de IA externa para ativar modelos reais. Para teste gratis, use `OPENROUTER_API_KEY` com `ZS_AI_FREE_MODE=true`; o backend usara `openrouter/free`. Sem chave, o fallback local continua funcionando. Para login real multi-dispositivo, tokens persistentes e pagamento real, conecte banco no Vercel/Neon/Supabase e use `MERCADO_PAGO_ACCESS_TOKEN` no Route Handler de billing.

Mais detalhes: `docs/ai-engine.md`.
