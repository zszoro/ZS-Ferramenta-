import { buildKnowledgeIndex } from "../src/lib/rag/indexer";
import { resolveRequestedRoots } from "../src/lib/rag/safe-roots";
import { summarizeIndex } from "../src/lib/rag/search";
import { saveKnowledgeIndex } from "../src/lib/rag/store";

async function main() {
  const roots = parseRoots(process.argv.slice(2));
  const safeRoots = resolveRequestedRoots(roots);
  const { index, summary } = await buildKnowledgeIndex({ roots: safeRoots });
  const storePath = await saveKnowledgeIndex(index);

  console.log(
    JSON.stringify(
      {
        ok: true,
        storePath,
        summary,
        index: summarizeIndex(index),
      },
      null,
      2,
    ),
  );
}

function parseRoots(args: string[]) {
  const roots: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--root" && args[index + 1]) {
      roots.push(args[index + 1]);
      index += 1;
    }
  }

  return roots.length > 0 ? roots : ["."];
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
