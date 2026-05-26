import { searchKnowledgeIndex, summarizeIndex } from "@/lib/rag/search";
import { loadKnowledgeIndex } from "@/lib/rag/store";
import type { SearchFilters } from "@/lib/rag/types";

export const runtime = "nodejs";

type SearchRequest = {
  query?: string;
  filters?: SearchFilters;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as SearchRequest;
  const query = body.query?.trim();

  if (!query) {
    return Response.json(
      { ok: false, error: "Informe uma consulta para buscar na base." },
      { status: 400 },
    );
  }

  const index = await loadKnowledgeIndex();

  if (!index) {
    return Response.json(
      {
        ok: false,
        error: "Nenhum índice encontrado. Rode a indexação primeiro.",
      },
      { status: 404 },
    );
  }

  const results = searchKnowledgeIndex(index, query, body.filters);

  return Response.json({
    ok: true,
    query,
    index: summarizeIndex(index),
    results,
  });
}
