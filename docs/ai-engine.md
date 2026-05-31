# Motor de IA avancado

ZS Builder usa um motor hibrido:

- Provedores externos quando houver chave no backend.
- Fallback local deterministico quando nao houver chave ou quando todas as chamadas falharem.
- RAG local, memoria em `.zs/builder-memory.json` e biblioteca de componentes reutilizaveis.
- Selecao de modelo por tarefa e modo: Auto, Rapido, Equilibrado e Avancado.

## Provedores suportados

- OpenRouter
- OpenAI
- Anthropic Claude
- Google Gemini
- DeepSeek
- Qwen
- Llama via endpoint OpenAI-compatible
- Mistral

Configure as variaveis em `.env.local` usando `.env.example` como base. As chaves nunca devem usar `NEXT_PUBLIC_`.

## Roteamento automatico

O backend classifica a tarefa antes da chamada:

- Conversa simples: modelo rapido.
- Geracao/planejamento complexo: modelo avancado.
- Codigo e bugs: modelo de codigo.
- SEO, QA e design: modelo equilibrado ou avancado conforme o modo escolhido.

Em modo Auto a escolha e feita pelo backend. Em caso de falha, o motor local continua gerando preview e arquivos.

## IA gratis enquanto estiver em teste

O caminho gratuito mais simples e usar o OpenRouter Free Models Router:

1. Crie uma chave em OpenRouter.
2. Coloque `OPENROUTER_API_KEY` no `.env.local`.
3. Mantenha `ZS_AI_FREE_MODE=true`.

Com isso, o backend usa `openrouter/free`, que roteia para modelos gratuitos disponiveis. A disponibilidade e os limites podem variar, entao o fallback local continua ativo para nao quebrar o chat.

O app tambem expõe `GET /api/ai/models`, que busca a lista atual de modelos gratuitos no OpenRouter e alimenta o seletor `Modelo gratis` nas configuracoes da conta.

Para usar modelos pagos ou especificos depois, defina `ZS_AI_FREE_MODE=false` e configure `OPENROUTER_MODEL_RAPIDO`, `OPENROUTER_MODEL_EQUILIBRADO`, `OPENROUTER_MODEL_AVANCADO` e `OPENROUTER_MODEL_CODE`.

## Multiagente

Para tarefas complexas, o motor chama agentes em paralelo:

- Arquiteto: estrutura, banco, APIs e escalabilidade.
- Designer: layout, UX, UI e animacoes.
- Programador: codigo, componentes e logica.
- QA: bugs, rotas, formularios e APIs.
- SEO: sitemap, meta tags, performance e indexacao.

As respostas dos agentes entram no blueprint salvo em `docs/ai-engine-plan.md` no ZIP gerado.

## Memoria e componentes

A cada projeto criado ou editado, a API registra:

- projetos criados;
- alteracoes realizadas;
- preferencias detectadas;
- componentes reutilizaveis;
- arquivos gerados.

Essa memoria local fica em `.zs/builder-memory.json`. Em producao, substitua por banco e sessao segura.
