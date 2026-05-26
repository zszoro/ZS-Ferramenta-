import { promises as fs } from "node:fs";
import path from "node:path";
import {
  DEFAULT_MAX_FILE_BYTES,
  DEFAULT_VECTOR_DIMENSIONS,
  isIgnoredDirectory,
  isSupportedFile,
  normalizeRepositoryRoot,
} from "./config";
import {
  createChunkTitle,
  detectSignals,
  inferKind,
  inferLanguage,
  normalizeText,
  splitIntoLineChunks,
  tokenize,
} from "./text";
import { embedText } from "./vector";
import type {
  KnowledgeChunk,
  KnowledgeIndex,
  RepositoryScanOptions,
  RepositoryScanSummary,
} from "./types";

export async function buildKnowledgeIndex(
  options: RepositoryScanOptions,
): Promise<{ index: KnowledgeIndex; summary: RepositoryScanSummary }> {
  const dimensions = options.dimensions ?? DEFAULT_VECTOR_DIMENSIONS;
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const roots = options.roots.map(normalizeRepositoryRoot);
  const chunks: KnowledgeChunk[] = [];
  let fileCount = 0;
  let ignoredFiles = 0;

  for (const root of roots) {
    const repositoryLabel = path.basename(root);
    const files = await collectFiles(root);

    for (const filePath of files) {
      const stat = await fs.stat(filePath);
      if (stat.size > maxFileBytes || !isSupportedFile(filePath)) {
        ignoredFiles += 1;
        continue;
      }

      const raw = await fs.readFile(filePath, "utf8");
      const text = normalizeText(raw);
      const relativePath = path.relative(root, filePath).replace(/\\/g, "/");
      const lineChunks = splitIntoLineChunks(text);

      fileCount += 1;

      for (let index = 0; index < lineChunks.length; index += 1) {
        const chunk = lineChunks[index];
        const chunkText = [
          `path: ${relativePath}`,
          `language: ${inferLanguage(filePath)}`,
          chunk.text,
        ].join("\n");
        const tokens = tokenize(chunkText);

        chunks.push({
          id: createStableChunkId(repositoryLabel, relativePath, chunk.startLine, index),
          repositoryRoot: repositoryLabel,
          path: relativePath,
          extension: path.extname(filePath).toLowerCase() || path.basename(filePath),
          language: inferLanguage(filePath),
          kind: inferKind(filePath, chunk.text),
          title: createChunkTitle(filePath, chunk.startLine, chunk.text),
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          text: chunk.text,
          tokens,
          vector: embedText(chunkText, dimensions),
          signals: detectSignals(filePath, chunk.text),
        });
      }
    }
  }

  const generatedAt = new Date().toISOString();
  const summary = {
    files: fileCount,
    chunks: chunks.length,
    ignoredFiles,
    roots,
  };

  return {
    summary,
    index: {
      version: 1,
      rootLabel: roots.map((root) => path.basename(root)).join(", "),
      generatedAt,
      dimensions,
      stats: {
        roots: roots.length,
        files: fileCount,
        chunks: chunks.length,
        dimensions,
        ignoredFiles,
        generatedAt,
      },
      chunks,
    },
  };
}

async function collectFiles(root: string) {
  const files: string[] = [];

  async function walk(current: string) {
    const entries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const absolute = path.join(current, entry.name);

      if (entry.isDirectory()) {
        if (!isIgnoredDirectory(entry.name)) {
          await walk(absolute);
        }
        continue;
      }

      if (entry.isFile()) {
        files.push(absolute);
      }
    }
  }

  await walk(root);
  return files;
}

function createStableChunkId(
  root: string,
  relativePath: string,
  startLine: number,
  index: number,
) {
  const source = `${root}:${relativePath}:${startLine}:${index}`;
  let hash = 2166136261;

  for (let charIndex = 0; charIndex < source.length; charIndex += 1) {
    hash ^= source.charCodeAt(charIndex);
    hash = Math.imul(hash, 16777619);
  }

  return `chunk_${(hash >>> 0).toString(36)}_${startLine}_${index}`;
}
