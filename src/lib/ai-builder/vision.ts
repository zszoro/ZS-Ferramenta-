export type BuilderImageAttachment = {
  id: string;
  name: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  size: number;
  dataUrl: string;
  width?: number;
  height?: number;
};

export type VisionIntent =
  | "none"
  | "use-image-as-asset"
  | "use-image-as-layout-reference"
  | "extract-style"
  | "replace-selected-image";

export type VisionTarget =
  | "none"
  | "hero"
  | "selected"
  | "background"
  | "gallery"
  | "logo"
  | "style";

export type VisionAnalysis = {
  agent: "vision";
  source: "openai" | "local";
  model?: string;
  intent: VisionIntent;
  target: VisionTarget;
  shouldApplyToPreview: boolean;
  confidence: number;
  summary: string;
  layout: string;
  visualPrompt: string;
  colors: string[];
  content: string[];
  warnings: string[];
};

export type VisionContext = {
  attachments: BuilderImageAttachment[];
  analysis: VisionAnalysis;
};

const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

type ParseResult =
  | { ok: true; attachments: BuilderImageAttachment[] }
  | { ok: false; error: string };

type AnalyzeVisionInput = {
  message: string;
  attachments: BuilderImageAttachment[];
  hasProject: boolean;
};

export function parseVisionAttachments(value: unknown): ParseResult {
  if (value === undefined || value === null) return { ok: true, attachments: [] };
  if (!Array.isArray(value)) return { ok: false, error: "Envie anexos de imagem em uma lista." };

  const attachments: BuilderImageAttachment[] = [];

  for (const item of value.slice(0, MAX_ATTACHMENTS)) {
    if (!isRecord(item)) return { ok: false, error: "Anexo de imagem invalido." };

    const name = typeof item.name === "string" ? item.name.slice(0, 120) : "imagem";
    const mimeType = typeof item.mimeType === "string" ? item.mimeType : "";
    const dataUrl = typeof item.dataUrl === "string" ? item.dataUrl : "";
    const id = typeof item.id === "string" ? item.id.slice(0, 80) : createVisionId(name);
    const width = typeof item.width === "number" && Number.isFinite(item.width) ? item.width : undefined;
    const height = typeof item.height === "number" && Number.isFinite(item.height) ? item.height : undefined;
    const size = typeof item.size === "number" && Number.isFinite(item.size) ? item.size : dataUrlByteSize(dataUrl);

    if (!isSupportedImageType(mimeType)) {
      return { ok: false, error: "Use PNG, JPG, WEBP ou GIF nao animado." };
    }

    if (!isValidImageDataUrl(dataUrl, mimeType)) {
      return { ok: false, error: "A imagem precisa ser enviada como data URL base64 valida." };
    }

    const measuredSize = dataUrlByteSize(dataUrl);
    if (Math.max(size, measuredSize) > MAX_ATTACHMENT_BYTES) {
      return { ok: false, error: "Imagem muito pesada. Envie ate 8 MB por imagem." };
    }

    attachments.push({
      id,
      name,
      mimeType,
      size: measuredSize,
      dataUrl,
      width,
      height,
    });
  }

  return { ok: true, attachments };
}

export async function analyzeVisionReferences(input: AnalyzeVisionInput): Promise<VisionContext | null> {
  if (!input.attachments.length) return null;

  const localIntent = classifyVisionIntent(input.message, input.hasProject);
  const apiAnalysis = await analyzeWithOpenAi(input, localIntent).catch(() => null);
  const analysis = apiAnalysis ?? buildLocalVisionAnalysis(input, localIntent);

  return {
    attachments: input.attachments,
    analysis: {
      ...analysis,
      shouldApplyToPreview: localIntent.shouldApplyToPreview,
      intent: localIntent.intent === "none" ? "none" : analysis.intent,
      target: localIntent.target === "none" ? "none" : analysis.target,
      confidence: clamp(analysis.confidence, 0, 1),
    },
  };
}

export function hasVisionApplyIntent(message: string, hasProject: boolean) {
  return classifyVisionIntent(message, hasProject).shouldApplyToPreview;
}

