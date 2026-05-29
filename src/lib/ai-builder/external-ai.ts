import { buildProjectMemoryContext } from "./project-memory";
import type {
  AiAgentResult,
  AiAgentRole,
  AiEnhancement,
  AiEngineReport,
  AiGenerationBlueprint,
  AiModelMode,
  AiProviderId,
  AiTaskKind,
} from "./engine-types";

type BuilderIntent = "chat" | "create" | "edit";

type ProviderProtocol = "openai-compatible" | "anthropic" | "gemini";

type ProviderConfig = {
  id: AiProviderId;
  label: string;
  protocol: ProviderProtocol;
  apiKeyEnv: string[];
  baseUrlEnv?: string;
  defaultBaseUrl: string;
  modelEnvPrefix: string;
  defaults: Record<Exclude<AiModelMode, "auto"> | "code", string>;
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ProviderCallResult = {
  text: string;
  provider: AiProviderId;
  model: string;
  estimatedTokenCost: number;
};

type ProviderCandidate = {
  config: ProviderConfig;
  apiKey: string;
  baseUrl: string;
  model: string;
};

const providerConfigs: ProviderConfig[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    protocol: "openai-compatible",
    apiKeyEnv: ["OPENROUTER_API_KEY"],
    baseUrlEnv: "OPENROUTER_BASE_URL",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    modelEnvPrefix: "OPENROUTER",
    defaults: {
      rapido: "openai/gpt-4o-mini",
      equilibrado: "anthropic/claude-3.5-sonnet",
      avancado: "openai/gpt-4.1",
      code: "deepseek/deepseek-chat",
    },
  },
  {
    id: "openai",
    label: "OpenAI",
    protocol: "openai-compatible",
    apiKeyEnv: ["OPENAI_API_KEY"],
    baseUrlEnv: "OPENAI_BASE_URL",
    defaultBaseUrl: "https://api.openai.com/v1",
    modelEnvPrefix: "OPENAI",
    defaults: {
      rapido: "gpt-4o-mini",
      equilibrado: "gpt-4.1-mini",
      avancado: "gpt-4.1",
      code: "gpt-4.1",
    },
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    protocol: "anthropic",
    apiKeyEnv: ["ANTHROPIC_API_KEY"],
    baseUrlEnv: "ANTHROPIC_BASE_URL",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    modelEnvPrefix: "ANTHROPIC",
    defaults: {
      rapido: "claude-3-5-haiku-latest",
      equilibrado: "claude-sonnet-4-5",
      avancado: "claude-opus-4-1",
      code: "claude-sonnet-4-5",
    },
  },
  {
    id: "google",
    label: "Google Gemini",
    protocol: "gemini",
    apiKeyEnv: ["GOOGLE_GEMINI_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY"],
    baseUrlEnv: "GOOGLE_GEMINI_BASE_URL",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    modelEnvPrefix: "GOOGLE",
    defaults: {
      rapido: "gemini-2.5-flash",
      equilibrado: "gemini-2.5-pro",
      avancado: "gemini-2.5-pro",
      code: "gemini-2.5-pro",
    },
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    protocol: "openai-compatible",
    apiKeyEnv: ["DEEPSEEK_API_KEY"],
    baseUrlEnv: "DEEPSEEK_BASE_URL",
    defaultBaseUrl: "https://api.deepseek.com",
    modelEnvPrefix: "DEEPSEEK",
    defaults: {
      rapido: "deepseek-chat",
      equilibrado: "deepseek-chat",
      avancado: "deepseek-reasoner",
      code: "deepseek-chat",
    },
  },
  {
    id: "qwen",
    label: "Qwen",
    protocol: "openai-compatible",
    apiKeyEnv: ["QWEN_API_KEY", "DASHSCOPE_API_KEY"],
    baseUrlEnv: "QWEN_BASE_URL",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    modelEnvPrefix: "QWEN",
    defaults: {
      rapido: "qwen-turbo",
      equilibrado: "qwen-plus",
      avancado: "qwen-max",
      code: "qwen-coder-plus",
    },
  },
  {
    id: "llama",
    label: "Llama",
    protocol: "openai-compatible",
    apiKeyEnv: ["LLAMA_API_KEY"],
    baseUrlEnv: "LLAMA_BASE_URL",
    defaultBaseUrl: "http://localhost:11434/v1",
    modelEnvPrefix: "LLAMA",
    defaults: {
      rapido: "llama-3.2-3b-instruct",
      equilibrado: "llama-3.3-70b-instruct",
      avancado: "llama-3.3-70b-instruct",
      code: "codellama",
    },
  },
  {
    id: "mistral",
    label: "Mistral",
    protocol: "openai-compatible",
    apiKeyEnv: ["MISTRAL_API_KEY"],
    baseUrlEnv: "MISTRAL_BASE_URL",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    modelEnvPrefix: "MISTRAL",
    defaults: {
      rapido: "mistral-small-latest",
      equilibrado: "mistral-medium-latest",
      avancado: "mistral-large-latest",
      code: "codestral-latest",
    },
  },
];

