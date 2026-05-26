export type BuilderFile = {
  path: string;
  language: string;
  description: string;
  content: string;
};

export type BuilderProject = {
  id: string;
  name: string;
  kind: "saas" | "site" | "landing" | "dashboard";
  summary: string;
  previewHtml: string;
  steps: string[];
  features: string[];
  files: BuilderFile[];
};

const palettes = [
  {
    name: "cyan",
    background: "#061018",
    surface: "#0d1b27",
    primary: "#4fe8ff",
    secondary: "#7cf6b8",
    text: "#edf8ff",
    muted: "#9db2c4",
  },
  {
    name: "green",
    background: "#07130d",
    surface: "#102119",
    primary: "#82f2a5",
    secondary: "#f5d16b",
    text: "#f2fff7",
    muted: "#a9bfaf",
  },
  {
    name: "blue",
    background: "#081021",
    surface: "#101b31",
    primary: "#8db7ff",
    secondary: "#8bf1df",
    text: "#f2f6ff",
    muted: "#a6b6d1",
  },
];

export function buildProjectFromPrompt(prompt: string): BuilderProject {
  const cleanPrompt = prompt.trim();
  const kind = detectKind(cleanPrompt);
  const industry = detectIndustry(cleanPrompt);
  const palette = pickPalette(cleanPrompt);
  const name = buildName(cleanPrompt, industry, kind);
  const features = buildFeatures(cleanPrompt, kind, industry);
  const steps = [
    "Entendi o tipo de produto e público.",
    "Defini layout, proposta de valor e navegação.",
    "Gerei a primeira versão visual no preview.",
    "Preparei estrutura de arquivos para evoluir o projeto.",
  ];
  const summary =
    kind === "saas" || kind === "dashboard"
      ? `${name} é um SaaS com onboarding, métricas, painel e fluxo de conversão prontos para virar código.`
      : `${name} é um site responsivo com hero, seções de valor, prova social e chamada para conversão.`;

  return {
    id: createId(cleanPrompt),
    name,
    kind,
    summary,
    steps,
    features,
    files: buildFiles(name, kind, features),
    previewHtml: buildPreviewHtml({
      prompt: cleanPrompt,
      name,
      kind,
      industry,
      features,
      palette,
    }),
  };
}

function detectKind(prompt: string): BuilderProject["kind"] {
  const lower = prompt.toLowerCase();

  if (lower.includes("saas") || lower.includes("sistema")) return "saas";
  if (lower.includes("dashboard") || lower.includes("painel")) return "dashboard";
  if (lower.includes("landing")) return "landing";
  if (lower.includes("site")) return "site";
  return "saas";
}

function detectIndustry(prompt: string) {
  const lower = prompt.toLowerCase();
  const matches = [
    ["restaurante", "restaurantes"],
    ["barbearia", "barbearias"],
    ["academia", "academias"],
    ["imobiliaria", "imobiliárias"],
    ["imobiliária", "imobiliárias"],
    ["clinica", "clínicas"],
    ["clínica", "clínicas"],
    ["loja", "lojas online"],
    ["pet", "pet shops"],
    ["advogado", "escritórios jurídicos"],
  ];

  return matches.find(([needle]) => lower.includes(needle))?.[1] ?? "negócios digitais";
}

function pickPalette(prompt: string) {
  const lower = prompt.toLowerCase();
  if (lower.includes("saúde") || lower.includes("clinica") || lower.includes("clínica")) {
    return palettes[1];
  }
  if (lower.includes("financeiro") || lower.includes("dashboard")) {
    return palettes[2];
  }
  return palettes[0];
}

function buildName(prompt: string, industry: string, kind: BuilderProject["kind"]) {
  const explicitName = prompt.match(/(?:chamado|nome|marca)\s+([A-ZÀ-Úa-zà-ú0-9 ]{3,28})/i)?.[1];
  if (explicitName) return titleCase(explicitName);

  const prefix = kind === "site" || kind === "landing" ? "ZS Site" : "ZS SaaS";
  const suffix = industry
    .replace("negócios digitais", "Builder")
    .replace("restaurantes", "Food")
    .replace("barbearias", "Barber")
    .replace("academias", "Fit")
    .replace("clínicas", "Care")
    .replace("lojas online", "Store")
    .replace("pet shops", "Pet")
    .replace("escritórios jurídicos", "Legal");

  return `${prefix} ${titleCase(suffix)}`;
}

