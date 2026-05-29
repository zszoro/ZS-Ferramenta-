import { respondToBuilderMessage } from "@/lib/ai-builder/generator";
import { rememberProjectEvent } from "@/lib/ai-builder/project-memory";
import type { AiModelMode } from "@/lib/ai-builder/engine-types";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { prompt?: string; modelMode?: AiModelMode | string };
  const prompt = body.prompt?.trim();

  if (!prompt) {
    return Response.json(
      { ok: false, error: "Descreva o site ou SaaS que a IA deve criar." },
      { status: 400 },
    );
  }

  const result = await respondToBuilderMessage({
    message: prompt,
    modelMode: body.modelMode,
  });

  if (!result.project) {
    return Response.json(
      { ok: false, error: "A IA nao conseguiu gerar um projeto para esse prompt." },
      { status: 422 },
    );
  }

  await rememberProjectEvent({
    mode: result.mode,
    message: prompt,
    project: result.project,
    blueprint: result.aiBlueprint,
    aiEngine: result.aiEngine,
  });

  return Response.json({
    ok: true,
    project: result.project,
    mode: result.mode,
    reply: result.reply,
    tokenCost: result.tokenCost,
    aiEngine: result.aiEngine,
  });
}