const defaultProviderOrder: AiProviderId[] = [
  "openrouter",
  "openai",
  "anthropic",
  "google",
  "deepseek",
  "qwen",
  "mistral",
  "llama",
];

const agentLabels: Record<AiAgentRole, string> = {
  arquiteto: "Arquiteto",
  designer: "Designer",
  programador: "Programador",
  qa: "QA",
  seo: "SEO",
};

export async function enhanceBuilderRequest(input: {
  message: string;
  intent: BuilderIntent;
  modelMode?: AiModelMode | string;
  hasProject: boolean;
  hasBrief: boolean;
  visionSummary?: string | null;
}): Promise<AiEnhancement> {
  const task = classifyAiTask(input.message, input.intent);
  const modelMode = normalizeModelMode(input.modelMode);
  const resolvedMode = resolveModelMode(modelMode, task);
  const memoryContext = await buildProjectMemoryContext(input.message);
  const available = getAvailableProviderCandidates(task, resolvedMode);
  const baseReport: AiEngineReport = {
    usedExternal: false,
    task,
    modelMode,
    resolvedMode,
    reason: "Sem chamada externa executada.",
    calls: 0,
    agents: [],
    estimatedTokenCost: estimateLocalTokenCost(input.message, task),
  };

  if (process.env.ZS_AI_EXTERNAL_ENABLED === "false") {
    return {
      blueprint: null,
      memoryContext,
      report: {
        ...baseReport,
        fallbackReason: "ZS_AI_EXTERNAL_ENABLED=false.",
      },
    };
  }

  if (!available.length) {
    return {
      blueprint: null,
      memoryContext,
      report: {
        ...baseReport,
        fallbackReason: "Nenhuma chave de provedor externo configurada no backend.",
      },
    };
  }

  try {
    const mainResult = await callWithFallback({
      candidates: available,
      messages: buildBlueprintMessages({ ...input, task, resolvedMode, memoryContext }),
      task,
      maxTokens: task === "chat" ? 900 : 1600,
      temperature: task === "code" || task === "bugfix" ? 0.25 : 0.45,
    });
    const blueprint = parseBlueprint(mainResult.text);
    const agentResults = await runAgentsIfNeeded({
      message: input.message,
      task,
      resolvedMode,
      memoryContext,
      available,
      blueprint,
    });
    const mergedBlueprint = mergeAgentContext(blueprint, agentResults);
    const agentCost = agentResults.reduce((total, agent) => total + estimateLocalTokenCost(agent.output, task), 0);

    return {
      blueprint: mergedBlueprint,
      memoryContext,
      report: {
        usedExternal: true,
        task,
        modelMode,
        resolvedMode,
        provider: mainResult.provider,
        model: mainResult.model,
        reason: buildSelectionReason(task, resolvedMode, mainResult.provider, mainResult.model),
        calls: 1 + agentResults.filter((agent) => agent.ok || agent.error).length,
        agents: agentResults,
        estimatedTokenCost: Math.max(1, mainResult.estimatedTokenCost + agentCost),
      },
    };
  } catch (caught) {
    return {
      blueprint: null,
      memoryContext,
      report: {
        ...baseReport,
        fallbackReason: caught instanceof Error ? caught.message : "Falha desconhecida na IA externa.",
      },
    };
  }
}

