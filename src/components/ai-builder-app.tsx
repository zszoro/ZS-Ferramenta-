"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowDownToLine,
  Bell,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  LoaderCircle,
  LogIn,
  LogOut,
  Maximize2,
  Monitor,
  MousePointer2,
  MoveHorizontal,
  Palette,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  Smartphone,
  Sparkles,
  User,
  UserPlus,
  X,
} from "lucide-react";
import type {
  BuilderAssistantResponse,
  BuilderProject,
  ProjectBrief,
} from "@/lib/ai-builder/generator";

type Screen = "landing" | "onboarding" | "app";
type AuthMode = "login" | "register";
type MessageRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: MessageRole;
  text: string;
  files?: BuilderProject["files"];
};

type PreviewSelection = {
  tag: string;
  label: string;
  selector: string;
};

type AccountSettings = {
  language: "pt-BR" | "en-US";
  defaultPreview: "desktop" | "mobile";
  generationQuality: "rapida" | "equilibrada" | "premium";
  animations: boolean;
  autosave: boolean;
  compactChat: boolean;
  detailedReplies: boolean;
  developerMode: boolean;
  emailUpdates: boolean;
  sound: boolean;
  publicProfile: boolean;
};

type TokenState = {
  remaining: number;
  weeklyAllowance: number;
  usedThisWeek: number;
  resetAt: string;
};

type Account = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  avatarUrl: string;
  avatarColor: string;
  planId: string;
  createdAt: string;
  lastLoginAt: string;
  tokens: TokenState;
  settings: AccountSettings;
};

type Plan = {
  id: string;
  name: string;
  price: string;
  weeklyTokens: number;
  description: string;
  benefits: string[];
};

const ACCOUNTS_KEY = "zs-ferramenta-accounts-v3";
const ACTIVE_ACCOUNT_KEY = "zs-ferramenta-active-account-v3";
const ONBOARDING_KEY = "zs-ferramenta-onboarding-v3";

const defaultSettings: AccountSettings = {
  language: "pt-BR",
  defaultPreview: "desktop",
  generationQuality: "equilibrada",
  animations: true,
  autosave: true,
  compactChat: false,
  detailedReplies: true,
  developerMode: false,
  emailUpdates: true,
  sound: false,
  publicProfile: false,
};

const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: "R$ 29/semana",
    weeklyTokens: 1500,
    description: "Para criar sites simples e testar ideias rapido.",
    benefits: ["1.500 tokens por semana", "Preview ao vivo", "Download ZIP", "Edicoes no chat"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "R$ 79/semana",
    weeklyTokens: 6500,
    description: "Para SaaS, dashboards, areas logadas e projetos comerciais.",
    benefits: ["6.500 tokens por semana", "Estrutura de APIs", "Planos e pagamentos", "Prioridade de geracao"],
  },
  {
    id: "studio",
    name: "Studio",
    price: "R$ 199/semana",
    weeklyTokens: 22000,
    description: "Para agencias e criacao continua de produtos completos.",
    benefits: ["22.000 tokens por semana", "Sistemas multi-pagina", "Arquitetura avancada", "Preparado para Mercado Pago"],
  },
];

const welcomeSteps = [
  {
    title: "Converse como se fosse com um desenvolvedor",
    text: "Descreva o site, SaaS ou sistema em linguagem normal. A IA entende objetivo, publico, paginas e recursos.",
  },
  {
    title: "Veja o preview nascer ao lado",
    text: "O preview e atualizado dentro de um iframe seguro. Voce pode redimensionar, testar desktop/mobile e abrir em tela cheia.",
  },
  {
    title: "Peça edicoes no proprio chat",
    text: "Depois de gerar, fale coisas como: troque o titulo por Barbearia Elite, adicione planos pagos ou mude para verde neon.",
  },
  {
    title: "Use arquivos sugeridos como base real",
    text: "Cada geracao lista componentes, rotas, schemas e APIs que podem virar codigo do projeto final.",
  },
  {
    title: "Controle tokens, planos e configuracoes",
    text: "Sua conta ganha 500 tokens iniciais, usa tokens por geracao e reseta semanalmente conforme o plano ativo.",
  },
];

const quickPrompts = [
  "Crie um site para uma barbearia premium com agendamento pelo WhatsApp.",
  "Crie um SaaS financeiro com login, dashboard, clientes e planos pagos.",
  "Troque o titulo principal por Barbearia Elite e deixe a cor verde neon.",
];

const initialMessages: ChatMessage[] = [
  {
    id: "intro",
    role: "assistant",
    text: "Oi, zs. Clique em Criar projeto para passar nome, nicho, cor e contato antes da geracao. Depois disso eu continuo editando o preview pelo chat.",
  },
];

