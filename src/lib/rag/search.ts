import { tokenize, summarizeText } from "./text";
import { cosineSimilarity, embedText, tokenOverlapScore } from "./vector";
import type { KnowledgeIndex, SearchFilters, SearchResult } from "./types";

export function searchKnowledgeIndex(
  index: KnowledgeIndex,
  query: string,
  filters: SearchFilters = {},
) {
  const limit = filters.limit ?? 8;
  const queryTokens = tokenize(query);
  const queryVector = embedText(query, index.dimensions);

  return index.chunks
    .filter((chunk) => {
      if (filters.kind && chunk.kind !== filters.kind) {
        return false;
      }

      if (
        filters.pathIncludes &&
        !chunk.path.toLowerCase().includes(filters.pathIncludes.toLowerCase())
      ) {
        return false;
      }

      return true;
    })
    .map<SearchResult>((chunk) => {
      const vectorScore = cosineSimilarity(queryVector, chunk.vector);
      const tokenScore = tokenOverlapScore(queryTokens, chunk.tokens);
      const pathScore = scorePath(queryTokens, chunk.path);
      const signalScore = scoreSignals(queryTokens, chunk.signals);
      const score =
        vectorScore * 0.58 + tokenScore * 0.27 + pathScore * 0.1 + signalScore * 0.05;

      return {
        ...chunk,
        score: Number(score.toFixed(4)),
        highlights: createHighlights(chunk.text, queryTokens),
        reason: createReason(tokenScore, pathScore, signalScore),
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function summarizeIndex(index: KnowledgeIndex) {
  const kinds = new Map<string, number>();
  const signals = new Map<string, number>();

  for (const chunk of index.chunks) {
    kinds.set(chunk.kind, (kinds.get(chunk.kind) ?? 0) + 1);

    for (const signal of chunk.signals) {
      signals.set(signal, (signals.get(signal) ?? 0) + 1);
    }
  }

  return {
    generatedAt: index.generatedAt,
    rootLabel: index.rootLabel,
    stats: index.stats,
    topKinds: sortEntries(kinds).slice(0, 8),
    topSignals: sortEntries(signals).slice(0, 10),
  };
}

export function recommendReusableArtifacts(results: SearchResult[]) {
  const recommendations = new Set<string>();

  for (const result of results) {
    if (result.kind === "component") {
      recommendations.add(`Reutilizar ou adaptar componente em ${result.path}`);
    }
    if (result.kind === "api") {
      recommendations.add(`Seguir contrato backend de ${result.path}`);
    }
    if (result.kind === "style") {
      recommendations.add(`Preservar tokens e classes de estilo em ${result.path}`);
    }
    if (result.signals.includes("database")) {
      recommendations.add(`Checar schema/migration relacionado a ${result.path}`);
    }
    if (result.signals.includes("auth")) {
      recommendations.add(`Aplicar o mesmo padrão de auth visto em ${result.path}`);
    }
  }

  return Array.from(recommendations).slice(0, 6);
}

function createHighlights(text: string, queryTokens: string[]) {
  const lines = text.split("\n");
  const relevant = lines.filter((line) => {
    const lower = line.toLowerCase();
    return queryTokens.some((token) => lower.includes(token));
  });

  const source = relevant.length > 0 ? relevant : lines.slice(0, 2);
  return source.slice(0, 3).map((line) => summarizeText(line, 180));
}

function scorePath(queryTokens: string[], filePath: string) {
  const lowerPath = filePath.toLowerCase();
  const hits = queryTokens.filter((token) => lowerPath.includes(token));
  return hits.length / Math.max(queryTokens.length, 1);
}

function scoreSignals(queryTokens: string[], signals: string[]) {
  const signalSet = new Set(signals);
  const hits = queryTokens.filter((token) => signalSet.has(token));
  return hits.length / Math.max(queryTokens.length, 1);
}

function createReason(tokenScore: number, pathScore: number, signalScore: number) {
  if (pathScore > 0) return "caminho relacionado ao pedido";
  if (signalScore > 0) return "sinal arquitetural compatível";
  if (tokenScore > 0.3) return "termos importantes aparecem no trecho";
  return "similaridade vetorial";
}

function sortEntries(map: Map<string, number>) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));
}