function classifyAiTask(message: string, intent: BuilderIntent): AiTaskKind {
  const lower = normalize(message);

  if (lower.includes("seo") || lower.includes("sitemap") || lower.includes("indexacao") || lower.includes("meta tag")) {
    return "seo";
  }
  if (
    lower.includes("erro") ||
    lower.includes("bug") ||
    lower.includes("quebrad") ||
    lower.includes("typescript") ||
    lower.includes("prisma") ||
    lower.includes("import") ||
    lower.includes("nao funciona")
  ) {
    return "bugfix";
  }
  if (
    lower.includes("codigo") ||
    lower.includes("component") ||
    lower.includes("api") ||
    lower.includes("schema") ||
    lower.includes("migration") ||
    looksLikeCode(message)
  ) {
    return "code";
  }
  if (lower.includes("arquitet") || lower.includes("banco") || lower.includes("planej") || lower.includes("escala")) {
    return "planning";
  }
  if (lower.includes("layout") || lower.includes("design") || lower.includes("ux") || lower.includes("ui")) {
    return "design";
  }
  if (lower.includes("teste") || lower.includes("validar") || lower.includes("formulario") || lower.includes("rota")) {
    return "qa";
  }
  if (intent === "create") return "generation";
  if (intent === "edit") return "edit";
  return "chat";
}

function normalizeModelMode(mode: AiModelMode | string | undefined): AiModelMode {
  if (mode === "rapida" || mode === "rapido") return "rapido";
  if (mode === "premium" || mode === "avancada" || mode === "avancado") return "avancado";
  if (mode === "equilibrada" || mode === "equilibrado") return "equilibrado";
  return "auto";
}

function resolveModelMode(mode: AiModelMode, task: AiTaskKind): Exclude<AiModelMode, "auto"> {
  if (mode !== "auto") return mode;
  if (task === "chat") return "rapido";
  if (task === "generation" || task === "planning" || task === "bugfix") return "avancado";
  return "equilibrado";
}

function getAvailableProviderCandidates(task: AiTaskKind, mode: Exclude<AiModelMode, "auto">) {
  const preferredOrder = parseProviderOrder(process.env.ZS_AI_PROVIDER_ORDER);
  const tier = task === "code" || task === "bugfix" ? "code" : mode;
  return preferredOrder
    .map((id) => providerConfigs.find((provider) => provider.id === id))
    .filter((provider): provider is ProviderConfig => Boolean(provider))
    .map((config) => toProviderCandidate(config, tier))
    .filter((candidate): candidate is ProviderCandidate => Boolean(candidate));
}

function parseProviderOrder(value: string | undefined) {
  if (!value) return defaultProviderOrder;
  const requested = value
    .split(",")
    .map((item) => normalize(item.trim()))
    .filter(Boolean);
  const supported = requested.filter((item): item is AiProviderId =>
    defaultProviderOrder.includes(item as AiProviderId),
  );
  return supported.length ? supported : defaultProviderOrder;
}

function toProviderCandidate(
  config: ProviderConfig,
  tier: Exclude<AiModelMode, "auto"> | "code",
): ProviderCandidate | null {
  const apiKey = firstEnv(config.apiKeyEnv);

  if (!apiKey && config.id !== "llama") return null;
  if (config.id === "llama" && !apiKey && !process.env.LLAMA_ALLOW_NO_KEY) return null;

  return {
    config,
    apiKey: apiKey || "local-llama",
    baseUrl: trimTrailingSlash((config.baseUrlEnv && process.env[config.baseUrlEnv]) || config.defaultBaseUrl),
    model: selectModel(config, tier),
  };
}

function selectModel(config: ProviderConfig, tier: Exclude<AiModelMode, "auto"> | "code") {
  const upperTier = tier.toUpperCase();
  const keys = [
    `${config.modelEnvPrefix}_MODEL_${upperTier}`,
    `${config.modelEnvPrefix}_${upperTier}_MODEL`,
    `${config.modelEnvPrefix}_MODEL`,
    "ZS_AI_MODEL",
  ];
  return firstEnv(keys) || config.defaults[tier];
}

