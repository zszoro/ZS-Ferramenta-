import { respondToBuilderMessage } from "@/lib/ai-builder/generator";
import { rememberProjectEvent } from "@/lib/ai-builder/project-memory";
import type { AiModelMode } from "@/lib/ai-builder/engine-types";
import type { BuilderProject, ProjectBrief } from "@/lib/ai-builder/generator";
import { analyzeVisionReferences, parseVisionAttachments } from "@/lib/ai-builder/vision";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    message?: string;
    project?: BuilderProject | null;
    brief?: ProjectBrief | null;
    attachments?: unknown;
    userName?: string;
    modelMode?: AiModelMode | string;
    modelId?: string | null;
  };
  const parsedAttachments = parseVisionAttachments(body.attachments);

  if (!parsedAttachments.ok) {
    return Response.json({ ok: false, error: parsedAttachments.error }, { status: 400 });
  }

  const message =
    body.message?.trim() ||
    (parsedAttachments.attachments.length
      ? "Analise a imagem anexada e diga como ela pode ajudar no site."
      : "");

  if (!message) {
    return Response.json(
      { ok: false, error: "Escreva uma mensagem para a IA." },
      { status: 400 },
    );
  }

  const vision = await analyzeVisionReferences({
    message,
    attachments: parsedAttachments.attachments,
    hasProject: Boolean(body.project),
  });

  const result = await respondToBuilderMessage({
    message,
    project: body.project ?? null,
    brief: body.brief ?? null,
    vision,
    userName: body.userName,
    modelMode: body.modelMode,
    modelId: body.modelId,
  });
  await rememberProjectEvent({
    mode: result.mode,
    message,
    project: result.project,
    blueprint: result.aiBlueprint,
    aiEngine: result.aiEngine,
  });
  const publicResult = {
    ...result,
    aiBlueprint: undefined,
  };

  return Response.json({
    ok: true,
    ...publicResult,
  });
}
