import {
  Bot,
  Braces,
  Bug,
  Cloud,
  Code2,
  Eye,
  Layers3,
  Paintbrush,
  Route,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AgentKey =
  | "ui"
  | "backend"
  | "refactor"
  | "debug"
  | "devops"
  | "vision"
  | "planning";

export type AgentProfile = {
  key: AgentKey;
  name: string;
  shortName: string;
  mission: string;
  icon: LucideIcon;
  accent: string;
  responsibilities: string[];
  inputs: string[];
  outputs: string[];
};

export const agents: AgentProfile[] = [
  {
    key: "ui",
    name: "UI Agent",
    shortName: "UI",
    mission: "Design, UX, acessibilidade, responsividade e animações.",
    icon: Paintbrush,
    accent: "cyan",
    responsibilities: [
      "Mapear identidade visual por projeto",
      "Reutilizar componentes e tokens existentes",
      "Criar telas responsivas com estados reais",
      "Validar contraste, foco, teclado e leitura",
    ],
    inputs: ["screenshots", "componentes", "tokens", "páginas"],
    outputs: ["componentes React", "tokens", "wireframes", "checklist UX"],
  },
  {
    key: "backend",
    name: "Backend Agent",
    shortName: "API",
    mission: "APIs, banco de dados, autenticação, permissões e segurança.",
    icon: Braces,
    accent: "emerald",
    responsibilities: [
      "Detectar padrões de rotas e contratos",
      "Projetar schemas Prisma, Drizzle ou SQL",
      "Proteger secrets e rotas privadas",
      "Criar endpoints com validação e logs úteis",
    ],
    inputs: ["schemas", "migrations", "routes", "env"],
    outputs: ["route handlers", "schemas", "políticas", "testes API"],
  },
  {
    key: "refactor",
    name: "Refactor Agent",
    shortName: "Refactor",
    mission: "Limpeza, modularização, performance e redução de duplicação.",
    icon: Wrench,
    accent: "amber",
    responsibilities: [
      "Encontrar código morto e duplicado",
      "Extrair primitivas reutilizáveis",
      "Preservar comportamento com mudanças pequenas",
      "Medir impacto em bundle e renderização",
    ],
    inputs: ["arquivos similares", "imports", "testes", "bundle"],
    outputs: ["diffs focados", "componentes compartilhados", "notas de risco"],
  },
  {
    key: "debug",
    name: "Debug Agent",
    shortName: "Debug",
    mission: "Erros, stack traces, regressões visuais e bugs complexos.",
    icon: Bug,
    accent: "rose",
    responsibilities: [
      "Reproduzir falhas antes de corrigir",
      "Isolar causa raiz em logs e traces",
      "Criar correções pequenas e verificáveis",
      "Registrar cenário de regressão",
    ],
    inputs: ["logs", "stack traces", "prints", "testes falhando"],
    outputs: ["diagnóstico", "patch", "teste de regressão", "evidência"],
  },
  {
    key: "devops",
    name: "DevOps Agent",
    shortName: "DevOps",
    mission: "Deploy, Docker, CI/CD, Vercel, VPS e automações.",
    icon: Cloud,
    accent: "sky",
    responsibilities: [
      "Detectar alvo de deploy correto",
      "Gerar Dockerfile, workflows e configs",
      "Validar variáveis ambiente",
      "Planejar rollback e versionamento",
    ],
    inputs: ["vercel.json", "Dockerfile", "workflows", "env"],
    outputs: ["pipelines", "deploy notes", "health checks", "rollback plan"],
  },
  {
    key: "vision",
    name: "Vision Agent",
    shortName: "Vision",
    mission: "Análise de imagens, OCR e reconstrução de interfaces.",
    icon: Eye,
    accent: "violet",
    responsibilities: [
      "Extrair layout de screenshots",
      "Detectar cores, fontes e espaçamentos",
      "Transformar referência visual em componentes",
      "Comparar implementação com design",
    ],
    inputs: ["prints", "mockups", "assets", "screencasts"],
    outputs: ["inventário visual", "componentes", "tokens", "relatório QA"],
  },
  {
    key: "planning",
    name: "Planning Agent",
    shortName: "Plan",
    mission: "Arquitetura, decomposição técnica e decisões de produto.",
    icon: Route,
    accent: "lime",
    responsibilities: [
      "Converter pedido em plano executável",
      "Escolher agentes por risco e domínio",
      "Definir sequência de arquivos e testes",
      "Registrar decisões arquiteturais",
    ],
    inputs: ["pedido", "RAG", "histórico", "restrições"],
    outputs: ["plano", "riscos", "ordem de execução", "critérios de pronto"],
  },
];

export const platformCapabilities = [
  {
    title: "RAG entre repositórios",
    icon: Layers3,
    accent: "cyan",
    description:
      "Indexa código, docs e configurações em chunks vetoriais para recuperar contexto reutilizável.",
  },
  {
    title: "Chat desenvolvedor",
    icon: Bot,
    accent: "emerald",
    description:
      "Transforma pedidos em planos com agentes, busca semântica e recomendações de componentes.",
  },
  {
    title: "Editor inteligente",
    icon: Code2,
    accent: "amber",
    description:
      "Organiza mudanças por impacto: imports, tipos, rotas, duplicações, testes e preview.",
  },
  {
    title: "Segurança por padrão",
    icon: ShieldCheck,
    accent: "rose",
    description:
      "Mantém tokens no backend, bloqueia varredura fora do workspace e registra limites de acesso.",
  },
];

export const ragPipeline = [
  "Descobrir repositórios conectados",
  "Ignorar dependências e artefatos gerados",
  "Separar arquivos em chunks semânticos",
  "Gerar embeddings vetoriais locais",
  "Persistir índice de conhecimento",
  "Buscar por similaridade e intenção",
  "Recomendar agentes e componentes",
];

export const preferredStack = [
  "Next.js App Router",
  "React 19",
  "TypeScript",
  "Tailwind CSS 4",
  "Node.js Route Handlers",
  "Prisma ou Drizzle",
  "PostgreSQL / Supabase",
  "Framer Motion",
  "Zustand",
  "Docker",
  "Vercel",
];

export const memoryAreas = [
  "padrões de UI/UX",
  "cores e tipografia",
  "componentes reutilizáveis",
  "arquitetura predominante",
  "padrões de API",
  "autenticação e permissões",
  "organização de pastas",
  "responsividade",
  "segurança",
  "deploy e automações",
];

export const repositorySignals = [
  {
    label: "Frontend",
    value: "páginas, layouts, componentes, hooks, contextos e temas",
  },
  {
    label: "Backend",
    value: "APIs, middlewares, schemas, migrations, auth e permissões",
  },
  {
    label: "Produto",
    value: "dashboards, admin, SaaS, landing pages e fluxos de usuário",
  },
  {
    label: "Operação",
    value: "Docker, CI/CD, deploys, automações, testes e documentação",
  },
];

export const deploymentTargets = [
  "Vercel",
  "Netlify",
  "Docker",
  "VPS",
  "Railway",
  "Render",
];

export const starterPrompts = [
  "Crie um dashboard SaaS reutilizando padrões dos meus repositórios.",
  "Encontre componentes parecidos antes de criar uma nova tela.",
  "Analise este projeto e gere AGENTS.md com arquitetura e convenções.",
  "Planeje API, banco, auth e deploy para um produto completo.",
];

export const productPrinciples = [
  {
    title: "Reutilização antes de geração",
    body: "Toda solicitação começa por busca semântica em projetos, componentes, hooks, APIs e estilos similares.",
  },
  {
    title: "Contexto vivo",
    body: "A memória persiste padrões arquiteturais, identidade visual, decisões e relações entre módulos.",
  },
  {
    title: "Preview verificável",
    body: "Mudanças em sites devem rodar com preview, logs e correções automáticas sempre que possível.",
  },
  {
    title: "Código seguro",
    body: "Secrets ficam no backend, escopos de indexação são explícitos e rotas sensíveis exigem validação.",
  },
];

export const accentClassByName: Record<string, string> = {
  cyan: "text-cyan-300 border-cyan-400/30 bg-cyan-400/10",
  emerald: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
  amber: "text-amber-300 border-amber-400/30 bg-amber-400/10",
  rose: "text-rose-300 border-rose-400/30 bg-rose-400/10",
  sky: "text-sky-300 border-sky-400/30 bg-sky-400/10",
  violet: "text-violet-300 border-violet-400/30 bg-violet-400/10",
  lime: "text-lime-300 border-lime-400/30 bg-lime-400/10",
};

export const metricCards = [
  {
    label: "Agentes especializados",
    value: "7",
    detail: "UI, Backend, Refactor, Debug, DevOps, Vision e Planning",
  },
  {
    label: "Indexação",
    value: "local",
    detail: "Chunks, embeddings hash e busca por similaridade",
  },
  {
    label: "Segurança",
    value: "guarded",
    detail: "Escopo controlado por workspace e env allowlist",
  },
  {
    label: "Fluxo",
    value: "Lovable",
    detail: "Chat, preview, versionamento, rollback e deploy",
  },
];

export const defaultAssistantAnswer =
  "Pronto para analisar o workspace. Primeiro vou buscar projetos parecidos, depois recuperar componentes e só então gerar ou editar código com agentes especializados.";

export const sampleKnowledgeResults = [
  {
    path: "src/components",
    title: "Componentes reutilizáveis",
    score: 0.92,
    summary: "Procure padrões de cards, painéis, tabelas, formulários e shells antes de criar novos componentes.",
  },
  {
    path: "src/app/api",
    title: "Contratos backend",
    score: 0.87,
    summary: "Route handlers devem validar entrada, evitar secrets no cliente e retornar erros úteis.",
  },
  {
    path: "AGENTS.md",
    title: "Regras do projeto",
    score: 0.81,
    summary: "Arquivo central para arquitetura encontrada, convenções e fluxo recomendado de desenvolvimento.",
  },
];

export const automationBacklog = [
  "Indexar workspace ao abrir projeto",
  "Detectar alterações e atualizar chunks afetados",
  "Rodar preview após mudanças de frontend",
  "Gerar changelog técnico por commit",
  "Sugerir deploy e rollback por ambiente",
];

export const systemStatus = [
  { label: "RAG", value: "ativo", tone: "emerald" },
  { label: "Preview", value: "Next dev", tone: "cyan" },
  { label: "Versionamento", value: "Git", tone: "amber" },
  { label: "Secrets", value: "backend only", tone: "rose" },
];

export const missionStatement =
  "ZS Ferramenta transforma repositórios em uma base viva para gerar, editar, depurar e publicar sistemas web com consistência visual e arquitetural.";

export const navItems = [
  "Cockpit",
  "Chat",
  "Base",
  "Agentes",
  "Editor",
  "Deploy",
  "Memória",
];

export const codeQualityChecks = [
  "TypeScript estrito",
  "componentes pequenos",
  "imports organizados",
  "rotas documentadas",
  "estado acessível",
  "SEO e metadata",
  "testes por risco",
];

export const reusableArtifacts = [
  "componentes",
  "hooks",
  "tokens",
  "schemas",
  "migrations",
  "route handlers",
  "prompts",
  "workflows",
];

export const roadmap = [
  {
    phase: "Base atual",
    items: ["Next.js", "RAG local", "painel multiagente", "APIs de busca"],
  },
  {
    phase: "Próximo nível",
    items: ["conector GitHub", "embeddings externos opcionais", "preview live", "histórico de edições"],
  },
  {
    phase: "Modo produto",
    items: ["deploy automático", "rollback", "editor visual", "drag and drop"],
  },
];

export const commandPalette = [
  "Indexar repositório atual",
  "Buscar componente similar",
  "Gerar plano multiagente",
  "Criar AGENTS.md",
  "Preparar deploy Vercel",
  "Auditar segurança",
];

export const sourceTrustLevels = [
  "Código local",
  "Documentação do projeto",
  "Padrões detectados",
  "Histórico de conversa",
  "Preferências do usuário",
];

export const interfaceModes = [
  { label: "Construir", icon: Sparkles },
  { label: "Refatorar", icon: Wrench },
  { label: "Depurar", icon: Bug },
  { label: "Publicar", icon: Cloud },
];