function buildBlueprintMessages(input: {
  message: string;
  intent: BuilderIntent;
  task: AiTaskKind;
  resolvedMode: Exclude<AiModelMode, "auto">;
  hasProject: boolean;
  hasBrief: boolean;
  visionSummary?: string | null;
  memoryContext: string;
}): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "Voce e o motor externo avancado da ZS Builder.",
        "Responda em portugues do Brasil.",
        "Transforme pedidos simples em escopo profissional para sites, SaaS e sistemas prontos para producao.",
        "Use arquiteto, designer, programador, QA, SEO e DevOps mentalmente.",
        "Nao invente credenciais e nunca coloque tokens no frontend.",
        "Responda exclusivamente com um objeto JSON valido, sem markdown.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Modo: ${input.resolvedMode}`,
        `Tarefa: ${input.task}`,
        `Intencao local: ${input.intent}`,
        `Tem projeto aberto: ${input.hasProject ? "sim" : "nao"}`,
        `Tem briefing estruturado: ${input.hasBrief ? "sim" : "nao"}`,
        input.visionSummary ? `Resumo visual: ${input.visionSummary}` : "",
        "",
        "Memoria persistida e componentes reutilizaveis:",
        input.memoryContext,
        "",
        "Pedido do usuario:",
        input.message,
        "",
        "Formato JSON esperado:",
        JSON.stringify(
          {
            professionalPrompt: "prompt expandido e objetivo para gerar ou editar o projeto",
            reply: "resposta curta ao usuario",
            projectName: "nome sugerido se existir",
            kind: "site | landing | saas | dashboard",
            industry: "nicho detectado",
            features: ["recursos finais"],
            pages: ["paginas"],
            components: ["componentes reutilizaveis"],
            apis: ["rotas/API"],
            databaseModels: ["modelos Prisma"],
            files: [
              {
                path: "docs/exemplo.md",
                language: "md",
                description: "por que este arquivo deve existir",
                content: "conteudo opcional",
              },
            ],
            architecture: ["decisoes de arquitetura"],
            design: ["decisoes UI/UX"],
            code: ["decisoes de codigo"],
            qaChecks: ["validacoes obrigatorias"],
            seo: ["metas, sitemap, performance"],
            devops: ["build, env, deploy"],
            componentLibrary: ["headers, footers, cards, dashboards, formularios, tabelas, modais, menus"],
            editNotes: ["mudancas especificas quando for edicao"],
          },
          null,
          2,
        ),
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
}

async function runAgentsIfNeeded(input: {
  message: string;
  task: AiTaskKind;
  resolvedMode: Exclude<AiModelMode, "auto">;
  memoryContext: string;
  available: ProviderCandidate[];
  blueprint: AiGenerationBlueprint;
}) {
  const roles = selectAgentRoles(input.task, input.resolvedMode, input.message);
  if (!roles.length) return [];

  const results = await Promise.allSettled(
    roles.map((role) =>
      callAgent({
        role,
        message: input.message,
        task: input.task,
        memoryContext: input.memoryContext,
        candidates: orderCandidatesForAgent(input.available, role),
        blueprint: input.blueprint,
      }),
    ),
  );

  return results.map((result, index): AiAgentResult => {
    if (result.status === "fulfilled") return result.value;
    return {
      role: roles[index],
      ok: false,
      output: "",
      error: result.reason instanceof Error ? result.reason.message : "Agente falhou.",
    };
  });
}

function selectAgentRoles(task: AiTaskKind, mode: Exclude<AiModelMode, "auto">, message: string): AiAgentRole[] {
  if (task === "chat") return [];
  if (task === "bugfix") return ["programador", "qa"];
  if (task === "seo") return ["seo", "qa"];
  if (task === "design") return ["designer", "qa"];
  if (task === "code") return mode === "avancado" ? ["arquiteto", "programador", "qa"] : ["programador", "qa"];
  if (task === "edit") return message.length > 220 ? ["designer", "programador", "qa"] : [];
  if (task === "generation" || task === "planning") {
    return mode === "avancado"
      ? ["arquiteto", "designer", "programador", "qa", "seo"]
      : ["arquiteto", "designer", "programador"];
  }
  return [];
}

