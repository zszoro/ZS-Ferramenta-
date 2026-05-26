import { buildRagContext, searchProjectKnowledge } from "@/lib/ai-builder/rag";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { query?: string };
  const query = body.query?.trim();

  if (!query) {
    return Response.json(
      { ok: false, error: "Informe uma query para buscar no contexto da IA." },
      { status: 400 },
    );
  }

  return Response.json({
    ok: true,
    ...buildRagContext(query),
  });
}

export async function GET() {
  return Response.json({
    ok: true,
    matches: searchProjectKnowledge("arquitetura componentes templates agentes memoria", 10),
  });
}