export function AiBuilderApp() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [onboardingIndex, setOnboardingIndex] = useState(0);

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [project, setProject] = useState<BuilderProject | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [previewWidth, setPreviewWidth] = useState(38);
  const [isResizing, setIsResizing] = useState(false);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [createdPanelOpen, setCreatedPanelOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [selectedPreviewElement, setSelectedPreviewElement] = useState<PreviewSelection | null>(null);
  const [isPreviewSelectionMode, setIsPreviewSelectionMode] = useState(false);

  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [tokensModalOpen, setTokensModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectBriefOpen, setProjectBriefOpen] = useState(false);
  const [billingMessage, setBillingMessage] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const previewHtml = useMemo(
    () => project?.previewHtml ?? emptyPreview(account?.name ?? "zs"),
    [account?.name, project],
  );
  const inspectablePreviewHtml = useMemo(
    () => (isPreviewSelectionMode ? withPreviewInspector(previewHtml) : previewHtml),
    [isPreviewSelectionMode, previewHtml],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const loaded = loadAccounts().map(ensureWeeklyTokens);
      const activeId = window.localStorage.getItem(ACTIVE_ACCOUNT_KEY);
      const activeAccount = loaded.find((item) => item.id === activeId);

      if (activeAccount) {
        const nextAccount = { ...activeAccount, lastLoginAt: new Date().toISOString() };
        const nextAccounts = replaceAccount(loaded, nextAccount);
        persistAccounts(nextAccounts, nextAccount.id);
        setAccounts(nextAccounts);
        setAccount(nextAccount);
        setPreviewMode(nextAccount.settings.defaultPreview);
        setScreen(hasFinishedOnboarding(nextAccount.id) ? "app" : "onboarding");
        return;
      }

      setAccounts(loaded);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending]);

  useEffect(() => {
    function onPreviewMessage(event: MessageEvent) {
      const data = event.data as Partial<PreviewSelection> & { type?: string };

      if (data?.type !== "zs-preview-select" || !data.label || !data.selector || !data.tag) {
        return;
      }

      setSelectedPreviewElement({
        tag: data.tag,
        label: data.label,
        selector: data.selector,
      });
    }

    window.addEventListener("message", onPreviewMessage);

    return () => window.removeEventListener("message", onPreviewMessage);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    function onMove(event: globalThis.PointerEvent) {
      const widthPercent = ((window.innerWidth - event.clientX) / window.innerWidth) * 100;
      setPreviewWidth(clamp(widthPercent, 28, 50));
    }

    function onUp() {
      setIsResizing(false);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [isResizing]);

  function persistAccount(nextAccount: Account) {
    const nextAccounts = replaceAccount(accounts, nextAccount);
    setAccounts(nextAccounts);
    setAccount(nextAccount);
    persistAccounts(nextAccounts, nextAccount.id);
  }

  function activateAccount(nextAccount: Account, nextAccounts = accounts) {
    const normalized = ensureWeeklyTokens({
      ...nextAccount,
      lastLoginAt: new Date().toISOString(),
    });
    const savedAccounts = replaceAccount(nextAccounts, normalized);
    setAccounts(savedAccounts);
    setAccount(normalized);
    setPreviewMode(normalized.settings.defaultPreview);
    setAuthMode(null);
    setAuthError(null);
    setAccountMenuOpen(false);
    persistAccounts(savedAccounts, normalized.id);
    setScreen(hasFinishedOnboarding(normalized.id) ? "app" : "onboarding");
  }

  function finishOnboarding() {
    if (account) {
      window.localStorage.setItem(`${ONBOARDING_KEY}:${account.id}`, "done");
    }
    setScreen("app");
    setOnboardingIndex(0);
  }

  function togglePreviewSelectionMode(enabled: boolean) {
    setIsPreviewSelectionMode(enabled);
    if (!enabled) {
      setSelectedPreviewElement(null);
    }
  }

  async function handleSend(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const message = input.trim();
    if (!message || isSending || !account) return;

    if (account.tokens.remaining <= 0) {
      setTokensModalOpen(true);
      setChatError("Seus tokens acabaram. Escolha um plano ou aguarde o reset semanal.");
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: message,
    };
    const messageForAi = selectedPreviewElement
      ? [
          `Elemento selecionado no preview: ${selectedPreviewElement.tag} "${selectedPreviewElement.label}" (${selectedPreviewElement.selector}).`,
          `Pedido do usuario: ${message}`,
        ].join("\n")
      : message;

    setInput("");
    setChatError(null);
    setIsSending(true);
    setMessages((current) => [...current, userMessage]);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageForAi, project }),
      });
      const payload = (await response.json()) as
        | ({ ok: true } & BuilderAssistantResponse)
        | { ok: false; error?: string };

      if (!response.ok || !payload.ok) {
        const responseError = "error" in payload ? payload.error : undefined;
        throw new Error(responseError ?? "A IA nao conseguiu responder.");
      }

      const tokenCost = payload.tokenCost ?? 12;
      persistAccount(deductTokens(account, tokenCost));

      if (payload.project) {
        setProject(payload.project);
        setCreatedPanelOpen(true);
      }
      setSelectedPreviewElement(null);

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: payload.reply,
          files: payload.project?.files,
        },
      ]);
    } catch (caught) {
      setChatError(caught instanceof Error ? caught.message : "Erro inesperado.");
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          text: "Nao consegui processar agora. Tente simplificar o pedido ou gerar novamente.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  async function handleCreateProject(brief: ProjectBrief) {
    if (isSending || !account) return;

    if (account.tokens.remaining <= 0) {
      setProjectBriefOpen(false);
      setTokensModalOpen(true);
      setChatError("Seus tokens acabaram. Escolha um plano ou aguarde o reset semanal.");
      return;
    }

    const message = [
      `Criar projeto para ${brief.companyName}.`,
      `Nicho: ${brief.niche}.`,
      `Cor principal: ${brief.primaryColor}.`,
      brief.phoneWhatsapp ? `WhatsApp: ${brief.phoneWhatsapp}.` : "",
      brief.email ? `Email: ${brief.email}.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    setProjectBriefOpen(false);
    setInput("");
    setChatError(null);
    setIsSending(true);
    setMessages((current) => [
      ...current,
      {
        id: `user-project-${Date.now()}`,
        role: "user",
        text: message,
      },
    ]);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, project, brief }),
      });
      const payload = (await response.json()) as
        | ({ ok: true } & BuilderAssistantResponse)
        | { ok: false; error?: string };

      if (!response.ok || !payload.ok) {
        const responseError = "error" in payload ? payload.error : undefined;
        throw new Error(responseError ?? "A IA nao conseguiu criar o projeto.");
      }

      persistAccount(deductTokens(account, payload.tokenCost ?? 44));

      if (payload.project) {
        setProject(payload.project);
        setCreatedPanelOpen(true);
      }

      setMessages((current) => [
        ...current,
        {
          id: `assistant-project-${Date.now()}`,
          role: "assistant",
          text: payload.reply,
          files: payload.project?.files,
        },
      ]);
    } catch (caught) {
      setChatError(caught instanceof Error ? caught.message : "Erro inesperado.");
      setMessages((current) => [
        ...current,
        {
          id: `assistant-project-error-${Date.now()}`,
          role: "assistant",
          text: "Nao consegui criar o projeto agora. Revise o briefing e tente novamente.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function applyPrompt(prompt: string) {
    setInput(prompt);
  }

  function clearProject() {
    setProject(null);
    setMessages(initialMessages);
    setCreatedPanelOpen(true);
    setChatError(null);
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
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      copyWithTextarea(project.previewHtml);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    }
  }

  function exportZip() {
    if (!project) return;

    const files = [
      ...project.files.map((file) => ({
        path: file.path,
        content: file.content,
      })),
      {
        path: "preview.html",
        content: project.previewHtml,
      },
    ];
    const blob = createZipBlob(files);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(project.name)}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function choosePlan(plan: Plan) {
    if (!account) return;

    const nextAccount: Account = {
      ...account,
      planId: plan.id,
      tokens: {
        remaining: Math.max(account.tokens.remaining, plan.weeklyTokens),
        weeklyAllowance: plan.weeklyTokens,
        usedThisWeek: 0,
        resetAt: nextWeeklyReset(),
      },
    };
    persistAccount(nextAccount);
    setBillingMessage(
      `${plan.name} ativado localmente. Para cobranca real, conecte MERCADO_PAGO_ACCESS_TOKEN no backend.`,
    );
  }

  function logout() {
    window.localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
    setAccount(null);
    setScreen("landing");
    setAccountMenuOpen(false);
  }

  if (screen === "landing") {
    return (
      <LandingScreen
        accounts={accounts}
        authError={authError}
        authMode={authMode}
        onActivateAccount={activateAccount}
        onAuthError={setAuthError}
        onAuthModeChange={setAuthMode}
        onAccountsChange={setAccounts}
      />
    );
  }

  if (screen === "onboarding" && account) {
    return (
      <WelcomeScreen
        account={account}
        index={onboardingIndex}
        onClose={finishOnboarding}
        onIndexChange={setOnboardingIndex}
      />
    );
  }

  return (
    <main className="h-screen overflow-hidden bg-[#050705] text-zinc-100">
      <div className="flex h-screen overflow-hidden flex-col lg:flex-row">
        <section className="relative flex h-screen min-w-0 flex-1 flex-col overflow-hidden bg-[#070907]">
          <header className="shrink-0 border-b border-white/10 px-4 py-3 md:px-6">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#7cff6b] text-sm font-black text-black shadow-[0_0_30px_rgba(124,255,107,0.4)]">
                ZS
              </div>
              <div>
                <h1 className="text-base font-semibold text-white md:text-lg">ZS Ferramenta</h1>
                <p className="text-xs text-zinc-500">Chat de IA para criar sites e SaaS</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="inline-flex h-9 items-center gap-2 rounded-md bg-[#7cff6b] px-3 text-xs font-black text-black transition hover:bg-[#d8ff76]"
                onClick={() => setProjectBriefOpen(true)}
                type="button"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Criar projeto
              </button>
              <button
                className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 px-3 text-xs font-semibold text-zinc-300 transition hover:border-[#7cff6b]/50 hover:text-white"
                onClick={clearProject}
                type="button"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Novo
              </button>
              <button
                className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 px-3 text-xs font-semibold text-zinc-300 transition hover:border-[#7cff6b]/50 hover:text-white"
                onClick={() => setTokensModalOpen(true)}
                type="button"
              >
                <Coins className="h-4 w-4 text-[#7cff6b]" aria-hidden="true" />
                {account?.tokens.remaining ?? 0}
              </button>
            </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
              {messages.map((message) => (
                <ChatBubble key={message.id} message={message} compact={account?.settings.compactChat ?? false} />
              ))}

              {isSending && (
                <article className="max-w-[88%] rounded-xl border border-[#7cff6b]/20 bg-[#7cff6b]/10 p-4 text-sm text-zinc-100">
                  <div className="mb-2 flex items-center gap-2 font-semibold text-[#d8ff76]">
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                    IA construindo e analisando o pedido...
                  </div>
                  <p className="text-zinc-400">Interpretando conversa, atualizando arquivos e preparando preview.</p>
                </article>
              )}

              {chatError && (
                <div className="rounded-lg border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-100">
                  {chatError}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>

          <div className="shrink-0 border-t border-white/10 bg-[#070907]/95 px-4 py-4 backdrop-blur md:px-6">
            <div className="mx-auto w-full max-w-4xl">
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs text-zinc-300 transition hover:border-[#7cff6b]/50 hover:text-white"
                    onClick={() => applyPrompt(prompt)}
                    type="button"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {selectedPreviewElement && (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-[#7cff6b]/30 bg-[#7cff6b]/10 px-3 py-2 text-xs text-zinc-200">
                  <span className="min-w-0 truncate">
                    Selecionado no preview: <strong className="text-[#d8ff76]">{selectedPreviewElement.tag}</strong> - {selectedPreviewElement.label}
                  </span>
                  <button
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
                    onClick={() => setSelectedPreviewElement(null)}
                    type="button"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">Limpar seleção</span>
                  </button>
                </div>
              )}

              <form className="grid grid-cols-[1fr_auto] gap-2" onSubmit={handleSend}>
                <label className="block">
                  <span className="sr-only">Mensagem para IA</span>
                  <textarea
                    className="max-h-36 min-h-14 w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-[#7cff6b]/70"
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder={
                      selectedPreviewElement
                        ? "Diga o que mudar no item selecionado..."
                        : "Peça para criar ou editar. Ex.: troque o título por Barbearia Elite..."
                    }
                    value={input}
                  />
                </label>
                <button
                  className="inline-flex h-14 min-w-14 items-center justify-center rounded-xl bg-[#7cff6b] px-4 text-sm font-black text-black transition hover:bg-[#d8ff76] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isSending || !input.trim()}
                  type="submit"
                >
                  {isSending ? (
                    <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="h-5 w-5" aria-hidden="true" />
                  )}
                  <span className="sr-only">Enviar</span>
                </button>
              </form>
            </div>
          </div>

          {account && (
            <AccountDock
              account={account}
              accounts={accounts}
              isOpen={accountMenuOpen}
              onLogout={logout}
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenTokens={() => setTokensModalOpen(true)}
              onSwitchAccount={activateAccount}
              onToggle={() => setAccountMenuOpen((current) => !current)}
            />
          )}
        </section>

        <aside
          className="relative flex h-screen w-full shrink-0 flex-col overflow-hidden border-l border-white/10 bg-[#0b0f0b] lg:w-[var(--preview-width)]"
          style={{ "--preview-width": `${previewWidth}vw` } as CSSProperties}
        >
          <button
            aria-label="Redimensionar preview"
            className="fixed top-1/2 z-40 hidden h-14 w-6 cursor-ew-resize items-center justify-center rounded-full border border-[#7cff6b]/30 bg-black/80 text-[#7cff6b] shadow-[0_0_24px_rgba(124,255,107,0.25)] lg:flex"
            onPointerDown={(event) => {
              event.preventDefault();
              setIsResizing(true);
            }}
            style={{
              right: `${previewWidth}vw`,
              transform: "translate(50%, -50%)",
            }}
            type="button"
          >
            <MoveHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>

          <PreviewPanel
            copied={copied}
            html={inspectablePreviewHtml}
            isSelectionMode={isPreviewSelectionMode}
            mode={previewMode}
            project={project}
            onCopy={copyHtml}
            onExport={exportZip}
            onFullscreen={() => setIsPreviewFullscreen(true)}
            onModeChange={setPreviewMode}
            onSelectionModeChange={togglePreviewSelectionMode}
          />
        </aside>
      </div>

      {project && createdPanelOpen && (
        <CreatedFloatingPanel project={project} onClose={() => setCreatedPanelOpen(false)} />
      )}

      {isPreviewFullscreen && (
        <FullscreenPreview
          html={inspectablePreviewHtml}
          isSelectionMode={isPreviewSelectionMode}
          mode={previewMode}
          project={project}
          onClose={() => setIsPreviewFullscreen(false)}
          onSelectionModeChange={togglePreviewSelectionMode}
        />
      )}

      {account && tokensModalOpen && (
        <TokensModal
          account={account}
          billingMessage={billingMessage}
          onChoosePlan={choosePlan}
          onClose={() => {
            setTokensModalOpen(false);
            setBillingMessage(null);
          }}
        />
      )}

      {account && settingsOpen && (
        <SettingsModal
          account={account}
          onClose={() => setSettingsOpen(false)}
          onSave={(nextAccount) => {
            persistAccount(nextAccount);
            setPreviewMode(nextAccount.settings.defaultPreview);
            setSettingsOpen(false);
          }}
        />
      )}

      {account && projectBriefOpen && (
        <CreateProjectModal
          onClose={() => setProjectBriefOpen(false)}
          onCreate={(brief) => void handleCreateProject(brief)}
        />
      )}
    </main>
  );
}

function LandingScreen(props: {
  accounts: Account[];
  authError: string | null;
  authMode: AuthMode | null;
  onAccountsChange: (accounts: Account[]) => void;
  onActivateAccount: (account: Account, accounts?: Account[]) => void;
  onAuthError: (message: string | null) => void;
  onAuthModeChange: (mode: AuthMode | null) => void;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <NeonGrid />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,255,107,0.11),transparent_32%),linear-gradient(180deg,transparent,rgba(0,0,0,0.75))]" />

      <section className="relative z-10 grid min-h-screen place-items-center px-5 py-10">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-7 h-2 w-28 rounded-full bg-[#7cff6b] shadow-[0_0_36px_rgba(124,255,107,0.7)]" />
          <h1 className="text-5xl font-black tracking-[-0.05em] text-white md:text-7xl">
            ZS ferramenta
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-zinc-300 md:text-lg">
            Essa ferramenta foi totalmente criada por zs para transformar conversas em sites,
            SaaS, dashboards e sistemas com preview vivo, arquivos sugeridos e edicoes por IA.
          </p>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-zinc-500">
            Entre, descreva sua ideia e veja o produto surgir ao lado. Depois, peca ajustes como
            um cliente falaria para um desenvolvedor.
          </p>

          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white px-7 text-sm font-black text-black transition hover:bg-[#7cff6b]"
              onClick={() => props.onAuthModeChange("login")}
              type="button"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Entrar
            </button>
            <button
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white px-7 text-sm font-black text-black transition hover:bg-[#7cff6b]"
              onClick={() => props.onAuthModeChange("register")}
              type="button"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Cadastrar
            </button>
          </div>
        </div>
      </section>

      {props.authMode && (
        <AuthModal
          accounts={props.accounts}
          error={props.authError}
          mode={props.authMode}
          onAccountsChange={props.onAccountsChange}
          onActivateAccount={props.onActivateAccount}
          onClose={() => {
            props.onAuthModeChange(null);
            props.onAuthError(null);
          }}
          onError={props.onAuthError}
          onModeChange={props.onAuthModeChange}
        />
      )}
    </main>
  );
}

function NeonGrid() {
  const columns = 26;
  const rows = 15;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const cells = useMemo(() => Array.from({ length: columns * rows }, (_, index) => index), []);

  useEffect(() => {
    if (activeIndex === null) return;

    const timeout = window.setTimeout(() => setActiveIndex(null), 420);
    return () => window.clearTimeout(timeout);
  }, [activeIndex]);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 grid opacity-90"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {cells.map((cell) => {
        const distance = getCellDistance(cell, activeIndex, columns);
        const isActive = distance === 0;
        const isNear = distance > 0 && distance <= 2;

        return (
          <button
            key={cell}
            className="min-h-10 border border-white/[0.045] bg-zinc-900/45 transition duration-500"
            onMouseEnter={() => setActiveIndex(cell)}
            style={{
              background: isActive
                ? "#7cff6b"
                : isNear
                  ? "rgba(124, 255, 107, 0.16)"
                  : "rgba(39, 39, 42, 0.34)",
              boxShadow: isActive
                ? "0 0 34px rgba(124,255,107,0.75)"
                : isNear
                  ? "0 0 18px rgba(124,255,107,0.18)"
                  : "none",
            }}
            tabIndex={-1}
            type="button"
          />
        );
      })}
    </div>
  );
}

function AuthModal(props: {
  accounts: Account[];
  error: string | null;
  mode: AuthMode;
  onAccountsChange: (accounts: Account[]) => void;
  onActivateAccount: (account: Account, accounts?: Account[]) => void;
  onClose: () => void;
  onError: (message: string | null) => void;
  onModeChange: (mode: AuthMode) => void;
}) {
  const isRegister = props.mode === "register";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    props.onError(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      props.onError("Digite um email valido.");
      return;
    }

    if (password.length < 6) {
      props.onError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (isRegister) {
      if (!cleanName) {
        props.onError("Digite seu nome.");
        return;
      }

      if (password !== confirmation) {
        props.onError("A confirmacao de senha nao confere.");
        return;
      }

      if (props.accounts.some((item) => item.email === cleanEmail)) {
        props.onError("Esse email ja esta cadastrado.");
        return;
      }

      const now = new Date().toISOString();
      const account: Account = {
        id: createId(),
        name: cleanName,
        email: cleanEmail,
        passwordHash: demoHash(password),
        avatarUrl: "",
        avatarColor: pickAvatarColor(cleanEmail),
        planId: "free",
        createdAt: now,
        lastLoginAt: now,
        tokens: {
          remaining: 500,
          weeklyAllowance: 500,
          usedThisWeek: 0,
          resetAt: nextWeeklyReset(),
        },
        settings: defaultSettings,
      };
      const nextAccounts = [...props.accounts, account];
      props.onAccountsChange(nextAccounts);
      props.onActivateAccount(account, nextAccounts);
      return;
    }

    const existing = props.accounts.find((item) => item.email === cleanEmail);
    if (!existing || existing.passwordHash !== demoHash(password)) {
      props.onError("Email ou senha incorretos.");
      return;
    }

    props.onActivateAccount(existing);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 px-4 backdrop-blur-xl">
      <section className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/12 bg-[#090d09]/95 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.65)]">
        <div className="absolute inset-x-0 top-0 h-1 bg-[#7cff6b]" />
        <button
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
          onClick={props.onClose}
          type="button"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Fechar</span>
        </button>

        <div className="mb-6 pr-10">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#7cff6b]">
            {isRegister ? "Criar conta" : "Entrar"}
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white">
            {isRegister ? "Comece com 500 tokens" : "Acesse sua IA"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Login local funcional para esta versao. Em producao, use banco e sessao segura no backend.
          </p>
        </div>

        <form className="grid gap-3" onSubmit={submit}>
          {isRegister && (
            <label className="grid gap-1.5 text-sm">
              <span className="text-zinc-400">Nome</span>
              <input
                className="h-11 rounded-lg border border-white/10 bg-black/40 px-3 text-white outline-none focus:border-[#7cff6b]/70"
                onChange={(event) => setName(event.target.value)}
                placeholder="Seu nome"
                value={name}
              />
            </label>
          )}

          <label className="grid gap-1.5 text-sm">
            <span className="text-zinc-400">Email</span>
            <input
              className="h-11 rounded-lg border border-white/10 bg-black/40 px-3 text-white outline-none focus:border-[#7cff6b]/70"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@email.com"
              type="email"
              value={email}
            />
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="text-zinc-400">Senha</span>
            <div className="grid grid-cols-[1fr_auto] rounded-lg border border-white/10 bg-black/40 focus-within:border-[#7cff6b]/70">
              <input
                className="h-11 bg-transparent px-3 text-white outline-none"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimo 6 caracteres"
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                className="grid h-11 w-11 place-items-center text-zinc-400 hover:text-white"
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="sr-only">Mostrar senha</span>
              </button>
            </div>
          </label>

          {isRegister && (
            <label className="grid gap-1.5 text-sm">
              <span className="text-zinc-400">Confirmacao de senha</span>
              <input
                className="h-11 rounded-lg border border-white/10 bg-black/40 px-3 text-white outline-none focus:border-[#7cff6b]/70"
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="Repita a senha"
                type="password"
                value={confirmation}
              />
            </label>
          )}

          {props.error && (
            <div className="rounded-lg border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-100">
              {props.error}
            </div>
          )}

          <button
            className="mt-2 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white text-sm font-black text-black transition hover:bg-[#7cff6b]"
            type="submit"
          >
            {isRegister ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
            {isRegister ? "Cadastrar" : "Entrar"}
          </button>
        </form>

        {!isRegister && props.accounts.length > 0 && (
          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
              Perfis salvos
            </p>
            <div className="grid gap-2">
              {props.accounts.map((savedAccount) => (
                <button
                  key={savedAccount.id}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-2 text-left transition hover:border-[#7cff6b]/50"
                  onClick={() => props.onActivateAccount(savedAccount)}
                  type="button"
                >
                  <Avatar account={savedAccount} size="sm" />
                  <span>
                    <span className="block text-sm font-semibold text-white">{savedAccount.name}</span>
                    <span className="block text-xs text-zinc-500">{savedAccount.email}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          className="mt-5 text-sm font-semibold text-zinc-400 transition hover:text-[#7cff6b]"
          onClick={() => props.onModeChange(isRegister ? "login" : "register")}
          type="button"
        >
          {isRegister ? "Ja tenho conta" : "Criar nova conta"}
        </button>
      </section>
    </div>
  );
}

function WelcomeScreen(props: {
  account: Account;
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const step = welcomeSteps[props.index];
  const isLast = props.index === welcomeSteps.length - 1;

  return (
    <main className="grid min-h-screen place-items-center bg-black px-4 text-white">
      <section className="relative w-full max-w-2xl rounded-2xl border border-white/12 bg-[#090d09] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.6)] md:p-8">
        <button
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-zinc-800 text-zinc-400 transition hover:bg-zinc-700 hover:text-white"
          onClick={props.onClose}
          type="button"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Fechar boas-vindas</span>
        </button>

        <div className="mb-7 flex items-center gap-3">
          <Avatar account={props.account} size="md" />
          <div>
            <p className="text-sm text-zinc-500">Bem-vindo, {props.account.name}</p>
            <h1 className="text-2xl font-black tracking-[-0.03em]">Como usar a ZS Ferramenta</h1>
          </div>
        </div>

        <div className="mb-6 flex gap-2">
          {welcomeSteps.map((item, index) => (
            <button
              key={item.title}
              aria-label={`Ir para passo ${index + 1}`}
              className={`h-2 flex-1 rounded-full transition ${
                index <= props.index ? "bg-[#7cff6b]" : "bg-white/10"
              }`}
              onClick={() => props.onIndexChange(index)}
              type="button"
            />
          ))}
        </div>

        <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#7cff6b]">
          Passo {props.index + 1} de {welcomeSteps.length}
        </p>
        <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">{step.title}</h2>
        <p className="mt-4 text-base leading-8 text-zinc-400">{step.text}</p>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="inline-flex h-11 items-center justify-center rounded-lg border border-white/10 px-4 text-sm font-semibold text-zinc-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
            disabled={props.index === 0}
            onClick={() => props.onIndexChange(Math.max(0, props.index - 1))}
            type="button"
          >
            <ChevronLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Passo anterior
          </button>

          <div className="flex gap-3">
            <button
              className="inline-flex h-11 items-center justify-center rounded-lg border border-white/10 px-4 text-sm font-semibold text-zinc-300 transition hover:text-white"
              onClick={props.onClose}
              type="button"
            >
              Fechar
            </button>
            <button
              className="inline-flex h-11 items-center justify-center rounded-lg bg-[#7cff6b] px-4 text-sm font-black text-black transition hover:bg-[#d8ff76]"
              onClick={() => (isLast ? props.onClose() : props.onIndexChange(props.index + 1))}
              type="button"
            >
              {isLast ? "Comecar" : "Proximo passo"}
              {!isLast && <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function ChatBubble(props: { message: ChatMessage; compact: boolean }) {
  const isAssistant = props.message.role === "assistant";

  return (
    <article
      className={`max-w-[92%] rounded-xl border p-4 ${
        isAssistant
          ? "border-[#7cff6b]/20 bg-[#7cff6b]/10"
          : "ml-auto border-white/10 bg-white/[0.055]"
      } ${props.compact ? "p-3" : ""}`}
    >
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
        {isAssistant ? (
          <Bot className="h-4 w-4 text-[#7cff6b]" aria-hidden="true" />
        ) : (
          <User className="h-4 w-4 text-white" aria-hidden="true" />
        )}
        {isAssistant ? "IA ZS" : "Voce"}
      </div>
      <p className="whitespace-pre-line text-sm leading-7 text-zinc-100">{props.message.text}</p>

      {props.message.files && props.message.files.length > 0 && (
        <div className="mt-4 grid gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
            Arquivos criados
          </p>
          {props.message.files.map((file) => (
            <details
              key={file.path}
              className="rounded-lg border border-white/10 bg-black/25 p-3"
            >
              <summary className="cursor-pointer text-sm font-semibold text-white">
                {file.path}
              </summary>
              <p className="mt-2 text-xs leading-5 text-zinc-400">{file.description}</p>
              <pre className="mt-3 max-h-56 overflow-auto rounded-md bg-black/45 p-3 text-xs leading-5 text-[#c9ffc2]">
                {file.content}
              </pre>
            </details>
          ))}
        </div>
      )}
    </article>
  );
}

function PreviewPanel(props: {
  copied: boolean;
  html: string;
  isSelectionMode: boolean;
  mode: "desktop" | "mobile";
  project: BuilderProject | null;
  onCopy: () => void;
  onExport: () => void;
  onFullscreen: () => void;
  onModeChange: (mode: "desktop" | "mobile") => void;
  onSelectionModeChange: (enabled: boolean) => void;
}) {
  return (
    <>
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Preview</p>
          <h2 className="truncate text-sm font-semibold text-white">
            {props.project ? props.project.name : "Aguardando geracao"}
          </h2>
        </div>

        <div className="flex items-center gap-1">
          <button
            className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-black transition disabled:opacity-40 ${
              props.isSelectionMode
                ? "border-[#7cff6b]/60 bg-[#7cff6b] text-black"
                : "border-white/10 text-zinc-300 hover:border-[#7cff6b]/50 hover:text-white"
            }`}
            disabled={!props.project}
            onClick={() => props.onSelectionModeChange(!props.isSelectionMode)}
            title={props.isSelectionMode ? "Sair da selecao de componente" : "Selecionar componente no preview"}
            type="button"
          >
            <MousePointer2 className="h-4 w-4" aria-hidden="true" />
            Selecionar
          </button>
          <button
            className={`grid h-9 w-9 place-items-center rounded-md border text-zinc-300 transition ${
              props.mode === "desktop" ? "border-[#7cff6b]/50 bg-[#7cff6b]/10" : "border-white/10"
            }`}
            onClick={() => props.onModeChange("desktop")}
            title="Preview desktop"
            type="button"
          >
            <Monitor className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            className={`grid h-9 w-9 place-items-center rounded-md border text-zinc-300 transition ${
              props.mode === "mobile" ? "border-[#7cff6b]/50 bg-[#7cff6b]/10" : "border-white/10"
            }`}
            onClick={() => props.onModeChange("mobile")}
            title="Preview mobile"
            type="button"
          >
            <Smartphone className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-zinc-300 transition hover:border-[#7cff6b]/50 hover:text-white disabled:opacity-40"
            disabled={!props.project}
            onClick={props.onCopy}
            title={props.copied ? "Copiado" : "Copiar HTML"}
            type="button"
          >
            {props.copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
          <button
            className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-zinc-300 transition hover:border-[#7cff6b]/50 hover:text-white disabled:opacity-40"
            disabled={!props.project}
            onClick={props.onExport}
            title="Baixar ZIP"
            type="button"
          >
            <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            className="grid h-9 w-9 place-items-center rounded-md bg-[#7cff6b] text-black transition hover:bg-[#d8ff76]"
            onClick={props.onFullscreen}
            title="Tela cheia"
            type="button"
          >
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden bg-[#111811] p-4">
        <iframe
          className={`mx-auto h-full rounded-xl border border-white/10 bg-white shadow-2xl transition-all ${
            props.mode === "mobile" ? "w-[390px] max-w-full" : "w-full"
          }`}
          sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          srcDoc={props.html}
          title="Preview gerado pela IA"
        />
      </div>
    </>
  );
}

function CreatedFloatingPanel(props: { project: BuilderProject; onClose: () => void }) {
  return (
    <aside className="fixed right-5 top-20 z-30 w-[min(360px,calc(100vw-40px))] rounded-xl border border-[#7cff6b]/25 bg-[#081008]/95 p-4 text-white shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur">
      <button
        className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/5 text-zinc-400 transition hover:bg-white/10 hover:text-white"
        onClick={props.onClose}
        type="button"
      >
        <X className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Fechar painel criado</span>
      </button>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#7cff6b]">O que foi criado</p>
      <h3 className="mt-2 pr-8 text-lg font-black tracking-[-0.03em]">{props.project.name}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{props.project.summary}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <strong className="block text-white">{props.project.files.length}</strong>
          <span className="text-xs text-zinc-500">arquivos</span>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
          <strong className="block text-white">Preview</strong>
          <span className="text-xs text-zinc-500">selecionável</span>
        </div>
      </div>
    </aside>
  );
}

function FullscreenPreview(props: {
  html: string;
  isSelectionMode: boolean;
  mode: "desktop" | "mobile";
  project: BuilderProject | null;
  onClose: () => void;
  onSelectionModeChange: (enabled: boolean) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#050705] text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Tela cheia</p>
          <h2 className="text-sm font-semibold">{props.project?.name ?? "Preview"}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-black transition ${
              props.isSelectionMode
                ? "border-[#7cff6b]/60 bg-[#7cff6b] text-black"
                : "border-white/10 text-zinc-300 hover:border-[#7cff6b]/50 hover:text-white"
            }`}
            disabled={!props.project}
            onClick={() => props.onSelectionModeChange(!props.isSelectionMode)}
            type="button"
          >
            <MousePointer2 className="h-4 w-4" aria-hidden="true" />
            Selecionar
          </button>
          <button
            className="grid h-10 w-10 place-items-center rounded-full bg-zinc-800 text-zinc-300 transition hover:bg-zinc-700 hover:text-white"
            onClick={props.onClose}
            type="button"
          >
            <X className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Sair da tela cheia</span>
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden bg-[#111811] p-5">
        <iframe
          className={`mx-auto h-full rounded-xl border border-white/10 bg-white shadow-2xl ${
            props.mode === "mobile" ? "w-[390px] max-w-full" : "w-full"
          }`}
          sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          srcDoc={props.html}
          title="Preview em tela cheia"
        />
      </div>
    </div>
  );
}

function AccountDock(props: {
  account: Account;
  accounts: Account[];
  isOpen: boolean;
  onLogout: () => void;
  onOpenSettings: () => void;
  onOpenTokens: () => void;
  onSwitchAccount: (account: Account) => void;
  onToggle: () => void;
}) {
  const otherAccounts = props.accounts.filter((account) => account.id !== props.account.id);

  return (
    <div className="fixed bottom-4 left-4 z-40">
      {props.isOpen && (
        <section className="mb-3 w-80 rounded-2xl border border-white/10 bg-[#0a0e0a]/98 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.55)] backdrop-blur">
          <div className="grid place-items-center border-b border-white/10 pb-4 text-center">
            <Avatar account={props.account} size="lg" />
            <h3 className="mt-3 text-lg font-black">{props.account.name}</h3>
            <p className="text-sm text-zinc-500">{props.account.email}</p>
          </div>

          <button
            className="mt-4 flex w-full items-center justify-between rounded-lg border border-[#7cff6b]/20 bg-[#7cff6b]/10 p-3 text-left transition hover:border-[#7cff6b]/60"
            onClick={props.onOpenTokens}
            type="button"
          >
            <span>
              <span className="block text-sm font-semibold text-white">Tokens restantes</span>
              <span className="block text-xs text-zinc-500">Reset semanal automatico</span>
            </span>
            <span className="text-lg font-black text-[#7cff6b]">{props.account.tokens.remaining}</span>
          </button>

          <div className="mt-3 grid gap-2">
            <button
              className="flex h-11 items-center gap-3 rounded-lg border border-white/10 px-3 text-sm font-semibold text-zinc-300 transition hover:text-white"
              onClick={props.onOpenSettings}
              type="button"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
              Configuracoes
            </button>
            <button
              className="flex h-11 items-center gap-3 rounded-lg border border-white/10 px-3 text-sm font-semibold text-zinc-300 transition hover:text-white"
              onClick={props.onLogout}
              type="button"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sair da conta
            </button>
          </div>

          {otherAccounts.length > 0 && (
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
                Trocar de conta
              </p>
              <div className="grid max-h-40 gap-2 overflow-y-auto pr-1">
                {otherAccounts.map((account) => (
                  <button
                    key={account.id}
                    className="flex items-center gap-2 rounded-lg bg-white/[0.04] p-2 text-left transition hover:bg-white/[0.08]"
                    onClick={() => props.onSwitchAccount(account)}
                    type="button"
                  >
                    <Avatar account={account} size="sm" />
                    <span>
                      <span className="block text-sm font-semibold text-white">{account.name}</span>
                      <span className="block text-xs text-zinc-500">{account.email}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <button
        className="flex h-12 items-center gap-3 rounded-full border border-white/10 bg-[#0a0e0a]/95 px-3 pr-5 text-left shadow-[0_14px_60px_rgba(0,0,0,0.35)] backdrop-blur transition hover:border-[#7cff6b]/60"
        onClick={props.onToggle}
        type="button"
      >
        <Avatar account={props.account} size="sm" />
        <span className="max-w-40 truncate text-sm font-semibold text-white">{props.account.name}</span>
      </button>
    </div>
  );
}

function CreateProjectModal(props: {
  onClose: () => void;
  onCreate: (brief: ProjectBrief) => void;
}) {
  const [companyName, setCompanyName] = useState("");
  const [phoneWhatsapp, setPhoneWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [niche, setNiche] = useState("Barbearia");
  const [primaryColor, setPrimaryColor] = useState("#7cff6b");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = companyName.trim();
    const cleanNiche = niche.trim();

    if (cleanName.length < 2) {
      setError("Digite o nome da empresa.");
      return;
    }

    if (cleanNiche.length < 2) {
      setError("Digite o nicho do projeto.");
      return;
    }

    if (email.trim() && !email.includes("@")) {
      setError("Digite um email valido ou deixe em branco.");
      return;
    }

    props.onCreate({
      companyName: cleanName,
      phoneWhatsapp: phoneWhatsapp.trim() || undefined,
      email: email.trim() || undefined,
      niche: cleanNiche,
      primaryColor,
    });
  }

  return (
    <ModalShell title="Criar projeto" onClose={props.onClose}>
      <form className="grid gap-5" onSubmit={submit}>
        <div className="rounded-xl border border-[#7cff6b]/25 bg-[#7cff6b]/10 p-4">
          <p className="text-sm font-semibold text-white">Briefing antes do chat</p>
          <p className="mt-1 text-sm leading-6 text-zinc-400">
            A IA vai usar esses dados para gerar um site inicial mais realista, com imagem gratuita
            do nicho, contato, cor principal e secoes basicas ja organizadas.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm">
            <span className="text-zinc-400">Nome da empresa</span>
            <input
              className="h-11 rounded-lg border border-white/10 bg-black/40 px-3 text-white outline-none focus:border-[#7cff6b]/70"
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Ex.: Barbearia Elite"
              value={companyName}
            />
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="text-zinc-400">Nicho</span>
            <input
              className="h-11 rounded-lg border border-white/10 bg-black/40 px-3 text-white outline-none focus:border-[#7cff6b]/70"
              onChange={(event) => setNiche(event.target.value)}
              placeholder="Barbearia, restaurante, academia..."
              value={niche}
            />
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="text-zinc-400">Telefone / WhatsApp opcional</span>
            <input
              className="h-11 rounded-lg border border-white/10 bg-black/40 px-3 text-white outline-none focus:border-[#7cff6b]/70"
              onChange={(event) => setPhoneWhatsapp(event.target.value)}
              placeholder="Ex.: 5599999999999"
              value={phoneWhatsapp}
            />
          </label>

          <label className="grid gap-1.5 text-sm">
            <span className="text-zinc-400">Email opcional</span>
            <input
              className="h-11 rounded-lg border border-white/10 bg-black/40 px-3 text-white outline-none focus:border-[#7cff6b]/70"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="contato@empresa.com"
              type="email"
              value={email}
            />
          </label>
        </div>

        <label className="grid gap-1.5 text-sm">
          <span className="text-zinc-400">Cor principal</span>
          <div className="grid grid-cols-[56px_1fr] gap-3">
            <input
              aria-label="Selecionar cor principal"
              className="h-11 w-14 rounded-lg border border-white/10 bg-black/40 p-1"
              onChange={(event) => setPrimaryColor(event.target.value)}
              type="color"
              value={primaryColor}
            />
            <input
              className="h-11 rounded-lg border border-white/10 bg-black/40 px-3 text-white outline-none focus:border-[#7cff6b]/70"
              onChange={(event) => setPrimaryColor(event.target.value)}
              placeholder="#7cff6b"
              value={primaryColor}
            />
          </div>
        </label>

        {error && (
          <div className="rounded-lg border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="h-11 rounded-lg border border-white/10 px-4 text-sm font-semibold text-zinc-300 transition hover:text-white"
            onClick={props.onClose}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#7cff6b] px-4 text-sm font-black text-black transition hover:bg-[#d8ff76]"
            type="submit"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Gerar site
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function TokensModal(props: {
  account: Account;
  billingMessage: string | null;
  onChoosePlan: (plan: Plan) => void;
  onClose: () => void;
}) {
  return (
    <ModalShell title="Tokens e planos" onClose={props.onClose}>
      <div className="mb-5 rounded-xl border border-[#7cff6b]/25 bg-[#7cff6b]/10 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">Saldo atual</p>
            <p className="text-xs text-zinc-500">Reseta em {formatDate(props.account.tokens.resetAt)}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-[#7cff6b]">{props.account.tokens.remaining}</p>
            <p className="text-xs text-zinc-500">tokens</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {plans.map((plan) => (
          <article
            key={plan.id}
            className={`flex min-h-[300px] flex-col rounded-xl border p-4 ${
              props.account.planId === plan.id
                ? "border-[#7cff6b]/60 bg-[#7cff6b]/10"
                : "border-white/10 bg-white/[0.04]"
            }`}
          >
            <div className="mb-4">
              <p className="text-lg font-black">{plan.name}</p>
              <p className="mt-1 text-2xl font-black text-[#7cff6b]">{plan.price}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{plan.description}</p>
            </div>
            <ul className="mb-4 grid gap-2 text-sm text-zinc-300">
              {plan.benefits.map((benefit) => (
                <li key={benefit} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#7cff6b]" aria-hidden="true" />
                  {benefit}
                </li>
              ))}
            </ul>
            <button
              className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white text-sm font-black text-black transition hover:bg-[#7cff6b]"
              onClick={() => props.onChoosePlan(plan)}
              type="button"
            >
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              Selecionar
            </button>
          </article>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-4 text-sm leading-6 text-zinc-400">
        <p className="font-semibold text-white">Preparado para Mercado Pago</p>
        <p>
          O fluxo local ja aplica planos e tokens. Para cobranca real, conecte o backend com
          <code className="mx-1 rounded bg-white/10 px-1.5 py-0.5 text-[#c9ffc2]">
            MERCADO_PAGO_ACCESS_TOKEN
          </code>
          e crie a preferencia de checkout no Route Handler.
        </p>
        {props.billingMessage && <p className="mt-3 text-[#7cff6b]">{props.billingMessage}</p>}
      </div>
    </ModalShell>
  );
}

function SettingsModal(props: {
  account: Account;
  onClose: () => void;
  onSave: (account: Account) => void;
}) {
  const [draft, setDraft] = useState<Account>(props.account);

  function setSetting<Key extends keyof AccountSettings>(key: Key, value: AccountSettings[Key]) {
    setDraft((current) => ({
      ...current,
      settings: {
        ...current.settings,
        [key]: value,
      },
    }));
  }

  return (
    <ModalShell title="Configuracoes" onClose={props.onClose}>
      <div className="grid max-h-[72vh] gap-4 overflow-y-auto pr-1">
        <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-zinc-500">
            <User className="h-4 w-4" aria-hidden="true" />
            Perfil
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <span className="text-zinc-400">Nome</span>
              <input
                className="h-11 rounded-lg border border-white/10 bg-black/40 px-3 text-white outline-none focus:border-[#7cff6b]/70"
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                value={draft.name}
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-zinc-400">URL da foto</span>
              <input
                className="h-11 rounded-lg border border-white/10 bg-black/40 px-3 text-white outline-none focus:border-[#7cff6b]/70"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, avatarUrl: event.target.value }))
                }
                placeholder="https://..."
                value={draft.avatarUrl}
              />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-zinc-500">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            IA e geracao
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <span className="text-zinc-400">Qualidade</span>
              <select
                className="h-11 rounded-lg border border-white/10 bg-black/40 px-3 text-white outline-none focus:border-[#7cff6b]/70"
                onChange={(event) =>
                  setSetting("generationQuality", event.target.value as AccountSettings["generationQuality"])
                }
                value={draft.settings.generationQuality}
              >
                <option value="rapida">Rapida</option>
                <option value="equilibrada">Equilibrada</option>
                <option value="premium">Premium</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="text-zinc-400">Preview padrao</span>
              <select
                className="h-11 rounded-lg border border-white/10 bg-black/40 px-3 text-white outline-none focus:border-[#7cff6b]/70"
                onChange={(event) =>
                  setSetting("defaultPreview", event.target.value as AccountSettings["defaultPreview"])
                }
                value={draft.settings.defaultPreview}
              >
                <option value="desktop">Desktop</option>
                <option value="mobile">Mobile</option>
              </select>
            </label>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            <ToggleRow
              checked={draft.settings.detailedReplies}
              icon={<FileText className="h-4 w-4" />}
              label="Respostas detalhadas"
              onChange={(value) => setSetting("detailedReplies", value)}
            />
            <ToggleRow
              checked={draft.settings.developerMode}
              icon={<KeyRound className="h-4 w-4" />}
              label="Modo desenvolvedor"
              onChange={(value) => setSetting("developerMode", value)}
            />
            <ToggleRow
              checked={draft.settings.autosave}
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Autosave local"
              onChange={(value) => setSetting("autosave", value)}
            />
            <ToggleRow
              checked={draft.settings.compactChat}
              icon={<Bot className="h-4 w-4" />}
              label="Chat compacto"
              onChange={(value) => setSetting("compactChat", value)}
            />
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-zinc-500">
            <Palette className="h-4 w-4" aria-hidden="true" />
            Experiencia
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <ToggleRow
              checked={draft.settings.animations}
              icon={<Sparkles className="h-4 w-4" />}
              label="Animacoes"
              onChange={(value) => setSetting("animations", value)}
            />
            <ToggleRow
              checked={draft.settings.sound}
              icon={<Bell className="h-4 w-4" />}
              label="Som de notificacao"
              onChange={(value) => setSetting("sound", value)}
            />
            <ToggleRow
              checked={draft.settings.emailUpdates}
              icon={<Bell className="h-4 w-4" />}
              label="Emails de produto"
              onChange={(value) => setSetting("emailUpdates", value)}
            />
            <ToggleRow
              checked={draft.settings.publicProfile}
              icon={<User className="h-4 w-4" />}
              label="Perfil publico"
              onChange={(value) => setSetting("publicProfile", value)}
            />
          </div>
        </section>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="h-11 rounded-lg border border-white/10 px-4 text-sm font-semibold text-zinc-300 transition hover:text-white"
            onClick={() => setDraft({ ...props.account, settings: defaultSettings })}
            type="button"
          >
            Restaurar padrao
          </button>
          <button
            className="h-11 rounded-lg border border-white/10 px-4 text-sm font-semibold text-zinc-300 transition hover:text-white"
            onClick={props.onClose}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="h-11 rounded-lg bg-[#7cff6b] px-4 text-sm font-black text-black transition hover:bg-[#d8ff76]"
            onClick={() => props.onSave(draft)}
            type="button"
          >
            Salvar configuracoes
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function ToggleRow(props: {
  checked: boolean;
  icon: ReactNode;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      className="flex h-12 items-center justify-between rounded-lg border border-white/10 bg-black/25 px-3 text-left text-sm text-zinc-300 transition hover:border-[#7cff6b]/40"
      onClick={() => props.onChange(!props.checked)}
      type="button"
    >
      <span className="flex items-center gap-2">
        {props.icon}
        {props.label}
      </span>
      <span
        className={`relative h-6 w-11 rounded-full transition ${
          props.checked ? "bg-[#7cff6b]" : "bg-zinc-700"
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-black transition ${
            props.checked ? "left-6" : "left-1"
          }`}
        />
      </span>
    </button>
  );
}

function ModalShell(props: {
  children: ReactNode;
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 px-4 py-6 backdrop-blur-xl">
      <section className="relative w-full max-w-5xl rounded-2xl border border-white/12 bg-[#090d09]/98 p-5 text-white shadow-[0_30px_120px_rgba(0,0,0,0.65)] md:p-6">
        <button
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-zinc-800 text-zinc-400 transition hover:bg-zinc-700 hover:text-white"
          onClick={props.onClose}
          type="button"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Fechar modal</span>
        </button>
        <h2 className="mb-5 pr-12 text-2xl font-black tracking-[-0.03em]">{props.title}</h2>
        {props.children}
      </section>
    </div>
  );
}

function Avatar(props: { account: Account; size: "sm" | "md" | "lg" }) {
  const sizeClass =
    props.size === "lg" ? "h-20 w-20 text-2xl" : props.size === "md" ? "h-12 w-12 text-base" : "h-9 w-9 text-xs";

  if (props.account.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={`Foto de ${props.account.name}`}
        className={`${sizeClass} rounded-full object-cover`}
        src={props.account.avatarUrl}
      />
    );
  }

  return (
    <span
      className={`${sizeClass} grid shrink-0 place-items-center rounded-full font-black text-black`}
      style={{ background: props.account.avatarColor }}
    >
      {getInitials(props.account.name)}
    </span>
  );
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

function withPreviewInspector(html: string) {
  const inspector = `<script>
(() => {
  let selectedElement = null;

  function textFor(element) {
    if (element instanceof HTMLImageElement) return element.alt || element.src || "imagem";
    return (element.innerText || element.getAttribute("aria-label") || element.id || element.className || element.tagName).toString().trim().replace(/\\s+/g, " ");
  }

  function selectorFor(element) {
    if (element.id) return "#" + element.id;
    const parts = [];
    let current = element;
    while (current && current.nodeType === 1 && current !== document.body && parts.length < 4) {
      const tag = current.tagName.toLowerCase();
      const index = Array.from(current.parentElement ? current.parentElement.children : []).indexOf(current) + 1;
      parts.unshift(tag + ":nth-child(" + index + ")");
      current = current.parentElement;
    }
    return parts.join(" > ") || element.tagName.toLowerCase();
  }

  document.addEventListener("click", (event) => {
    const source = event.target;
    const target = source instanceof Element ? source.closest("a,button,h1,h2,h3,h4,p,img,section,article,header,footer,nav,li,span,div") : null;
    if (!target) return;

    event.preventDefault();
    event.stopPropagation();

    if (selectedElement) {
      selectedElement.style.outline = "";
      selectedElement.style.outlineOffset = "";
    }

    selectedElement = target;
    selectedElement.style.outline = "3px solid #7cff6b";
    selectedElement.style.outlineOffset = "3px";

    window.parent.postMessage({
      type: "zs-preview-select",
      tag: target.tagName.toLowerCase(),
      label: textFor(target).slice(0, 140),
      selector: selectorFor(target),
    }, "*");
  }, true);
})();
</script>`;

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${inspector}</body>`);
  }

  return `${html}${inspector}`;
}

function createZipBlob(files: Array<{ path: string; content: string }>) {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const normalizedPath = file.path.replace(/\\/g, "/");
    const nameBytes = encoder.encode(normalizedPath);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const localHeader = new Uint8Array(30 + nameBytes.length);

    writeUint32(localHeader, 0, 0x04034b50);
    writeUint16(localHeader, 4, 20);
    writeUint16(localHeader, 6, 0);
    writeUint16(localHeader, 8, 0);
    writeUint16(localHeader, 10, 0);
    writeUint16(localHeader, 12, 0);
    writeUint32(localHeader, 14, crc);
    writeUint32(localHeader, 18, data.length);
    writeUint32(localHeader, 22, data.length);
    writeUint16(localHeader, 26, nameBytes.length);
    writeUint16(localHeader, 28, 0);
    localHeader.set(nameBytes, 30);

    chunks.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    writeUint32(centralHeader, 0, 0x02014b50);
    writeUint16(centralHeader, 4, 20);
    writeUint16(centralHeader, 6, 20);
    writeUint16(centralHeader, 8, 0);
    writeUint16(centralHeader, 10, 0);
    writeUint16(centralHeader, 12, 0);
    writeUint16(centralHeader, 14, 0);
    writeUint32(centralHeader, 16, crc);
    writeUint32(centralHeader, 20, data.length);
    writeUint32(centralHeader, 24, data.length);
    writeUint16(centralHeader, 28, nameBytes.length);
    writeUint16(centralHeader, 30, 0);
    writeUint16(centralHeader, 32, 0);
    writeUint16(centralHeader, 34, 0);
    writeUint16(centralHeader, 36, 0);
    writeUint32(centralHeader, 38, 0);
    writeUint32(centralHeader, 42, offset);
    centralHeader.set(nameBytes, 46);
    centralDirectory.push(centralHeader);

    offset += localHeader.length + data.length;
  }

  const centralStart = offset;
  const centralSize = centralDirectory.reduce((size, item) => size + item.length, 0);
  const end = new Uint8Array(22);
  writeUint32(end, 0, 0x06054b50);
  writeUint16(end, 8, files.length);
  writeUint16(end, 10, files.length);
  writeUint32(end, 12, centralSize);
  writeUint32(end, 16, centralStart);

  return new Blob(
    [...chunks, ...centralDirectory, end].map((chunk) => {
      const copy = new Uint8Array(chunk.byteLength);
      copy.set(chunk);
      return copy.buffer;
    }),
    { type: "application/zip" },
  );
}

function writeUint16(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function emptyPreview(name: string) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #050705;
      color: #f4fff2;
      font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    }
    section {
      width: min(680px, calc(100vw - 32px));
      border: 1px solid rgba(124,255,107,.2);
      border-radius: 22px;
      padding: 38px;
      background: radial-gradient(circle at top, rgba(124,255,107,.16), transparent 38%), #0b110b;
      box-shadow: 0 30px 120px rgba(0,0,0,.5);
      text-align: center;
    }
    h1 { margin: 0; font-size: clamp(38px, 8vw, 72px); line-height: .92; letter-spacing: -.05em; }
    p { color: #98a996; line-height: 1.7; font-size: 17px; }
    strong { color: #7cff6b; }
  </style>
</head>
<body>
  <section>
    <h1>Preview pronto para ${escapePreview(name)}</h1>
    <p>Escreva no chat o site ou SaaS que voce quer criar. A IA monta o visual, sugere arquivos e depois entende pedidos de edicao.</p>
    <p><strong>Exemplo:</strong> crie um site para uma barbearia com agendamento.</p>
  </section>
</body>
</html>`;
}

function loadAccounts() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as Account[]) : [];
  } catch {
    return [];
  }
}

function persistAccounts(accounts: Account[], activeId?: string) {
  window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  if (activeId) window.localStorage.setItem(ACTIVE_ACCOUNT_KEY, activeId);
}

function replaceAccount(accounts: Account[], account: Account) {
  const exists = accounts.some((item) => item.id === account.id);
  if (!exists) return [...accounts, account];
  return accounts.map((item) => (item.id === account.id ? account : item));
}

function ensureWeeklyTokens(account: Account) {
  const resetAt = Date.parse(account.tokens.resetAt);
  if (Number.isNaN(resetAt) || resetAt > Date.now()) return account;

  return {
    ...account,
    tokens: {
      remaining: account.tokens.weeklyAllowance,
      weeklyAllowance: account.tokens.weeklyAllowance,
      usedThisWeek: 0,
      resetAt: nextWeeklyReset(),
    },
  };
}

function deductTokens(account: Account, cost: number) {
  const normalized = ensureWeeklyTokens(account);
  const tokenCost = Math.max(0, cost);

  return {
    ...normalized,
    tokens: {
      ...normalized.tokens,
      remaining: Math.max(0, normalized.tokens.remaining - tokenCost),
      usedThisWeek: normalized.tokens.usedThisWeek + tokenCost,
    },
  };
}

function hasFinishedOnboarding(accountId: string) {
  return window.localStorage.getItem(`${ONBOARDING_KEY}:${accountId}`) === "done";
}

function demoHash(value: string) {
  const bytes = new TextEncoder().encode(value);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).split("").reverse().join("");
}

function nextWeeklyReset() {
  const next = new Date();
  next.setDate(next.getDate() + 7);
  return next.toISOString();
}

function createId() {
  return `acct_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function pickAvatarColor(seed: string) {
  const colors = ["#7cff6b", "#d8ff76", "#4fe8ff", "#ffc768", "#ff8db4"];
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash + seed.charCodeAt(index) * (index + 1)) % colors.length;
  }
  return colors[hash];
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getCellDistance(index: number, activeIndex: number | null, columns: number) {
  if (activeIndex === null) return Number.POSITIVE_INFINITY;

  const row = Math.floor(index / columns);
  const column = index % columns;
  const activeRow = Math.floor(activeIndex / columns);
  const activeColumn = activeIndex % columns;

  return Math.abs(row - activeRow) + Math.abs(column - activeColumn);
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function escapePreview(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
