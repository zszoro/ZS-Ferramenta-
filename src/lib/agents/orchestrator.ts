import { recommendReusableArtifacts } from "@/lib/rag/search";
import type { AgentPlan, SearchResult } from "@/lib/rag/types";
import { getAgentName, selectAgentsForPrompt } from "./registry";

export function createAgentPlan(prompt: string, evidence: SearchResult[]): AgentPlan {
  const evidenceKinds = evidence.map((item) => item.kind);
  const selectedAgents = selectAgentsForPrompt(prompt, evidenceKinds);
  const evidencePaths = evidence.slice(0, 4).map((item) => item.path);
  const reusableArtifacts = recommendReusableArtifacts(evidence);
  const agentNames = selectedAgents.map(getAgentName);

  return {
    prompt,
    selectedAgents: agentNames,
    summary:
      evidence.length > 0
        ? `Plano criado com ${evidence.length} evidências do RAG e ${agentNames.length} agentes.`
        : `Plano criado sem índice carregado; rode a indexação para recuperar padrões reais dos repositórios.`,
    steps: [
      {
        title: "Buscar contexto semelhante",
        agent: "Planning Agent",
        detail:
          "Consultar a base vetorial, priorizando componentes, rotas, schemas e estilos que já existem.",
        evidencePaths,
      },
      {
        title: "Definir reaproveitamento",
        agent: agentNames.includes("Refactor Agent") ? "Refactor Agent" : "UI Agent",
        detail:
          "Separar o que será reutilizado, adaptado ou criado do zero para evitar duplicação.",
        evidencePaths,
      },
      {
        title: "Implementar com contratos claros",
        agent: agentNames.includes("Backend Agent") ? "Backend Agent" : "UI Agent",
        detail:
          "Editar arquivos com TypeScript estrito, imports consistentes, estado acessível e rotas seguras.",
        evidencePaths,
      },
      {
        title: "Verificar preview, build e riscos",
        agent: agentNames.includes("Debug Agent") ? "Debug Agent" : "DevOps Agent",
        detail:
          "Rodar lint, typecheck, build e preview quando houver superfície visual ou API relevante.",
        evidencePaths,
      },
    ],
    reusableArtifacts:
      reusableArtifacts.length > 0
        ? reusableArtifacts
        : [
            "componentes existentes antes de novos componentes",
            "tokens visuais antes de cores ad hoc",
            "contratos de API antes de novas rotas",
          ],
    risks: [
      "Não expor secrets no frontend",
      "Não duplicar componentes sem busca RAG",
      "Validar preview quando alterar site",
      "Comitar apenas mudanças relacionadas ao pedido",
    ],
  };
}
