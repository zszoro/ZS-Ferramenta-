import path from "node:path";
import type { KnowledgeChunkKind } from "./types";
import {
  DEFAULT_CHUNK_LINES,
  DEFAULT_CHUNK_OVERLAP_LINES,
} from "./config";

const tokenPattern = /[a-zA-Z0-9_@\-/.:]+/g;

export function tokenize(input: string) {
  return Array.from(input.toLowerCase().matchAll(tokenPattern), (match) =>
    match[0].replace(/^[-_.:/@]+|[-_.:/@]+$/g, ""),
  ).filter((token) => token.length > 1);
}

export function normalizeText(input: string) {
  return input.replace(/\r\n/g, "\n").replace(/\t/g, "  ");
}

export function summarizeText(input: string, maxLength = 260) {
  const compact = input.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength - 1).trim()}…`;
}

export function splitIntoLineChunks(
  text: string,
  chunkLines = DEFAULT_CHUNK_LINES,
  overlapLines = DEFAULT_CHUNK_OVERLAP_LINES,
) {
  const lines = normalizeText(text).split("\n");
  const chunks: Array<{ text: string; startLine: number; endLine: number }> = [];
  const step = Math.max(1, chunkLines - overlapLines);

  for (let start = 0; start < lines.length; start += step) {
    const end = Math.min(lines.length, start + chunkLines);
    const slice = lines.slice(start, end).join("\n").trim();

    if (slice.length > 0) {
      chunks.push({
        text: slice,
        startLine: start + 1,
        endLine: end,
      });
    }

    if (end >= lines.length) {
      break;
    }
  }

  return chunks;
}

export function inferLanguage(filePath: string) {
  const base = path.basename(filePath);
  const ext = path.extname(base).toLowerCase();

  if (base === "Dockerfile") return "docker";
  if (base.endsWith(".env.example")) return "env";

  const languages: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "typescript-react",
    ".js": "javascript",
    ".jsx": "javascript-react",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".json": "json",
    ".md": "markdown",
    ".mdx": "mdx",
    ".css": "css",
    ".scss": "scss",
    ".html": "html",
    ".sql": "sql",
    ".prisma": "prisma",
    ".yml": "yaml",
    ".yaml": "yaml",
    ".toml": "toml",
  };

  return languages[ext] ?? "text";
}

export function inferKind(filePath: string, text: string): KnowledgeChunkKind {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  const content = text.toLowerCase();

  if (normalized.includes("/app/api/") || normalized.includes("/api/")) {
    return "api";
  }

  if (
    normalized.includes("/components/") ||
    content.includes("export function") ||
    content.includes("export default function")
  ) {
    if (normalized.endsWith(".tsx") || normalized.endsWith(".jsx")) {
      return "component";
    }
  }

  if (normalized.includes("/app/") && normalized.endsWith("page.tsx")) {
    return "page";
  }

  if (
    normalized.includes("schema") ||
    normalized.includes("migration") ||
    normalized.endsWith(".prisma") ||
    normalized.endsWith(".sql")
  ) {
    return "schema";
  }

  if (
    normalized.endsWith(".css") ||
    normalized.includes("theme") ||
    normalized.includes("tailwind")
  ) {
    return "style";
  }

  if (
    normalized.endsWith(".md") ||
    normalized.endsWith(".mdx") ||
    normalized.includes("docs/")
  ) {
    return "documentation";
  }

  if (
    normalized.includes(".test.") ||
    normalized.includes(".spec.") ||
    normalized.includes("__tests__")
  ) {
    return "test";
  }

  if (
    normalized.includes("config") ||
    normalized.endsWith(".json") ||
    normalized.endsWith(".yml") ||
    normalized.endsWith(".yaml") ||
    normalized.endsWith(".toml")
  ) {
    return "config";
  }

  if (normalized.includes("/public/") || normalized.includes("/assets/")) {
    return "asset";
  }

  return "code";
}

export function detectSignals(filePath: string, text: string) {
  const normalized = `${filePath}\n${text}`.toLowerCase();
  const signals: string[] = [];
  const checks: Array<[string, RegExp]> = [
    ["react", /\breact\b|tsx|jsx/],
    ["nextjs", /\bnext\b|app\/api|route\.ts|page\.tsx|layout\.tsx/],
    ["tailwind", /tailwind|className=/],
    ["auth", /auth|session|jwt|permission|role/],
    ["database", /prisma|drizzle|postgres|supabase|sql|migration/],
    ["payments", /stripe|checkout|payment|subscription/],
    ["realtime", /websocket|socket|realtime|channel/],
    ["upload", /upload|multipart|blob|storage/],
    ["animation", /framer|motion|animate|transition/],
    ["testing", /describe\(|it\(|test\(|expect\(/],
    ["deploy", /vercel|docker|railway|render|netlify|workflow/],
    ["security", /secret|token|password|csrf|cors|rate limit/],
    ["prompt", /prompt|system message|assistant|agent/],
  ];

  for (const [label, pattern] of checks) {
    if (pattern.test(normalized)) {
      signals.push(label);
    }
  }

  return signals;
}

export function createChunkTitle(filePath: string, startLine: number, text: string) {
  const base = path.basename(filePath);
  const firstMeaningfulLine =
    text
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0 && !line.startsWith("//")) ?? base;

  return `${base}:${startLine} ${summarizeText(firstMeaningfulLine, 80)}`;
}
