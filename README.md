# ZS Ferramenta

Chat de IA para criar sites, SaaS e sistemas automaticamente com preview ao vivo ao lado.

## O que existe agora

- Tela inicial preta com grid neon, login/cadastro local e onboarding em 5 passos.
- Chat principal para criar projetos e pedir edicoes em linguagem natural.
- Gerador local em `src/lib/ai-builder/generator.ts` com modos conversa, criacao e edicao.
- API `POST /api/ai/chat` para conversar, criar e editar o projeto atual.
- API `POST /api/ai/build` preservada para compatibilidade.
- Conta local com 500 tokens iniciais, consumo por uso e reset semanal.
- Modal de planos preparado para conectar Mercado Pago no backend.
- Preview seguro via `iframe srcDoc` com `sandbox`.
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
src/app/api/billing/mercado-pago/route.ts
src/lib/ai-builder/generator.ts
```

## Proximo passo natural

O gerador atual e local e deterministico para nao depender de chave externa. Para login real multi-dispositivo, tokens persistentes e pagamento real, conecte banco no Vercel/Neon/Supabase e use `MERCADO_PAGO_ACCESS_TOKEN` no Route Handler de billing.
