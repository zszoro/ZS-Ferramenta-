"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Command,
  Database,
  FileSearch,
  GitBranch,
  LoaderCircle,
  Play,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  TerminalSquare,
  Zap,
} from "lucide-react";
import {
  accentClassByName,
  agents,
  automationBacklog,
  codeQualityChecks,
  commandPalette,
  defaultAssistantAnswer,
  deploymentTargets,
  interfaceModes,
  memoryAreas,
  metricCards,
  missionStatement,
  navItems,
  platformCapabilities,
  preferredStack,
  productPrinciples,
  ragPipeline,
  reusableArtifacts,
  roadmap,
  sampleKnowledgeResults,
  sourceTrustLevels,
  starterPrompts,
  systemStatus,
} from "@/data/platform";

type IndexMeta = {
  generatedAt: string;
  rootLabel: string;
  stats: {
    roots: number;
    files: number;
    chunks: number;
    dimensions: number;
    ignoredFiles: number;
  };
  storePath: string;
};

type SearchResult = {
  id: string;
  path: string;
  title: string;
  kind: string;
  score: number;
  reason: string;
  highlights: string[];
  signals: string[];
};

type AgentPlan = {
  summary: string;
  selectedAgents: string[];
  reusableArtifacts: string[];
  risks: string[];
  steps: Array<{
    title: string;
    agent: string;
    detail: string;
    evidencePaths: string[];
  }>;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const initialMessages: Message[] = [
  {
    id: "assistant-ready",
    role: "assistant",
    text: defaultAssistantAnswer,
  },
];

export function ZSPlatform() {
  const [activeNav, setActiveNav] = useState(navItems[0]);
  const [activeMode, setActiveMode] = useState(interfaceModes[0].label);
  const [selectedAgent, setSelectedAgent] = useState(agents[0].key);
  const [prompt, setPrompt] = useState(starterPrompts[0]);
  const [query, setQuery] = useState("componentes dashboard auth deploy");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [indexMeta, setIndexMeta] = useState<IndexMeta | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const selectedAgentProfile = useMemo(
    () => agents.find((agent) => agent.key === selectedAgent) ?? agents[0],
    [selectedAgent],
  );

  useEffect(() => {
    void refreshIndexStatus();
  }, []);

  async function refreshIndexStatus() {
    const response = await fetch("/api/knowledge/index");
    const payload = (await response.json()) as { indexed: boolean; meta: IndexMeta };
    setIndexMeta(payload.indexed ? payload.meta : null);
  }

  async function indexWorkspace() {
    setIsIndexing(true);
    setError(null);
    setStatus("Indexando repositório atual...");

    try {
      const response = await fetch("/api/knowledge/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roots: ["."] }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Falha ao indexar workspace.");
      }

      setIndexMeta({
        generatedAt: payload.index.generatedAt,
        rootLabel: payload.index.rootLabel,
        stats: payload.index.stats,
        storePath: payload.storePath,
      });
      setStatus(
        `Índice atualizado: ${payload.summary.files} arquivos e ${payload.summary.chunks} chunks.`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro inesperado.");
    } finally {
      setIsIndexing(false);
    }
  }

  async function searchKnowledge() {
    setIsSearching(true);
    setError(null);
    setStatus("Buscando na base vetorial...");

    try {
      const response = await fetch("/api/knowledge/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, filters: { limit: 6 } }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Falha na busca.");
      }

      setResults(payload.results);
      setStatus(`${payload.results.length} resultados recuperados para reutilização.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro inesperado.");
    } finally {
      setIsSearching(false);
    }
  }

  async function generatePlan() {
    setIsPlanning(true);
    setError(null);
    setStatus("Orquestrando agentes...");

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      text: prompt,
    };
    setMessages((current) => [...current, userMessage]);

    try {
      const response = await fetch("/api/agents/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Falha ao gerar plano.");
      }

      setPlan(payload.plan);
      setResults(payload.evidence);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: payload.plan.summary,
        },
      ]);
      setStatus("Plano multiagente criado com contexto recuperado.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro inesperado.");
    } finally {
      setIsPlanning(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#070a0f] text-slate-100">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[92px_minmax(0,1fr)_360px]">
        <aside className="hidden border-r border-white/10 bg-[#080d13] lg:flex lg:flex-col lg:items-center lg:gap-4 lg:px-3 lg:py-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 text-lg font-black text-cyan-100">
            ZS
          </div>
          <nav className="flex w-full flex-1 flex-col gap-2" aria-label="Navegação principal">
            {navItems.map((item) => (
              <button
                key={item}
                className={`rounded-md px-2 py-3 text-xs font-semibold transition ${
                  activeNav === item
                    ? "bg-white/[0.12] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
                    : "text-slate-500 hover:bg-white/[0.08] hover:text-slate-200"
                }`}
                onClick={() => setActiveNav(item)}
                title={item}
                type="button"
              >
                {item}
              </button>
            ))}
          </nav>
          <div className="rounded-md border border-emerald-300/25 bg-emerald-300/10 p-2 text-emerald-200">
            <Activity className="h-4 w-4" aria-hidden="true" />
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-white/10 bg-[#070a0f]/92 px-4 py-3 backdrop-blur md:px-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/70">
                  ZS Ferramenta
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-normal text-white md:text-3xl">
                  Sistema de IA Desenvolvedora Full Stack
                </h1>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex min-w-0 items-center gap-2 rounded-md border border-white/10 bg-white/6 px-3 py-2">
                  <Command className="h-4 w-4 text-cyan-200" aria-hidden="true" />
                  <input
                    className="min-w-0 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500 sm:w-80"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar componentes, APIs, estilos..."
                    aria-label="Consulta na base de conhecimento"
                  />
                </div>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-70"
                  onClick={searchKnowledge}
                  disabled={isSearching}
                  type="button"
                >
                  {isSearching ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Search className="h-4 w-4" aria-hidden="true" />
                  )}
                  Buscar
                </button>
              </div>
            </div>
          </header>

          <div className="space-y-5 px-4 py-5 md:px-6">
            <StatusStrip indexMeta={indexMeta} />

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
              <div className="rounded-lg border border-white/10 bg-[#0b1119]">
                <div className="flex flex-col gap-3 border-b border-white/10 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Chat Desenvolvedor</h2>
                    <p className="mt-1 text-sm text-slate-400">{missionStatement}</p>
                  </div>
                  <div className="w-full overflow-x-auto md:w-auto">
                    <div className="inline-flex min-w-max rounded-md border border-white/10 bg-white/5 p-1">
                      {interfaceModes.map((mode) => {
                        const Icon = mode.icon;
                        return (
                          <button
                            key={mode.label}
                            className={`inline-flex shrink-0 items-center gap-2 rounded px-3 py-2 text-xs font-semibold transition ${
                              activeMode === mode.label
                                ? "bg-white text-slate-950"
                                : "text-slate-400 hover:bg-white/10 hover:text-white"
                            }`}
                            onClick={() => setActiveMode(mode.label)}
                            type="button"
                          >
                            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                            {mode.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="space-y-4">
                    <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`rounded-md border p-3 ${
                            message.role === "assistant"
                              ? "border-cyan-300/20 bg-cyan-300/[0.08]"
                              : "border-white/10 bg-white/6"
                          }`}
                        >
                          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                            {message.role === "assistant" ? (
                              <Zap className="h-3.5 w-3.5 text-cyan-200" aria-hidden="true" />
                            ) : (
                              <TerminalSquare className="h-3.5 w-3.5 text-amber-200" aria-hidden="true" />
                            )}
                            {message.role === "assistant" ? "IA ZS" : "Pedido"}
                          </div>
                          <p className="text-sm leading-6 text-slate-200">{message.text}</p>
                        </div>
                      ))}
                    </div>

                    <label className="block">
                      <span className="sr-only">Pedido para IA desenvolvedora</span>
                      <textarea
                        className="min-h-28 w-full resize-y rounded-md border border-white/10 bg-[#070a0f] p-3 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60"
                        value={prompt}
                        onChange={(event) => setPrompt(event.target.value)}
                        placeholder="Descreva o sistema, site, API, dashboard ou correção..."
                      />
                    </label>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-300 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-wait disabled:opacity-70"
                        onClick={generatePlan}
                        disabled={isPlanning}
                        type="button"
                      >
                        {isPlanning ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Send className="h-4 w-4" aria-hidden="true" />
                        )}
                        Gerar plano multiagente
                      </button>
                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-md border border-white/[0.12] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]"
                        onClick={indexWorkspace}
                        disabled={isIndexing}
                        type="button"
                      >
                        {isIndexing ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <Database className="h-4 w-4" aria-hidden="true" />
                        )}
                        Indexar repo atual
                      </button>
                    </div>

                    {(status || error) && (
                      <div
                        className={`rounded-md border px-3 py-2 text-sm ${
                          error
                            ? "border-rose-300/30 bg-rose-300/10 text-rose-100"
                            : "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
                        }`}
                      >
                        {error ?? status}
                      </div>
                    )}
                  </div>

                  <div className="rounded-md border border-white/10 bg-white/5 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">Prompt rápido</h3>
                      <Play className="h-4 w-4 text-cyan-200" aria-hidden="true" />
                    </div>
                    <div className="space-y-2">
                      {starterPrompts.map((item) => (
                        <button
                          key={item}
                          className="w-full rounded border border-white/[0.08] px-3 py-2 text-left text-xs leading-5 text-slate-300 transition hover:border-cyan-300/[0.35] hover:bg-cyan-300/[0.08] hover:text-white"
                          onClick={() => setPrompt(item)}
                          type="button"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <PlanPanel plan={plan} />
            </section>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {metricCards.map((metric) => (
                <div key={metric.label} className="rounded-lg border border-white/10 bg-[#0b1119] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {metric.label}
                  </p>
                  <p className="mt-3 text-2xl font-bold text-white">{metric.value}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{metric.detail}</p>
                </div>
              ))}
            </section>

            <CapabilityGrid />

            <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="rounded-lg border border-white/10 bg-[#0b1119] p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">Base de Conhecimento</h2>
                  <button
                    className="inline-flex items-center gap-2 rounded-md border border-white/[0.12] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.08]"
                    onClick={refreshIndexStatus}
                    type="button"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Atualizar
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {ragPipeline.map((item, index) => (
                    <div key={item} className="flex gap-3 rounded-md border border-white/[0.08] bg-white/5 p-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-cyan-300/25 bg-cyan-300/10 text-xs font-bold text-cyan-100">
                        {index + 1}
                      </span>
                      <p className="text-sm leading-6 text-slate-300">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-[#0b1119] p-4">
                <div className="mb-4 flex items-center gap-2">
                  <FileSearch className="h-5 w-5 text-cyan-200" aria-hidden="true" />
                  <h2 className="text-lg font-semibold text-white">Resultados RAG</h2>
                </div>
                <div className="space-y-3">
                  {(results.length > 0 ? results : sampleKnowledgeResults).map((result) => (
                    <div
                      key={"id" in result ? result.id : result.path}
                      className="rounded-md border border-white/[0.08] bg-white/5 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-xs font-bold text-cyan-100">
                          {"kind" in result ? result.kind : "seed"}
                        </span>
                        <p className="text-sm font-semibold text-white">{result.title}</p>
                        <span className="ml-auto text-xs font-semibold text-emerald-200">
                          {Math.round(result.score * 100)}%
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-mono text-slate-500">{result.path}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {"highlights" in result
                          ? result.highlights[0] ?? result.reason
                          : result.summary}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <ReuseAndRoadmap />

            <section className="grid gap-4 xl:grid-cols-3">
              <AgentsPanel
                selectedAgent={selectedAgent}
                onSelect={setSelectedAgent}
              />

              <div className="rounded-lg border border-white/10 bg-[#0b1119] p-4 xl:col-span-2">
                <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{selectedAgentProfile.name}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      {selectedAgentProfile.mission}
                    </p>
                  </div>
                  <span
                    className={`rounded border px-2 py-1 text-xs font-bold ${
                      accentClassByName[selectedAgentProfile.accent]
                    }`}
                  >
                    ativo
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <DetailList title="Responsabilidades" items={selectedAgentProfile.responsibilities} />
                  <DetailList title="Entradas" items={selectedAgentProfile.inputs} />
                  <DetailList title="Saídas" items={selectedAgentProfile.outputs} />
                </div>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-3">
              <InfoPanel
                title="Editor Inteligente"
                icon={<GitBranch className="h-5 w-5" aria-hidden="true" />}
                items={codeQualityChecks}
              />
              <InfoPanel
                title="Deploy"
                icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
                items={deploymentTargets}
              />
              <InfoPanel
                title="Automação"
                icon={<Zap className="h-5 w-5" aria-hidden="true" />}
                items={automationBacklog}
              />
            </section>
          </div>
        </section>

        <aside className="border-l border-white/10 bg-[#090f16] px-4 py-5 md:px-5">
          <div className="sticky top-5 space-y-4">
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <h2 className="text-lg font-semibold text-white">Memória</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Persistência interna para aprender padrões de projeto, UI, backend e deploy.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {memoryAreas.map((area) => (
                  <span
                    key={area}
                    className="rounded border border-white/[0.08] bg-[#070a0f] px-2 py-2 text-xs font-medium text-slate-300"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <h2 className="text-lg font-semibold text-white">Stack principal</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {preferredStack.map((item) => (
                  <span
                    key={item}
                    className="rounded border border-cyan-300/20 bg-cyan-300/[0.08] px-2 py-1 text-xs font-semibold text-cyan-100"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <h2 className="text-lg font-semibold text-white">Comandos</h2>
              <div className="mt-3 space-y-2">
                {commandPalette.map((command) => (
                  <div key={command} className="flex items-center gap-2 text-sm text-slate-300">
                    <ArrowRight className="h-3.5 w-3.5 text-cyan-200" aria-hidden="true" />
                    {command}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <h2 className="text-lg font-semibold text-white">Confiança</h2>
              <div className="mt-3 space-y-2">
                {sourceTrustLevels.map((level) => (
                  <div key={level} className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-200" aria-hidden="true" />
                    {level}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function StatusStrip({ indexMeta }: { indexMeta: IndexMeta | null }) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {systemStatus.map((item) => (
        <div key={item.label} className="rounded-lg border border-white/10 bg-[#0b1119] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {item.label}
          </p>
          <p className="mt-2 text-sm font-bold text-white">{item.value}</p>
        </div>
      ))}
      <div className="rounded-lg border border-white/10 bg-[#0b1119] p-3 md:col-span-2 xl:col-span-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-300">
            {indexMeta
              ? `Base indexada em ${new Date(indexMeta.generatedAt).toLocaleString("pt-BR")}: ${indexMeta.stats.files} arquivos, ${indexMeta.stats.chunks} chunks.`
              : "Base ainda não indexada nesta máquina. Use Indexar repo atual para criar .zs/knowledge-base.json."}
          </p>
          <span className="rounded border border-emerald-300/25 bg-emerald-300/10 px-2 py-1 text-xs font-bold text-emerald-100">
            {indexMeta ? indexMeta.rootLabel : "aguardando índice"}
          </span>
        </div>
      </div>
    </section>
  );
}

function PlanPanel({ plan }: { plan: AgentPlan | null }) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0b1119] p-4">
      <div className="mb-4 flex items-center gap-2">
        <Zap className="h-5 w-5 text-emerald-200" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-white">Plano de Execução</h2>
      </div>

      {plan ? (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-slate-300">{plan.summary}</p>
          <div className="flex flex-wrap gap-2">
            {plan.selectedAgents.map((agent) => (
              <span
                key={agent}
                className="rounded border border-emerald-300/25 bg-emerald-300/10 px-2 py-1 text-xs font-semibold text-emerald-100"
              >
                {agent}
              </span>
            ))}
          </div>
          <div className="space-y-3">
            {plan.steps.map((step, index) => (
              <div key={step.title} className="rounded-md border border-white/[0.08] bg-white/5 p-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-white text-xs font-black text-slate-950">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{step.title}</p>
                    <p className="text-xs text-cyan-200">{step.agent}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-300">{step.detail}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {productPrinciples.map((principle) => (
            <div key={principle.title} className="rounded-md border border-white/[0.08] bg-white/5 p-3">
              <p className="text-sm font-semibold text-white">{principle.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{principle.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentsPanel({
  selectedAgent,
  onSelect,
}: {
  selectedAgent: string;
  onSelect: (agent: typeof agents[number]["key"]) => void;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0b1119] p-4">
      <h2 className="text-lg font-semibold text-white">Agentes</h2>
      <div className="mt-4 space-y-2">
        {agents.map((agent) => {
          const Icon = agent.icon;
          return (
            <button
              key={agent.key}
              className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition ${
                selectedAgent === agent.key
                  ? "border-cyan-300/40 bg-cyan-300/10"
                  : "border-white/[0.08] bg-white/5 hover:border-white/[0.18] hover:bg-white/[0.08]"
              }`}
              onClick={() => onSelect(agent.key)}
              type="button"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded border ${
                  accentClassByName[agent.accent]
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-white">{agent.name}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-400">{agent.mission}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-white/[0.08] bg-white/5 p-3">
      <p className="text-sm font-semibold text-white">{title}</p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-6 text-slate-300">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-200" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function InfoPanel({
  title,
  icon,
  items,
}: {
  title: string;
  icon: ReactNode;
  items: string[];
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0b1119] p-4">
      <div className="mb-4 flex items-center gap-2 text-cyan-200">
        {icon}
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item} className="flex items-center gap-2 text-sm text-slate-300">
            <CheckCircle2 className="h-4 w-4 text-emerald-200" aria-hidden="true" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CapabilityGrid() {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {platformCapabilities.map((capability) => {
        const Icon = capability.icon;
        return (
          <div key={capability.title} className="rounded-lg border border-white/10 bg-[#0b1119] p-4">
            <div
              className={`mb-4 flex h-10 w-10 items-center justify-center rounded border ${
                accentClassByName[capability.accent]
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold text-white">{capability.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{capability.description}</p>
          </div>
        );
      })}
    </section>
  );
}

export function ReuseAndRoadmap() {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <InfoPanel
        title="Artefatos reutilizáveis"
        icon={<Database className="h-5 w-5" aria-hidden="true" />}
        items={reusableArtifacts}
      />
      <div className="rounded-lg border border-white/10 bg-[#0b1119] p-4">
        <h2 className="text-lg font-semibold text-white">Roadmap</h2>
        <div className="mt-4 space-y-3">
          {roadmap.map((phase) => (
            <div key={phase.phase} className="rounded-md border border-white/[0.08] bg-white/5 p-3">
              <p className="text-sm font-semibold text-white">{phase.phase}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{phase.items.join(", ")}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
