import { DEFAULT_VECTOR_DIMENSIONS } from "./config";
import { tokenize } from "./text";

export function embedText(
  input: string,
  dimensions = DEFAULT_VECTOR_DIMENSIONS,
) {
  const vector = new Array<number>(dimensions).fill(0);
  const tokens = tokenize(input);

  for (const token of tokens) {
    const index = positiveHash(token) % dimensions;
    const sign = positiveHash(`sign:${token}`) % 2 === 0 ? 1 : -1;
    const weight = token.length > 12 ? 1.35 : 1;
    vector[index] += sign * weight;
  }

  return normalizeVector(vector);
}

export function cosineSimilarity(a: number[], b: number[]) {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function tokenOverlapScore(queryTokens: string[], targetTokens: string[]) {
  if (queryTokens.length === 0 || targetTokens.length === 0) {
    return 0;
  }

  const target = new Set(targetTokens);
  const hits = queryTokens.filter((token) => target.has(token));
  return hits.length / Math.max(queryTokens.length, 1);
}

function normalizeVector(vector: number[]) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

  if (norm === 0) {
    return vector;
  }

  return vector.map((value) => Number((value / norm).toFixed(6)));
}

function positiveHash(input: string) {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
