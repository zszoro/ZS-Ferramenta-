import path from "node:path";

export const DEFAULT_VECTOR_DIMENSIONS = 192;
export const DEFAULT_MAX_FILE_BYTES = 220_000;
export const DEFAULT_CHUNK_LINES = 90;
export const DEFAULT_CHUNK_OVERLAP_LINES = 16;

export const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".turbo",
  ".vercel",
  ".cache",
  ".parcel-cache",
  ".vite",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "logs",
  "tmp",
  "temp",
  "__pycache__",
]);

export const ignoredFileNames = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  ".DS_Store",
  "Thumbs.db",
]);

export const supportedExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".mdx",
  ".css",
  ".scss",
  ".html",
  ".sql",
  ".prisma",
  ".yml",
  ".yaml",
  ".toml",
  ".dockerfile",
  ".env.example",
]);

export function isIgnoredDirectory(name: string) {
  return ignoredDirectories.has(name);
}

export function isSupportedFile(filePath: string) {
  const base = path.basename(filePath);

  if (ignoredFileNames.has(base)) {
    return false;
  }

  if (base === "Dockerfile" || base.endsWith(".env.example")) {
    return true;
  }

  return supportedExtensions.has(path.extname(base).toLowerCase());
}

export function normalizeRepositoryRoot(root: string) {
  return path.resolve(root);
}

export function getWorkspaceRoot() {
  return path.resolve(/* turbopackIgnore: true */ process.cwd());
}

export function getKnowledgeStorePath(root = getWorkspaceRoot()) {
  return path.join(root, ".zs", "knowledge-base.json");
}
