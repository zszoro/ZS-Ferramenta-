import { respondToBuilderMessage } from "@/lib/ai-builder/generator";
import type { BuilderProject } from "@/lib/ai-builder/generator";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    message?: string;
    project?: BuilderProject | null;
  };
  const message = body.message?.trim();

  if (!message) {
    return Response.json(
      { ok: false, error: "Escreva uma mensagem para a IA." },
      { status: 400 },
    );
  }

  const result = respondToBuilderMessage({
    message,
    project: body.project ?? null,
  });

  return Response.json({
    ok: true,
    ...result,
  });
}
