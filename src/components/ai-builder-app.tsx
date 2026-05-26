"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  Bot,
  Check,
  Copy,
  Eraser,
  LoaderCircle,
  Monitor,
  Send,
  Smartphone,
  Sparkles,
} from "lucide-react";
import type { BuilderProject } from "@/lib/ai-builder/generator";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const initialPrompt =
  "Crie um SaaS para restaurantes com dashboard, cadastro de clientes, planos de assinatura e landing page moderna.";

const examples = [
  "Crie um site para uma barbearia com agendamento pelo WhatsApp.",
  "Crie um SaaS financeiro com dashboard, login e planos pagos.",
  "Crie uma landing page para uma clínica com prova social e CTA.",
];

const initialMessages: Message[] = [
  {
    id: "intro",
    role: "assistant",
    text: "Sou a IA ZS Builder. Me diga o SaaS ou site que você quer e eu gero a estrutura com preview ao lado.",
  },
];

const buildStages = [
  "Entendendo o pedido",
  "Definindo layout",
  "Gerando componentes",
  "Montando preview",
];

export function AiBuilderApp() {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [project, setProject] = useState<BuilderProject | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const previewHtml = useMemo(() => project?.previewHtml ?? emptyPreview(), [project]);

  async function handleBuild(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || isBuilding) return;

    setError(null);
    setCopied(false);
    setIsBuilding(true);
    setStageIndex(0);
    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: "user", text: cleanPrompt },
    ]);

    const timer = window.setInterval(() => {
      setStageIndex((current) => Math.min(current + 1, buildStages.length - 1));
    }, 550);

    try {
      const response = await fetch("/api/ai/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: cleanPrompt }),
      });
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        project?: BuilderProject;
      };

      if (!response.ok || !payload.ok || !payload.project) {
        throw new Error(payload.error ?? "A IA não conseguiu gerar o projeto.");
      }

      const generatedProject = payload.project;
      setProject(generatedProject);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: `${generatedProject.summary} Arquivos sugeridos: ${generatedProject.files
            .map((file) => file.path)
            .join(", ")}.`,
        },
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro inesperado.");
    } finally {
      window.clearInterval(timer);
      setStageIndex(buildStages.length - 1);
      setIsBuilding(false);
    }
  }

  function applyExample(example: string) {
    setPrompt(example);
    textareaRef.current?.focus();
  }

  function clearWorkspace() {
    setPrompt("");
    setMessages(initialMessages);
    setProject(null);
    setError(null);
    setCopied(false);
    setStageIndex(0);
  }

  async function copyHtml() {
    if (!project) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(project.previewHtml);
      } else {
        copyWithTextarea(project.previewHtml);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      copyWithTextarea(project.previewHtml);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  function copyWithTextarea(value: string) {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  function exportHtml() {
    if (!project) return;
    const blob = new Blob([project.previewHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.html`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-[#06080d] text-slate-100">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[440px_minmax(0,1fr)]">
        <section className="flex min-h-screen flex-col border-r border-white/10 bg-[#0b1018]">
          <header className="border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-300 text-sm font-black text-slate-950">
                ZS
              </div>
              <div>
                <p className="text-sm font-bold tracking-[0.22em] text-cyan-200">
                  ZS BUILDER
                </p>
                <h1 className="text-xl font-semibold text-white">
                  Chat que cria sites e SaaS
                </h1>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className="space-y-3">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`rounded-lg border p-4 ${
                    message.role === "assistant"
                      ? "border-cyan-300/20 bg-cyan-300/[0.08]"
                      : "border-white/10 bg-white/[0.06]"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    {message.role === "assistant" ? (
                      <Bot className="h-4 w-4 text-cyan-200" aria-hidden="true" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-emerald-200" aria-hidden="true" />
                    )}
                    {message.role === "assistant" ? "IA ZS" : "Você"}
                  </div>
                  <p className="text-sm leading-6 text-slate-200">{message.text}</p>
                </article>
              ))}
            </div>

            {isBuilding && (
              <div className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-300/[0.08] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-100">
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {buildStages[stageIndex]}
                </div>
                <div className="grid gap-2">
                  {buildStages.map((stage, index) => (
                    <div
                      key={stage}
                      className={`flex items-center gap-2 text-sm ${
                        index <= stageIndex ? "text-slate-100" : "text-slate-500"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                          index <= stageIndex
                            ? "border-emerald-300 bg-emerald-300 text-slate-950"
                            : "border-white/15"
                        }`}
                      >
                        {index < stageIndex ? <Check className="h-3 w-3" /> : index + 1}
                      </span>
                      {stage}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-lg border border-rose-300/25 bg-rose-300/[0.08] p-3 text-sm text-rose-100">
                {error}
              </div>
            )}
          </div>

          <form className="border-t border-white/10 p-5" onSubmit={handleBuild}>
            <div className="mb-3 flex flex-wrap gap-2">
              {examples.map((example) => (
                <button
                  key={example}
                  className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs leading-5 text-slate-300 transition hover:border-cyan-300/40 hover:text-white"
                  onClick={() => applyExample(example)}
                  type="button"
                >
                  {example}
                </button>
              ))}
            </div>

            <label className="block">
              <span className="sr-only">Pedido para criar site ou SaaS</span>
              <textarea
                ref={textareaRef}
                className="min-h-28 w-full resize-none rounded-lg border border-white/10 bg-[#05070b] p-4 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Ex.: crie um SaaS para academias com login, planos pagos e dashboard..."
              />
            </label>

            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <button
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-70"
                disabled={isBuilding || !prompt.trim()}
                type="submit"
              >
                {isBuilding ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-4 w-4" aria-hidden="true" />
                )}
                Gerar
              </button>
              <button
                className="inline-flex items-center justify-center rounded-lg border border-white/10 px-4 py-3 text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
                onClick={clearWorkspace}
                title="Limpar conversa e preview"
                type="button"
              >
                <Eraser className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </form>
        </section>

        <section className="flex min-h-screen flex-col bg-[#070a0f]">
          <header className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                Preview ao vivo
              </p>
              <h2 className="mt-1 text-lg font-semibold text-white">
                {project ? project.name : "Aguardando geração"}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition ${
                  previewMode === "desktop"
                    ? "border-cyan-300/50 bg-cyan-300/[0.12] text-cyan-100"
                    : "border-white/10 text-slate-400 hover:text-white"
                }`}
                onClick={() => setPreviewMode("desktop")}
                type="button"
              >
                <Monitor className="h-4 w-4" aria-hidden="true" />
                Desktop
              </button>
              <button
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition ${
                  previewMode === "mobile"
                    ? "border-cyan-300/50 bg-cyan-300/[0.12] text-cyan-100"
                    : "border-white/10 text-slate-400 hover:text-white"
                }`}
                onClick={() => setPreviewMode("mobile")}
                type="button"
              >
                <Smartphone className="h-4 w-4" aria-hidden="true" />
                Mobile
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!project}
                onClick={copyHtml}
                type="button"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copiado" : "Copiar HTML"}
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-md bg-emerald-300 px-3 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!project}
                onClick={exportHtml}
                type="button"
              >
                <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
                Exportar
              </button>
            </div>
          </header>

          <div className="grid flex-1 gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="relative flex min-h-[620px] items-start justify-center overflow-hidden rounded-xl border border-white/10 bg-[#101722] p-4">
              {isBuilding && (
                <div className="absolute inset-x-4 top-4 z-10 rounded-lg border border-cyan-300/25 bg-[#07101a]/90 px-4 py-3 text-sm text-cyan-100 backdrop-blur">
                  Gerando preview: {buildStages[stageIndex].toLowerCase()}...
                </div>
              )}
              <iframe
                className={`h-full min-h-[590px] rounded-lg border border-white/10 bg-white shadow-2xl transition-all ${
                  previewMode === "mobile" ? "w-[390px]" : "w-full"
                }`}
                sandbox=""
                srcDoc={previewHtml}
                title="Preview gerado pela IA"
              />
            </div>

            <aside className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-[#0b1018] p-4">
                <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                  Arquivos
                </h3>
                <div className="mt-3 space-y-2">
                  {(project?.files ?? []).length > 0 ? (
                    project?.files.map((file) => (
                      <details
                        key={file.path}
                        className="rounded-lg border border-white/10 bg-white/[0.04] p-3"
                      >
                        <summary className="cursor-pointer text-sm font-semibold text-white">
                          {file.path}
                        </summary>
                        <p className="mt-2 text-xs leading-5 text-slate-400">
                          {file.description}
                        </p>
                        <pre className="mt-3 overflow-x-auto rounded bg-black/30 p-3 text-xs text-cyan-100">
                          {file.content}
                        </pre>
                      </details>
                    ))
                  ) : (
                    <p className="text-sm leading-6 text-slate-400">
                      Os arquivos aparecem aqui depois que a IA gerar o projeto.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#0b1018] p-4">
                <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                  O que foi criado
                </h3>
                <ul className="mt-3 space-y-2">
                  {(project?.features ?? ["Layout responsivo", "Preview seguro", "Exportação HTML"]).map(
                    (feature) => (
                      <li key={feature} className="flex gap-2 text-sm leading-6 text-slate-300">
                        <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-200" />
                        {feature}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function emptyPreview() {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #08101a;
      color: #e8f6ff;
      font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    }
    div {
      max-width: 560px;
      padding: 36px;
      text-align: center;
    }
    h1 {
      margin: 0 0 14px;
      font-size: 42px;
      line-height: 1;
    }
    p {
      margin: 0;
      color: #9fb3c7;
      line-height: 1.6;
      font-size: 16px;
    }
  </style>
</head>
<body>
  <div>
    <h1>Seu preview aparece aqui</h1>
    <p>Escreva no chat o SaaS ou site que você quer criar. A IA monta uma primeira versão visual automaticamente.</p>
  </div>
</body>
</html>`;
}
