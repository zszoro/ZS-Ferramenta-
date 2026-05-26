import { createAgentPlan } from "@/lib/agents/orchestrator";
import { searchKnowledgeIndex } from "@/lib/rag/search";
import { loadKnowledgeIndex } from "@/lib/rag/store";

export const runtime = "nodejs";

type PlanRequest = {
  prompt?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as PlanRequest;
  const prompt = body.prompt?.trim();

  if (!prompt) {
    return Response.json(
      { ok: false, error: "Informe um pedido para planejar." },
      { status: 400 },
    );
  }

  const index = await loadKnowledgeIndex();
  const evidence = index
    ? searchKnowledgeIndex(index, prompt, { limit: 6 })
    : [];
  const plan = createAgentPlan(prompt, evidence);

  return Response.json({
    ok: true,
    evidence,
    plan,
  });
}
