import { buildProjectFromPrompt } from "@/lib/ai-builder/generator";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { prompt?: string };
  const prompt = body.prompt?.trim();

  if (!prompt) {
    return Response.json(
      { ok: false, error: "Descreva o site ou SaaS que a IA deve criar." },
      { status: 400 },
    );
  }

  const project = buildProjectFromPrompt(prompt);

  return Response.json({
    ok: true,
    project,
    mode: "create",
    reply: project.summary,
    tokenCost: 44,
  });
}
