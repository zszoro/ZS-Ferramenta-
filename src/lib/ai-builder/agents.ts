export type BuilderAgentId =
  | "planning"
  | "ui"
  | "backend"
  | "refactor"
  | "debug"
  | "devops"
  | "vision";

export type BuilderAgent = {
  id: BuilderAgentId;
  name: string;
  mission: string;
  responsibilities: string[];
};

export const builderAgents: BuilderAgent[] = [
  {
    id: "planning",
    name: "Planning Agent",
    mission: "Transformar pedidos soltos em arquitetura, escopo e ordem de execucao.",
    responsibilities: [
      "identificar tipo de produto",
      "quebrar a entrega em secoes, paginas e componentes",
      "definir quais templates e componentes reutilizar",
    ],
  },
  {
    id: "ui",
    name: "UI Agent",
    mission: "Criar interfaces bonitas, responsivas e coerentes com o nicho.",
    responsibilities: [
      "definir hierarquia visual",
      "aplicar cores, tipografia e espacamento",
      "selecionar imagens coerentes com o pedido",
    ],
  },
  {
    id: "backend",
    name: "Backend Agent",
    mission: "Preparar APIs, banco, autenticacao e regras de negocio.",
    responsibilities: [
      "sugerir rotas e contratos",
      "proteger secrets no backend",
      "modelar usuarios, projetos, tokens e assinaturas",
    ],
  },
  {
    id: "refactor",
    name: "Refactor Agent",
    mission: "Evitar duplicacao e manter componentes reutilizaveis.",
    responsibilities: [
      "procurar componentes parecidos",
      "extrair blocos repetidos",
      "preservar padroes do projeto",
    ],
  },
  {
    id: "debug",
    name: "Debug Agent",
    mission: "Encontrar causas reais de erros e validar a correcao.",
    responsibilities: [
      "ler logs e stack traces",
      "reproduzir bugs",
      "confirmar comportamento no preview",
    ],
  },
  {
    id: "devops",
    name: "DevOps Agent",
    mission: "Preparar build, deploy, rollback e integracoes de hospedagem.",
    responsibilities: [
      "validar comandos de build",
      "mapear variaveis de ambiente",
      "acompanhar status da Vercel",
    ],
  },
  {
    id: "vision",
    name: "Vision Agent",
    mission: "Converter screenshots e referencias visuais em componentes.",
    responsibilities: [
      "detectar cores, layout e espacamento",
      "reconstruir interfaces a partir de imagens",
      "comparar preview com referencia",
    ],
  },
];

export function buildAgentPlan(prompt: string, industry: string) {
  const lower = normalize(prompt);
  const plan = [
    "Planning Agent: consolidar briefing, nicho, paginas e secoes esperadas.",
    "UI Agent: escolher layout, imagens, cores e responsividade do preview.",
    "Refactor Agent: procurar templates e blocos reutilizaveis antes de criar novos.",
  ];

  if (
    lower.includes("api") ||
    lower.includes("banco") ||
    lower.includes("login") ||
    lower.includes("pagamento") ||
    lower.includes("sistema")
  ) {
    plan.push("Backend Agent: preparar contratos de API, autenticacao, banco e seguranca.");
  }

  if (lower.includes("erro") || lower.includes("bug") || lower.includes("nao funciona")) {
    plan.push("Debug Agent: reproduzir o problema e validar a correcao no preview.");
  }

  if (lower.includes("deploy") || lower.includes("vercel") || lower.includes("rollback")) {
    plan.push("DevOps Agent: validar build, deploy e historico de versoes.");
  }

  if (lower.includes("print") || lower.includes("screenshot") || lower.includes("imagem")) {
    plan.push("Vision Agent: analisar referencia visual e selecionar assets coerentes.");
  }

  if (industry !== "negocios digitais") {
    plan.push(`UI Agent: aplicar copy e imagens especificas para ${industry}.`);
  }

  return plan;
}

function normalize(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
