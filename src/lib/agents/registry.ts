import type { AgentKey } from "@/data/platform";

export type AgentDefinition = {
  key: AgentKey;
  name: string;
  triggers: string[];
  domains: string[];
};

export const agentDefinitions: AgentDefinition[] = [
  {
    key: "ui",
    name: "UI Agent",
    triggers: ["site", "tela", "design", "ux", "componente", "landing", "dashboard"],
    domains: ["frontend", "component", "style", "page"],
  },
  {
    key: "backend",
    name: "Backend Agent",
    triggers: ["api", "banco", "auth", "login", "permissao", "schema", "server"],
    domains: ["api", "schema"],
  },
  {
    key: "refactor",
    name: "Refactor Agent",
    triggers: ["refatorar", "limpar", "otimizar", "duplicado", "performance"],
    domains: ["code", "component", "config"],
  },
  {
    key: "debug",
    name: "Debug Agent",
    triggers: ["erro", "bug", "falha", "stack", "quebrou", "debug"],
    domains: ["test", "api", "code"],
  },
  {
    key: "devops",
    name: "DevOps Agent",
    triggers: ["deploy", "docker", "vercel", "ci", "railway", "render", "vps"],
    domains: ["config", "documentation"],
  },
  {
    key: "vision",
    name: "Vision Agent",
    triggers: ["print", "screenshot", "imagem", "figma", "ocr", "visual"],
    domains: ["asset", "style", "component"],
  },
  {
    key: "planning",
    name: "Planning Agent",
    triggers: ["planeje", "arquitetura", "sistema", "produto", "saas", "criar"],
    domains: ["documentation", "config", "code"],
  },
];

export function selectAgentsForPrompt(prompt: string, evidenceKinds: string[]) {
  const normalized = prompt.toLowerCase();
  const selected = new Set<AgentKey>(["planning"]);

  for (const agent of agentDefinitions) {
    if (
      agent.triggers.some((trigger) => normalized.includes(trigger)) ||
      evidenceKinds.some((kind) => agent.domains.includes(kind))
    ) {
      selected.add(agent.key);
    }
  }

  if (selected.size === 1) {
    selected.add("ui");
    selected.add("backend");
  }

  return Array.from(selected);
}

export function getAgentName(key: AgentKey) {
  return agentDefinitions.find((agent) => agent.key === key)?.name ?? key;
}
