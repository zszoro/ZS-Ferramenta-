import type { AiTaskKind } from "./engine-types";

export type FreeAiModel = {
  id: string;
  name: string;
  provider: string;
  description?: string;
  contextLength?: number;
  recommendedFor: AiTaskKind[];
};

type OpenRouterModel = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  context_length?: unknown;
  pricing?: unknown;
};

const openRouterModelsUrl = "https://openrouter.ai/api/v1/models";

const fallbackFreeModels: FreeAiModel[] = [
  {
    id: "openrouter/free",
    name: "OpenRouter Free Router",
    provider: "OpenRouter",
    description: "Seleciona automaticamente um modelo gratuito disponivel.",
    recommendedFor: ["chat", "generation", "edit", "code", "planning", "bugfix", "design", "qa", "seo"],
  },
  {
    id: "deepseek/deepseek-r1:free",
    name: "DeepSeek R1 Free",
    provider: "DeepSeek",
    recommendedFor: ["planning", "bugfix", "code", "qa"],
  },
  {
    id: "qwen/qwen3-coder:free",
    name: "Qwen Coder Free",
    provider: "Qwen",
    recommendedFor: ["code", "bugfix", "generation"],
  },
  {
    id: "meta-llama/llama-3.2-3b-instruct:free",
    name: "Llama 3.2 3B Instruct Free",
    provider: "Meta",
    recommendedFor: ["chat", "edit"],
  },
];

export function normalizeFreeModelId(modelId: string | null | undefined) {
  const trimmed = modelId?.trim();
  if (!trimmed) return undefined;
  if (trimmed === "openrouter/free") return trimmed;
  if (trimmed.endsWith(":free")) return trimmed;
  return undefined;
}

export async function getFreeOpenRouterModels() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(openRouterModelsUrl, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      next: { revalidate: 60 * 60 },
    });

    if (!response.ok) {
      return fallbackFreeModels;
    }

    const payload = (await response.json()) as { data?: OpenRouterModel[] };
    const dynamicModels = (payload.data ?? [])
      .map(toFreeModel)
      .filter((model): model is FreeAiModel => Boolean(model));

    return dedupeModels([fallbackFreeModels[0], ...dynamicModels, ...fallbackFreeModels]).sort((left, right) => {
      if (left.id === "openrouter/free") return -1;
      if (right.id === "openrouter/free") return 1;
      return `${left.provider} ${left.name}`.localeCompare(`${right.provider} ${right.name}`);
    });
  } catch {
    return fallbackFreeModels;
  } finally {
    clearTimeout(timeout);
  }
}

function toFreeModel(model: OpenRouterModel): FreeAiModel | null {
  const id = typeof model.id === "string" ? model.id : "";
  if (!id) return null;

  if (id !== "openrouter/free" && !id.endsWith(":free") && !hasZeroTextPricing(model.pricing)) {
    return null;
  }

  const name = typeof model.name === "string" && model.name.trim() ? model.name.trim() : id;
  const description =
    typeof model.description === "string" && model.description.trim() ? model.description.trim().slice(0, 280) : undefined;
  const contextLength = typeof model.context_length === "number" ? model.context_length : undefined;

  return {
    id,
    name,
    provider: inferProvider(id, name),
    description,
    contextLength,
    recommendedFor: inferRecommendedTasks(id, name),
  };
}

function hasZeroTextPricing(pricing: unknown) {
  if (!pricing || typeof pricing !== "object" || Array.isArray(pricing)) return false;
  const record = pricing as Record<string, unknown>;
  const prompt = Number(record.prompt ?? 1);
  const completion = Number(record.completion ?? 1);

  return prompt === 0 && completion === 0;
}

function inferProvider(id: string, name: string) {
  if (id === "openrouter/free") return "OpenRouter";
  const prefix = id.split("/", 1)[0] || name.split(" ", 1)[0] || "OpenRouter";
  return prefix
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function inferRecommendedTasks(id: string, name: string): AiTaskKind[] {
  const value = `${id} ${name}`.toLowerCase();
  const tasks = new Set<AiTaskKind>(["chat", "generation", "edit"]);

  if (value.includes("coder") || value.includes("code") || value.includes("devstral") || value.includes("codestral")) {
    tasks.add("code");
    tasks.add("bugfix");
  }

  if (value.includes("r1") || value.includes("reason") || value.includes("thinking")) {
    tasks.add("planning");
    tasks.add("bugfix");
  }

  if (value.includes("vision") || value.includes("gemini") || value.includes("multimodal")) {
    tasks.add("design");
  }

  tasks.add("qa");
  tasks.add("seo");

  return Array.from(tasks);
}

function dedupeModels(models: FreeAiModel[]) {
  const seen = new Set<string>();

  return models.filter((model) => {
    if (seen.has(model.id)) return false;
    seen.add(model.id);
    return true;
  });
}
