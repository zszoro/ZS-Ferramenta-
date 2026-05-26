import { builderAgents } from "./agents";

export type KnowledgeDocument = {
  id: string;
  path: string;
  title: string;
  type: "project" | "component" | "design" | "api" | "agent" | "template" | "memory";
  tags: string[];
  content: string;
};

export type RagMatch = KnowledgeDocument & {
  score: number;
};

export const baseKnowledgeDocuments: KnowledgeDocument[] = [
  {
    id: "project-architecture",
    path: "docs/architecture.md",
    title: "Arquitetura atual da ZS Ferramenta",
    type: "project",
    tags: ["nextjs", "chat", "preview", "generator", "tokens"],
    content:
      "Next.js 16 App Router, React 19, Tailwind 4. UI principal em AiBuilderApp, API principal em /api/ai/chat, motor local em src/lib/ai-builder/generator.ts, preview em iframe sandbox.",
  },
  {
    id: "main-builder-ui",
    path: "src/components/ai-builder-app.tsx",
    title: "Interface principal chat + preview",
    type: "component",
    tags: ["chat", "preview", "auth", "tokens", "settings", "modal"],
    content:
      "Controla login local, onboarding, chat, modal Criar projeto, preview redimensionavel, tela cheia, tokens, planos, configuracoes, conta e arquivos criados.",
  },
  {
    id: "local-generator",
    path: "src/lib/ai-builder/generator.ts",
    title: "Motor local de geracao e edicao",
    type: "project",
    tags: ["generator", "preview-html", "templates", "edits", "brief"],
    content:
      "Interpreta conversa, cria projetos a partir de briefing, edita projeto atual, escolhe nicho, paleta, imagens, arquivos sugeridos e HTML de preview.",
  },
  {
    id: "bakery-template",
    path: "templates/bakery-site.prompt.md",
    title: "Template completo para site de padaria",
    type: "template",
    tags: ["padaria", "produtos", "cardapio", "whatsapp", "depoimentos"],
    content:
      "Cabecalho fixo, hero com imagem, sobre, diferenciais, produtos por categoria, combo do cafe da manha, depoimentos, contato com mapa e rodape responsivo.",
  },
  {
    id: "auth-modal-template",
    path: "components/auth/login-register-modal.tsx.txt",
    title: "Modal reutilizavel de login e cadastro",
    type: "component",
    tags: ["login", "cadastro", "modal", "auth"],
    content:
      "Modal central com backdrop blur, abas entrar/cadastrar, campos de nome, email, senha, confirmacao, validacao e estados de erro.",
  },
  {
    id: "billing-modal-template",
    path: "components/billing/pricing-modal.tsx.txt",
    title: "Modal de planos e tokens",
    type: "component",
    tags: ["tokens", "assinatura", "mercado pago", "pricing"],
    content:
      "Modal com tres planos, beneficios, tokens semanais, CTA de assinatura e ponto preparado para Mercado Pago via backend.",
  },
  ...builderAgents.map((agent): KnowledgeDocument => ({
    id: `agent-${agent.id}`,
    path: `agents/${agent.id}.md`,
    title: agent.name,
    type: "agent",
    tags: [agent.id, "multiagente", "ia"],
    content: `${agent.mission} Responsabilidades: ${agent.responsibilities.join(", ")}.`,
  })),
];

export function searchProjectKnowledge(query: string, limit = 5): RagMatch[] {
  const queryVector = vectorize(query);

  return baseKnowledgeDocuments
    .map((document) => {
      const haystack = `${document.title} ${document.tags.join(" ")} ${document.content}`;
      return {
        ...document,
        score: cosineSimilarity(queryVector, vectorize(haystack)),
      };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function buildRagContext(query: string) {
  const matches = searchProjectKnowledge(query, 6);
  const context = matches
    .map(
      (match, index) =>
        `${index + 1}. ${match.title} (${match.path}) - ${match.content}`,
    )
    .join("\n");

  return {
    matches,
    context,
  };
}

function vectorize(input: string) {
  const words = normalize(input)
    .split(/[^a-z0-9]+/g)
    .filter((word) => word.length > 2 && !stopWords.has(word));
  const vector = new Map<string, number>();

  for (const word of words) {
    vector.set(word, (vector.get(word) ?? 0) + 1);
  }

  return vector;
}

function cosineSimilarity(left: Map<string, number>, right: Map<string, number>) {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (const value of left.values()) leftMagnitude += value * value;
  for (const value of right.values()) rightMagnitude += value * value;

  for (const [key, value] of left.entries()) {
    dot += value * (right.get(key) ?? 0);
  }

  if (!leftMagnitude || !rightMagnitude) return 0;
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function normalize(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const stopWords = new Set([
  "para",
  "com",
  "uma",
  "que",
  "por",
  "dos",
  "das",
  "este",
  "essa",
  "esse",
  "site",
  "criar",
  "troque",
  "mude",
  "adicione",
]);