async function callAgent(input: {
  role: AiAgentRole;
  message: string;
  task: AiTaskKind;
  memoryContext: string;
  candidates: ProviderCandidate[];
  blueprint: AiGenerationBlueprint;
}): Promise<AiAgentResult> {
  const result = await callWithFallback({
    candidates: input.candidates,
    task: input.task,
    maxTokens: 700,
    temperature: input.role === "designer" ? 0.55 : 0.25,
    messages: [
      {
        role: "system",
        content: [
          `Voce e o agente ${agentLabels[input.role]} da ZS Builder.`,
          "Responda com no maximo 8 bullets curtos, em portugues, focando apenas na sua responsabilidade.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `Tarefa: ${input.task}`,
          `Pedido: ${input.message}`,
          "",
          "Memoria:",
          input.memoryContext,
          "",
          "Blueprint inicial:",
          JSON.stringify(input.blueprint).slice(0, 4000),
        ].join("\n"),
      },
    ],
  });

  return {
    role: input.role,
    ok: true,
    output: result.text.trim().slice(0, 1800),
    provider: result.provider,
    model: result.model,
  };
}

function orderCandidatesForAgent(candidates: ProviderCandidate[], role: AiAgentRole) {
  const preference: Record<AiAgentRole, AiProviderId[]> = {
    arquiteto: ["anthropic", "openai", "openrouter", "mistral", "google", "qwen", "deepseek", "llama"],
    designer: ["google", "openrouter", "anthropic", "openai", "mistral", "qwen", "deepseek", "llama"],
    programador: ["deepseek", "qwen", "openai", "anthropic", "openrouter", "mistral", "google", "llama"],
    qa: ["deepseek", "openai", "anthropic", "qwen", "openrouter", "mistral", "google", "llama"],
    seo: ["openai", "mistral", "openrouter", "anthropic", "google", "qwen", "deepseek", "llama"],
  };
  const preferred = preference[role];
  return [...candidates].sort((left, right) => preferred.indexOf(left.config.id) - preferred.indexOf(right.config.id));
}

async function callWithFallback(input: {
  candidates: ProviderCandidate[];
  messages: ChatMessage[];
  task: AiTaskKind;
  maxTokens: number;
  temperature: number;
}): Promise<ProviderCallResult> {
  const errors: string[] = [];

  for (const candidate of input.candidates) {
    try {
      return await callProvider(candidate, input);
    } catch (caught) {
      errors.push(`${candidate.config.label}: ${caught instanceof Error ? caught.message : "falha desconhecida"}`);
    }
  }

  throw new Error(`Todos os provedores externos falharam. ${errors.join(" | ")}`);
}

async function callProvider(
  candidate: ProviderCandidate,
  input: {
    messages: ChatMessage[];
    maxTokens: number;
    temperature: number;
  },
): Promise<ProviderCallResult> {
  if (candidate.config.protocol === "anthropic") {
    return callAnthropic(candidate, input);
  }

  if (candidate.config.protocol === "gemini") {
    return callGemini(candidate, input);
  }

  return callOpenAiCompatible(candidate, input);
}

async function callOpenAiCompatible(
  candidate: ProviderCandidate,
  input: {
    messages: ChatMessage[];
    maxTokens: number;
    temperature: number;
  },
): Promise<ProviderCallResult> {
  const response = await fetchWithTimeout(`${candidate.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${candidate.apiKey}`,
      ...(candidate.config.id === "openrouter"
        ? {
            "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
            "X-Title": "ZS Builder",
          }
        : {}),
    },
    body: JSON.stringify({
      model: candidate.model,
      messages: input.messages,
      temperature: input.temperature,
      max_tokens: input.maxTokens,
      stream: false,
    }),
  });
  const json = await parseJsonResponse(response);
  const text = extractOpenAiText(json);

  return {
    text,
    provider: candidate.config.id,
    model: candidate.model,
    estimatedTokenCost: extractUsageCost(json, text),
  };
}

