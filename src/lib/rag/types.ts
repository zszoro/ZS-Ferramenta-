export type KnowledgeChunkKind =
  | "component"
  | "page"
  | "api"
  | "schema"
  | "style"
  | "config"
  | "documentation"
  | "test"
  | "asset"
  | "code";

export type KnowledgeChunk = {
  id: string;
  repositoryRoot: string;
  path: string;
  extension: string;
  language: string;
  kind: KnowledgeChunkKind;
  title: string;
  startLine: number;
  endLine: number;
  text: string;
  tokens: string[];
  vector: number[];
  signals: string[];
};

export type KnowledgeIndexStats = {
  roots: number;
  files: number;
  chunks: number;
  dimensions: number;
  ignoredFiles: number;
  generatedAt: string;
};

export type KnowledgeIndex = {
  version: 1;
  rootLabel: string;
  generatedAt: string;
  dimensions: number;
  stats: KnowledgeIndexStats;
  chunks: KnowledgeChunk[];
};

export type SearchFilters = {
  kind?: KnowledgeChunkKind;
  pathIncludes?: string;
  limit?: number;
};

export type SearchResult = KnowledgeChunk & {
  score: number;
  highlights: string[];
  reason: string;
};

export type RepositoryScanOptions = {
  roots: string[];
  dimensions?: number;
  maxFileBytes?: number;
};

export type RepositoryScanSummary = {
  files: number;
  chunks: number;
  ignoredFiles: number;
  roots: string[];
};

export type AgentPlanStep = {
  title: string;
  agent: string;
  detail: string;
  evidencePaths: string[];
};

export type AgentPlan = {
  prompt: string;
  selectedAgents: string[];
  summary: string;
  steps: AgentPlanStep[];
  reusableArtifacts: string[];
  risks: string[];
};
