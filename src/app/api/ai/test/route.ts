import { enhanceBuilderRequest } from "@/lib/ai-builder/external-ai";
import type { AiModelMode } from "@/lib/ai-builder/engine-types";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    modelMode?: AiModelMode | string;
    modelId?: string | null;
  };

  const result = await enhanceBuilderRequest({
    message: "Diga em uma frase: IA externa ativa na ferramenta ZS.",
    intent: "chat",
    modelMode: body.modelMode,
    modelId: body.modelId,
    hasProject: false,
    hasBrief: false,
  });

  return Response.json({
    ok: true,
    usedExternal: result.report.usedExternal,
    reply: result.blueprint?.reply ?? "Fallback local ativo.",
    error: result.report.usedExternal ? undefined : result.report.fallbackReason,
    aiEngine: result.report,
  });
}
