import { respondToBuilderMessage } from "@/lib/ai-builder/generator";
import type { BuilderProject, ProjectBrief } from "@/lib/ai-builder/generator";
import { analyzeVisionReferences, parseVisionAttachments } from "@/lib/ai-builder/vision";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    message?: string;
    project?: BuilderProject | null;
    brief?: ProjectBrief | null;
    attachments?: unknown;
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

  const result = respondToBuilderMessage({
    message,
    project: body.project ?? null,
    brief: body.brief ?? null,
    vision,
  });

  return Response.json({
    ok: true,
    ...result,
  });
}