async function callAnthropic(
  candidate: ProviderCandidate,
  input: {
    messages: ChatMessage[];
    maxTokens: number;
    temperature: number;
  },
): Promise<ProviderCallResult> {
  const system = input.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const messages = input.messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
    }));
  const response = await fetchWithTimeout(`${candidate.baseUrl}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": candidate.apiKey,
      "anthropic-version": process.env.ANTHROPIC_VERSION ?? "2023-06-01",
    },
    body: JSON.stringify({
      model: candidate.model,
      system,
      messages,
      max_tokens: input.maxTokens,
      temperature: input.temperature,
    }),
  });
  const json = await parseJsonResponse(response);
  const text = extractAnthropicText(json);

  return {
    text,
    provider: candidate.config.id,
    model: candidate.model,
    estimatedTokenCost: extractUsageCost(json, text),
  };
}

async function callGemini(
  candidate: ProviderCandidate,
  input: {
    messages: ChatMessage[];
    maxTokens: number;
    temperature: number;
  },
): Promise<ProviderCallResult> {
  const system = input.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const contents = input.messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));
  const url = `${candidate.baseUrl}/models/${encodeURIComponent(candidate.model)}:generateContent?key=${encodeURIComponent(
    candidate.apiKey,
  )}`;
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents,
      generationConfig: {
        temperature: input.temperature,
        maxOutputTokens: input.maxTokens,
      },
    }),
  });
  const json = await parseJsonResponse(response);
  const text = extractGeminiText(json);

  return {
    text,
    provider: candidate.config.id,
    model: candidate.model,
    estimatedTokenCost: extractUsageCost(json, text),
  };
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = Number(process.env.ZS_AI_TIMEOUT_MS ?? 22000);
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 400)}`);
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Resposta nao-JSON: ${text.slice(0, 220)}`);
  }
}

function parseBlueprint(text: string): AiGenerationBlueprint {
  const jsonText = extractJsonObject(text);

  if (!jsonText) {
    return {
      professionalPrompt: text.slice(0, 2500),
      reply: text.slice(0, 900),
    };
  }

  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    return sanitizeBlueprint(parsed);
  } catch {
    return {
      professionalPrompt: text.slice(0, 2500),
      reply: text.slice(0, 900),
    };
  }
}

function sanitizeBlueprint(parsed: Record<string, unknown>): AiGenerationBlueprint {
  return {
    professionalPrompt: optionalString(parsed.professionalPrompt),
    reply: optionalString(parsed.reply),
    projectName: optionalString(parsed.projectName),
    kind: sanitizeKind(parsed.kind),
    industry: optionalString(parsed.industry),
    features: stringArray(parsed.features),
    pages: stringArray(parsed.pages),
    components: stringArray(parsed.components),
    apis: stringArray(parsed.apis),
    databaseModels: stringArray(parsed.databaseModels),
    architecture: stringArray(parsed.architecture),
    design: stringArray(parsed.design),
    code: stringArray(parsed.code),
    qaChecks: stringArray(parsed.qaChecks),
    seo: stringArray(parsed.seo),
    devops: stringArray(parsed.devops),
    componentLibrary: stringArray(parsed.componentLibrary),
    editNotes: stringArray(parsed.editNotes),
    files: artifactArray(parsed.files),
  };
}

function mergeAgentContext(blueprint: AiGenerationBlueprint, agents: AiAgentResult[]): AiGenerationBlueprint {
  const okAgents = agents.filter((agent) => agent.ok && agent.output.trim());
  if (!okAgents.length) return blueprint;

  const agentNotes = okAgents.map((agent) => `${agentLabels[agent.role]}: ${agent.output}`);

  return {
    ...blueprint,
    architecture: mergeStringLists(
      blueprint.architecture,
      okAgents.filter((agent) => agent.role === "arquiteto").map((agent) => agent.output),
    ),
    design: mergeStringLists(
      blueprint.design,
      okAgents.filter((agent) => agent.role === "designer").map((agent) => agent.output),
    ),
    code: mergeStringLists(
      blueprint.code,
      okAgents.filter((agent) => agent.role === "programador").map((agent) => agent.output),
    ),
    qaChecks: mergeStringLists(
      blueprint.qaChecks,
      okAgents.filter((agent) => agent.role === "qa").map((agent) => agent.output),
    ),
    seo: mergeStringLists(
      blueprint.seo,
      okAgents.filter((agent) => agent.role === "seo").map((agent) => agent.output),
    ),
    professionalPrompt: [blueprint.professionalPrompt, "Notas multiagente:", ...agentNotes]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 9000),
  };
}

function extractJsonObject(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced ?? text;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");

  if (start < 0 || end <= start) return null;
  return source.slice(start, end + 1);
}

function extractOpenAiText(json: unknown) {
  const choices = readArray(readRecord(json).choices);
  const first = readRecord(choices[0]);
  const message = readRecord(first.message);
  const content = message.content;

  if (typeof content === "string" && content.trim()) return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        const record = readRecord(item);
        return typeof record.text === "string" ? record.text : "";
      })
      .join("")
      .trim();
  }

  throw new Error("Resposta sem texto.");
}

function extractAnthropicText(json: unknown) {
  const content = readArray(readRecord(json).content);
  const text = content
    .map((item) => {
      const record = readRecord(item);
      return typeof record.text === "string" ? record.text : "";
    })
    .join("")
    .trim();

  if (!text) throw new Error("Resposta sem texto.");
  return text;
}

function extractGeminiText(json: unknown) {
  const candidates = readArray(readRecord(json).candidates);
  const first = readRecord(candidates[0]);
  const content = readRecord(first.content);
  const parts = readArray(content.parts);
  const text = parts
    .map((part) => {
      const record = readRecord(part);
      return typeof record.text === "string" ? record.text : "";
    })
    .join("")
    .trim();

  if (!text) throw new Error("Resposta sem texto.");
  return text;
}

function extractUsageCost(json: unknown, text: string) {
  const record = readRecord(json);
  const usage = readRecord(record.usage ?? record.usageMetadata);
  const promptTokens = numeric(usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokenCount);
  const completionTokens = numeric(usage.completion_tokens ?? usage.output_tokens ?? usage.candidatesTokenCount);
  const total = numeric(usage.total_tokens ?? usage.totalTokenCount);

  if (total) return Math.max(1, Math.ceil(total / 80));
  if (promptTokens || completionTokens) return Math.max(1, Math.ceil((promptTokens + completionTokens) / 80));
  return Math.max(1, Math.ceil(text.length / 320));
}

function estimateLocalTokenCost(text: string, task: AiTaskKind) {
  const base = task === "generation" ? 42 : task === "edit" ? 24 : task === "chat" ? 8 : 18;
  return Math.min(140, base + Math.ceil(text.length / 180));
}

function buildSelectionReason(
  task: AiTaskKind,
  mode: Exclude<AiModelMode, "auto">,
  provider: AiProviderId,
  model: string,
) {
  return `Tarefa ${task}; modo ${mode}; provedor ${provider}; modelo ${model}.`;
}

function firstEnv(keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 5000) : undefined;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 20)
    : undefined;
}

function artifactArray(value: unknown) {
  if (!Array.isArray(value)) return undefined;

  return value
    .map((item) => {
      const record = readRecord(item);
      const path = optionalString(record.path);
      const language = optionalString(record.language);
      const description = optionalString(record.description);
      if (!path || !language || !description) return null;

      return {
        path: path.replace(/\\/g, "/").slice(0, 140),
        language: language.slice(0, 24),
        description,
        content: optionalString(record.content),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 12);
}

function sanitizeKind(value: unknown): AiGenerationBlueprint["kind"] {
  if (value === "saas" || value === "site" || value === "landing" || value === "dashboard") return value;
  return undefined;
}

function mergeStringLists(current: string[] | undefined, next: string[]) {
  return Array.from(new Set([...(current ?? []), ...next].filter(Boolean))).slice(0, 20);
}

function numeric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function looksLikeCode(value: string) {
  return /```[\s\S]+```/.test(value) || /\b(function|const|let|class|interface|export|import|model\s+\w+|SELECT\s+)/i.test(value);
}

function normalize(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
