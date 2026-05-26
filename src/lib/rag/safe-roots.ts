import path from "node:path";
import { getWorkspaceRoot } from "./config";

export function resolveRequestedRoots(requestedRoots?: string[]) {
  const workspaceRoot = getWorkspaceRoot();
  const allowedRoots = getAllowedRoots(workspaceRoot);
  const roots = requestedRoots && requestedRoots.length > 0 ? requestedRoots : ["."];

  return roots.map((root) => {
    const resolved = path.resolve(workspaceRoot, root);
    const allowed = allowedRoots.some((allowedRoot) => isInside(resolved, allowedRoot));

    if (!allowed) {
      throw new Error(
        `Root fora do escopo permitido: ${resolved}. Configure ZS_ALLOWED_INDEX_ROOTS para permitir outros repositórios.`,
      );
    }

    return resolved;
  });
}

export function getAllowedRoots(workspaceRoot = getWorkspaceRoot()) {
  const configured = process.env.ZS_ALLOWED_INDEX_ROOTS?.split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => path.resolve(workspaceRoot, entry));

  return [workspaceRoot, ...(configured ?? [])];
}

function isInside(candidate: string, parent: string) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
