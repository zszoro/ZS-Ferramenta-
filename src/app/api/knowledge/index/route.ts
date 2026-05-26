import { buildKnowledgeIndex } from "@/lib/rag/indexer";
import { resolveRequestedRoots } from "@/lib/rag/safe-roots";
import {
  getKnowledgeIndexMeta,
  saveKnowledgeIndex,
} from "@/lib/rag/store";
import { summarizeIndex } from "@/lib/rag/search";

export const runtime = "nodejs";

type IndexRequest = {
  roots?: string[];
};

export async function GET() {
  const meta = await getKnowledgeIndexMeta();

  return Response.json({
    ok: true,
    indexed: Boolean(meta),
    meta,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as IndexRequest;
    const roots = resolveRequestedRoots(body.roots);
    const { index, summary } = await buildKnowledgeIndex({ roots });
    const storePath = await saveKnowledgeIndex(index);

    return Response.json({
      ok: true,
      storePath,
      summary,
      index: summarizeIndex(index),
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Falha desconhecida ao indexar workspace.",
      },
      { status: 400 },
    );
  }
}