function classifyVisionIntent(message: string, hasProject: boolean): {
  intent: VisionIntent;
  target: VisionTarget;
  shouldApplyToPreview: boolean;
} {
  const lower = normalize(message);
  const hasImageWord = [
    "imagem",
    "foto",
    "print",
    "screenshot",
    "referencia",
    "referencia visual",
    "anexo",
    "essa",
    "esta",
  ].some((word) => lower.includes(word));
  const hasApplyVerb = [
    "coloque",
    "coloca",
    "usar",
    "use",
    "aplique",
    "aplica",
    "adicione",
    "adiciona",
    "troque",
    "substitua",
    "substitui",
    "mude",
    "mudar",
    "gere",
    "gerar",
    "crie",
    "criar",
    "monte",
    "refaca",
    "refazer",
    "igual",
    "parecido",
    "baseado",
    "inspirado",
  ].some((word) => lower.includes(word));
  const asksOnlyAboutImage = [
    "o que tem",
    "o que aparece",
    "analise",
    "descreva",
    "me diga",
    "o que acha",
  ].some((phrase) => lower.includes(phrase)) && !hasApplyVerb;

  if (!hasApplyVerb || asksOnlyAboutImage) {
    return { intent: "none", target: "none", shouldApplyToPreview: false };
  }

  const shouldApplyToPreview = hasImageWord || hasProject || lower.includes("site") || lower.includes("preview");
  if (!shouldApplyToPreview) {
    return { intent: "none", target: "none", shouldApplyToPreview: false };
  }

  if (lower.includes("logo") || lower.includes("marca")) {
    return { intent: "use-image-as-asset", target: "logo", shouldApplyToPreview: true };
  }

  if (lower.includes("fundo") || lower.includes("background")) {
    return { intent: "use-image-as-asset", target: "background", shouldApplyToPreview: true };
  }

  if (lower.includes("selecionado") || lower.includes("selecionada")) {
    return { intent: "replace-selected-image", target: "selected", shouldApplyToPreview: true };
  }

  if (
    lower.includes("layout") ||
    lower.includes("igual") ||
    lower.includes("parecido") ||
    lower.includes("print") ||
    lower.includes("screenshot") ||
    lower.includes("referencia") ||
    lower.includes("inspirado")
  ) {
    return { intent: "use-image-as-layout-reference", target: "style", shouldApplyToPreview: true };
  }

  if (lower.includes("galeria") || lower.includes("produto") || lower.includes("card")) {
    return { intent: "use-image-as-asset", target: "gallery", shouldApplyToPreview: true };
  }

  return { intent: "use-image-as-asset", target: "hero", shouldApplyToPreview: true };
}

async function analyzeWithOpenAi(
  input: AnalyzeVisionInput,
  localIntent: ReturnType<typeof classifyVisionIntent>,
): Promise<VisionAnalysis | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildVisionPrompt(input.message, input.hasProject, localIntent),
            },
            ...input.attachments.map((attachment) => ({
              type: "input_image",
              image_url: attachment.dataUrl,
            })),
          ],
        },
      ],
    }),
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as unknown;
  const text = extractOpenAiText(payload);
  if (!text) return null;

  const parsed = parseJsonObject(text);
  if (!parsed) return null;

  return normalizeVisionAnalysis(parsed, {
    source: "openai",
    model,
    fallbackIntent: localIntent.intent,
    fallbackTarget: localIntent.target,
  });
}

function buildVisionPrompt(
  message: string,
  hasProject: boolean,
  localIntent: ReturnType<typeof classifyVisionIntent>,
) {
  return [
    "Voce e o Vision Agent da ZS Ferramenta.",
    "Analise a imagem anexada como referencia para um gerador de sites.",
    "Responda somente JSON valido, sem markdown.",
    "Campos obrigatorios: intent, target, shouldApplyToPreview, confidence, summary, layout, visualPrompt, colors, content, warnings.",
    'intent deve ser um destes: "none", "use-image-as-asset", "use-image-as-layout-reference", "extract-style", "replace-selected-image".',
    'target deve ser um destes: "none", "hero", "selected", "background", "gallery", "logo", "style".',
    "shouldApplyToPreview precisa ser true somente se a fala do usuario pedir para usar/aplicar a imagem ou criar/editar o preview com ela.",
    "Se a fala so pedir explicacao sobre a imagem, use shouldApplyToPreview false.",
    `Projeto atual existe: ${hasProject ? "sim" : "nao"}.`,
    `Classificacao deterministica da fala: ${JSON.stringify(localIntent)}.`,
    `Fala do usuario: ${message || "(sem texto)"}`,
  ].join("\n");
}