function buildFeatures(
  prompt: string,
  kind: BuilderProject["kind"],
  industry: string,
) {
  const base =
    kind === "dashboard"
      ? ["Métricas em tempo real", "Tabela de clientes", "Filtros rápidos", "Alertas operacionais"]
      : kind === "site" || kind === "landing"
        ? ["Hero de conversão", "Seções responsivas", "Prova social", "CTA para WhatsApp"]
        : ["Onboarding guiado", "Dashboard de uso", "Planos e cobrança", "Área administrativa"];

  if (prompt.toLowerCase().includes("login")) base.push("Autenticação");
  if (prompt.toLowerCase().includes("pagamento")) base.push("Pagamentos");
  if (industry !== "negócios digitais") base.push(`Copy adaptada para ${industry}`);

  return base.slice(0, 6);
}

function buildFiles(
  name: string,
  kind: BuilderProject["kind"],
  features: string[],
): BuilderFile[] {
  return [
    {
      path: "src/app/page.tsx",
      language: "tsx",
      description: "Página inicial gerada com a estrutura principal.",
      content: `export default function Page() {\n  return <${kind === "dashboard" ? "Dashboard" : "LandingPage"} />;\n}`,
    },
    {
      path: "src/components/generated-preview.tsx",
      language: "tsx",
      description: "Componentes reutilizáveis para hero, cards e CTA.",
      content: `export function GeneratedPreview() {\n  return <main>${escapeHtml(name)}</main>;\n}`,
    },
    {
      path: "src/lib/generated-config.ts",
      language: "ts",
      description: "Configuração do produto, recursos e textos principais.",
      content: `export const generatedFeatures = ${JSON.stringify(features, null, 2)};`,
    },
  ];
}

