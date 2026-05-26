# ZS Builder

Chat de IA para criar sites e SaaS automaticamente com preview ao vivo ao lado.

## O que existe agora

- Chat principal para descrever o site ou SaaS.
- Gerador local inicial em `src/lib/ai-builder/generator.ts`.
- API `POST /api/ai/build` para criar o projeto a partir do prompt.
- Preview seguro via `iframe srcDoc` com `sandbox`.
- Botões funcionais para gerar, limpar, alternar desktop/mobile, copiar HTML e exportar HTML.

## Comandos

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
```

## Estrutura

```text
src/app/page.tsx              entrada da aplicação
src/components/ai-builder-app.tsx
src/app/api/ai/build/route.ts
src/lib/ai-builder/generator.ts
```

## Próximo passo natural

O gerador atual é local e determinístico para não depender de chave externa. A próxima evolução é trocar o motor em `generator.ts` por uma integração de modelo real no backend, mantendo a mesma API e o mesmo preview.