function buildLocalVisionAnalysis(
  input: AnalyzeVisionInput,
  localIntent: ReturnType<typeof classifyVisionIntent>,
): VisionAnalysis {
  const first = input.attachments[0];
  const dimensions = first.width && first.height ? `${first.width}x${first.height}` : "dimensoes nao informadas";
  const isScreenshot = normalize(first.name).includes("screenshot") || normalize(first.name).includes("print");
  const summary = isScreenshot
    ? `Referencia visual anexada como print (${dimensions}).`
    : `Imagem anexada pelo usuario (${dimensions}).`;

  return {
    agent: "vision",
    source: "local",
    intent: localIntent.intent,
    target: localIntent.target,
    shouldApplyToPreview: localIntent.shouldApplyToPreview,
    confidence: localIntent.shouldApplyToPreview ? 0.62 : 0.35,
    summary,
    layout: isScreenshot
      ? "Usar como referencia de composicao, hierarquia, espacamento e estilo visual."
      : "Usar como asset visual quando o usuario pedir para colocar a imagem no site.",
    visualPrompt: [
      summary,
      localIntent.target !== "none" ? `Alvo sugerido: ${localIntent.target}.` : "",
      "Preservar o chat existente e atualizar o preview somente com intencao explicita.",
    ]
      .filter(Boolean)
      .join(" "),
    colors: [],
    content: [first.name],
    warnings: process.env.OPENAI_API_KEY
      ? []
      : ["OPENAI_API_KEY ausente: usei analise local de intencao sem leitura visual profunda."],
  };
}

function normalizeVisionAnalysis(
  value: unknown,
  options: {
    source: VisionAnalysis["source"];
    model?: string;
    fallbackIntent: VisionIntent;
    fallbackTarget: VisionTarget;
  },
): VisionAnalysis | null {
  if (!isRecord(value)) return null;

  const intent = isVisionIntent(value.intent) ? value.intent : options.fallbackIntent;
  const target = isVisionTarget(value.target) ? value.target : options.fallbackTarget;
  const colors = Array.isArray(value.colors)
    ? value.colors.filter((color): color is string => typeof color === "string").filter(isHexColor).slice(0, 6)
    : [];
  const content = Array.isArray(value.content)
    ? value.content.filter((item): item is string => typeof item === "string").slice(0, 8)
    : [];
  const warnings = Array.isArray(value.warnings)
    ? value.warnings.filter((item): item is string => typeof item === "string").slice(0, 5)
    : [];

  return {
    agent: "vision",
    source: options.source,
    model: options.model,
    intent,
    target,
    shouldApplyToPreview: Boolean(value.shouldApplyToPreview),
    confidence: typeof value.confidence === "number" ? value.confidence : 0.7,
    summary: typeof value.summary === "string" ? cleanText(value.summary, 240) : "Referencia visual analisada.",
    layout: typeof value.layout === "string" ? cleanText(value.layout, 260) : "",
    visualPrompt: typeof value.visualPrompt === "string" ? cleanText(value.visualPrompt, 420) : "",
    colors,
    content,
    warnings,
  };
}

function extractOpenAiText(payload: unknown) {
  if (!isRecord(payload)) return "";
  if (typeof payload.output_text === "string") return payload.output_text;
  if (!Array.isArray(payload.output)) return "";

  return payload.output
    .flatMap((item) => (isRecord(item) && Array.isArray(item.content) ? item.content : []))
    .map((content) => (isRecord(content) && typeof content.text === "string" ? content.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function parseJsonObject(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  try {
    return JSON.parse(fenced.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

function isSupportedImageType(value: string): value is BuilderImageAttachment["mimeType"] {
  return SUPPORTED_IMAGE_TYPES.includes(value as BuilderImageAttachment["mimeType"]);
}

function isValidImageDataUrl(value: string, mimeType: string) {
  const escapedMime = mimeType.replace("/", "\\/");
  return new RegExp(`^data:${escapedMime};base64,[A-Za-z0-9+/=\\s]+$`).test(value);
}

function dataUrlByteSize(value: string) {
  const base64 = value.split(",", 2)[1]?.replace(/\s/g, "") ?? "";
  if (!base64) return 0;

  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function isVisionIntent(value: unknown): value is VisionIntent {
  return (
    value === "none" ||
    value === "use-image-as-asset" ||
    value === "use-image-as-layout-reference" ||
    value === "extract-style" ||
    value === "replace-selected-image"
  );
}

function isVisionTarget(value: unknown): value is VisionTarget {
  return (
    value === "none" ||
    value === "hero" ||
    value === "selected" ||
    value === "background" ||
    value === "gallery" ||
    value === "logo" ||
    value === "style"
  );
}

function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function cleanText(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function createVisionId(seed: string) {
  return `vision_${Date.now().toString(36)}_${normalize(seed).replace(/[^a-z0-9]+/g, "").slice(0, 12)}`;
}

function normalize(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