function buildPreviewHtml(input: {
  prompt: string;
  name: string;
  kind: BuilderProject["kind"];
  industry: string;
  features: string[];
  palette: (typeof palettes)[number];
}) {
  const isDashboard = input.kind === "dashboard" || input.kind === "saas";
  const escapedName = escapeHtml(input.name);
  const description = escapeHtml(
    isDashboard
      ? `Sistema para ${input.industry} com operação, clientes e automações em um só lugar.`
      : `Site para ${input.industry} com presença profissional, copy clara e foco em conversão.`,
  );
  const promptSummary = escapeHtml(input.prompt || "Projeto gerado pela IA ZS.");
  const featureCards = input.features
    .map(
      (feature, index) => `
        <article class="feature">
          <span>0${index + 1}</span>
          <strong>${escapeHtml(feature)}</strong>
          <p>${buildFeatureText(feature)}</p>
        </article>`,
    )
    .join("");

  const mainSurface = isDashboard
    ? `
      <section class="product">
        <div class="toolbar">
          <span>Receita</span><span>Clientes</span><span>Automações</span>
        </div>
        <div class="metrics">
          <div><strong>R$ 48k</strong><span>pipeline</span></div>
          <div><strong>312</strong><span>leads</span></div>
          <div><strong>91%</strong><span>saúde</span></div>
        </div>
        <div class="rows">
          <p><b>Plano Pro</b><span>implantação hoje</span></p>
          <p><b>CRM integrado</b><span>12 tarefas abertas</span></p>
          <p><b>Checkout</b><span>pagamentos ativos</span></p>
        </div>
      </section>`
    : `
      <section class="product site">
        <div class="mock-nav"><span></span><span></span><span></span></div>
        <h2>Transforme visitantes em clientes</h2>
        <p>Uma experiência clara, rápida e pronta para publicar.</p>
        <button>Quero começar</button>
      </section>`;

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
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: ${input.palette.background};
      color: ${input.palette.text};
    }
    .page {
      min-height: 100vh;
      padding: 32px;
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 28px;
    }
    header, footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .brand {
      font-weight: 800;
      letter-spacing: .08em;
      color: ${input.palette.primary};
    }
    nav {
      display: flex;
      gap: 10px;
      color: ${input.palette.muted};
      font-size: 13px;
    }
    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(320px, .9fr);
      align-items: center;
      gap: 28px;
    }
    h1 {
      margin: 0;
      max-width: 760px;
      font-size: clamp(32px, 7vw, 86px);
      line-height: .94;
      letter-spacing: -0.04em;
    }
    .lead {
      max-width: 620px;
      color: ${input.palette.muted};
      font-size: 18px;
      line-height: 1.65;
      margin: 22px 0;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    button, .primary, .secondary {
      border: 0;
      border-radius: 10px;
      padding: 13px 18px;
      font-weight: 800;
    }
    .primary {
      background: ${input.palette.primary};
      color: ${input.palette.background};
    }
    .secondary {
      border: 1px solid color-mix(in srgb, ${input.palette.primary} 28%, transparent);
      color: ${input.palette.text};
      background: ${input.palette.surface};
    }
    .product {
      border: 1px solid color-mix(in srgb, ${input.palette.primary} 18%, transparent);
      background: linear-gradient(145deg, ${input.palette.surface}, color-mix(in srgb, ${input.palette.surface} 70%, #000));
      border-radius: 18px;
      padding: 22px;
      box-shadow: 0 28px 80px rgba(0,0,0,.35);
    }
    .toolbar, .metrics {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .toolbar span, .metrics div, .feature, .rows p {
      border: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.04);
      border-radius: 12px;
      padding: 14px;
    }
    .metrics {
      margin: 18px 0;
    }
    .metrics strong {
      display: block;
      font-size: 26px;
    }
    .metrics span, .rows span {
      color: ${input.palette.muted};
      font-size: 12px;
    }
    .rows {
      display: grid;
      gap: 10px;
    }
    .rows p {
      display: flex;
      justify-content: space-between;
      margin: 0;
    }
    .site {
      min-height: 420px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .mock-nav {
      display: flex;
      gap: 8px;
      margin-bottom: 50px;
    }
    .mock-nav span {
      width: 64px;
      height: 8px;
      border-radius: 99px;
      background: rgba(255,255,255,.16);
    }
    .site h2 {
      font-size: 44px;
      line-height: 1;
      margin: 0 0 12px;
    }
    .site p {
      color: ${input.palette.muted};
      font-size: 18px;
    }
    .features {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    .feature span {
      color: ${input.palette.secondary};
      font-size: 12px;
      font-weight: 900;
    }
    .feature strong {
      display: block;
      margin: 8px 0;
    }
    .feature p {
      margin: 0;
      color: ${input.palette.muted};
      line-height: 1.5;
      font-size: 13px;
    }
    footer {
      color: ${input.palette.muted};
      font-size: 13px;
    }
    @media (max-width: 760px) {
      .page { padding: 18px; }
      .hero { grid-template-columns: 1fr; }
      .features { grid-template-columns: 1fr; }
      nav { display: none; }
      .site h2 { font-size: 32px; }
      .toolbar, .metrics { grid-template-columns: 1fr; }
      .rows p { flex-direction: column; gap: 6px; }
    }
  </style>
</head>
<body>
  <main class="page">
    <header>
      <div class="brand">${escapedName}</div>
      <nav><span>Produto</span><span>Recursos</span><span>Contato</span></nav>
    </header>
    <section class="hero">
      <div>
        <h1>${isDashboard ? "Operação pronta para escalar" : "Um site que vende antes da primeira reunião"}</h1>
        <p class="lead">${description}</p>
        <div class="actions">
          <a class="primary">Começar agora</a>
          <a class="secondary">Ver estrutura</a>
        </div>
      </div>
      ${mainSurface}
    </section>
    <section class="features">${featureCards}</section>
    <footer><span>Gerado pela IA ZS</span><span>${promptSummary}</span></footer>
  </main>
</body>
</html>`;
}

function buildFeatureText(feature: string) {
  const normalized = feature.toLowerCase();
  if (normalized.includes("pagamento")) return "Estrutura pronta para checkout, assinatura e webhooks.";
  if (normalized.includes("autenticação")) return "Fluxo de acesso preparado para rotas privadas.";
  if (normalized.includes("dashboard")) return "Indicadores e módulos organizados para gestão diária.";
  if (normalized.includes("hero")) return "Primeiro impacto com mensagem direta e ação clara.";
  if (normalized.includes("whatsapp")) return "Chamada rápida para contato e conversão.";
  return "Bloco reutilizável para evoluir o produto com consistência.";
}

function titleCase(input: string) {
  return input
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createId(input: string) {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }
  return `zs_${(hash >>> 0).toString(36)}`;
}
