import { promises as fs } from "node:fs";
import path from "node:path";
import { getKnowledgeStorePath, getWorkspaceRoot } from "./config";
import type { KnowledgeIndex } from "./types";

export async function saveKnowledgeIndex(
  index: KnowledgeIndex,
  workspaceRoot = getWorkspaceRoot(),
) {
  const storePath = getKnowledgeStorePath(workspaceRoot);
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  return storePath;
}

export async function loadKnowledgeIndex(workspaceRoot = getWorkspaceRoot()) {
  const storePath = getKnowledgeStorePath(workspaceRoot);

  try {
    const raw = await fs.readFile(storePath, "utf8");
    return JSON.parse(raw) as KnowledgeIndex;
  } catch (error) {
    if (isNodeFileNotFound(error)) {
      return null;
    }

    throw error;
  }
}

export async function getKnowledgeIndexMeta(workspaceRoot = getWorkspaceRoot()) {
  const index = await loadKnowledgeIndex(workspaceRoot);

  if (!index) {
    return null;
  }

  return {
    generatedAt: index.generatedAt,
    rootLabel: index.rootLabel,
    stats: index.stats,
    storePath: getKnowledgeStorePath(workspaceRoot),
  };
}

function isNodeFileNotFound(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
