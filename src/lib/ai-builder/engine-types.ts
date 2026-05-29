export type AiModelMode = "auto" | "rapido" | "equilibrado" | "avancado";

export type AiProviderId =
  | "openrouter"
  | "openai"
  | "anthropic"
  | "google"
  | "deepseek"
  | "qwen"
  | "llama"
  | "mistral";

export type AiTaskKind =
  | "chat"
  | "generation"
  | "edit"
  | "code"
  | "planning"
  | "bugfix"
  | "design"
  | "qa"
  | "seo";

export type AiAgentRole = "arquiteto" | "designer" | "programador" | "qa" | "seo";

export type AiAgentResult = {
  role: AiAgentRole;
  ok: boolean;
  output: string;
  provider?: AiProviderId;
  model?: string;
  error?: string;
};

export type AiGeneratedArtifact = {
  path: string;
  language: string;
  description: string;
  content?: string;
};

export type AiGenerationBlueprint = {
  professionalPrompt?: string;
  reply?: string;
  projectName?: string;
  kind?: "saas" | "site" | "landing" | "dashboard";
  industry?: string;
  features?: string[];
  pages?: string[];
  components?: string[];
  apis?: string[];
  databaseModels?: string[];
  files?: AiGeneratedArtifact[];
  architecture?: string[];
  design?: string[];
  code?: string[];
  qaChecks?: string[];
  seo?: string[];
  devops?: string[];
  componentLibrary?: string[];
  editNotes?: string[];
};

export type AiEngineReport = {
  usedExternal: boolean;
  task: AiTaskKind;
  modelMode: AiModelMode;
  resolvedMode: Exclude<AiModelMode, "auto">;
  provider?: AiProviderId;
  model?: string;
  reason: string;
  calls: number;
  agents: AiAgentResult[];
  fallbackReason?: string;
  estimatedTokenCost: number;
};

export type AiEnhancement = {
  blueprint: AiGenerationBlueprint | null;
  report: AiEngineReport;
  memoryContext: string;
};
