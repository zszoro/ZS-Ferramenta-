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
  prompt: string;
  industry: string;
  paletteName: string;
  previewHtml: string;
  steps: string[];
  features: string[];
  files: BuilderFile[];
  editCount: number;
  createdAt: string;
  updatedAt: string;
};

export type BuilderAssistantResponse = {
  mode: "chat" | "create" | "edit";
  reply: string;
  project?: BuilderProject;
  suggestions: string[];
  tokenCost: number;
};

type Palette = {
  name: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  primary: string;
  secondary: string;
  text: string;
  muted: string;
};

const palettes: Palette[] = [
  {
    name: "neon",
    background: "#050807",
    surface: "#0d1511",
    surfaceAlt: "#111f18",
    primary: "#7cff6b",
    secondary: "#d8ff76",
    text: "#f5fff3",
    muted: "#9fb49b",
  },
  {
    name: "cyan",
    background: "#061018",
    surface: "#0d1b27",
    surfaceAlt: "#102436",
    primary: "#4fe8ff",
    secondary: "#7cf6b8",
    text: "#edf8ff",
    muted: "#9db2c4",
  },
  {
    name: "blue",
    background: "#081021",
    surface: "#101b31",
    surfaceAlt: "#152542",
    primary: "#8db7ff",
    secondary: "#8bf1df",
    text: "#f2f6ff",
    muted: "#a6b6d1",
  },
  {
    name: "rose",
    background: "#14070d",
    surface: "#231018",
    surfaceAlt: "#321321",
    primary: "#ff8db4",
    secondary: "#ffd37a",
    text: "#fff4f8",
    muted: "#d5aab8",
  },
  {
    name: "amber",
    background: "#120c05",
    surface: "#211609",
    surfaceAlt: "#2e210f",
    primary: "#ffc768",
    secondary: "#8bf1df",
    text: "#fff8ec",
    muted: "#d0b991",
  },
];

const defaultSuggestions = [
  "Troque o titulo principal por Barbearia Elite.",
  "Adicione login, dashboard e planos pagos.",
  "Mude as cores para verde neon e deixe mais premium.",
];

export function respondToBuilderMessage(input: {
  message: string;
  project?: BuilderProject | null;
}): BuilderAssistantResponse {
  const message = input.message.trim();

  if (!message) {
    return {
      mode: "chat",
      reply: "Me diga o site, SaaS ou ajuste que voce quer criar.",
      suggestions: defaultSuggestions,
      tokenCost: 0,
    };
  }

  if (input.project && looksLikeEdit(message)) {
    const project = editProjectFromPrompt(input.project, message);

    return {
      mode: "edit",
      project,
      reply: [
        `Atualizei o projeto ${project.name} no preview.`,
        "Eu tratei seu pedido como edicao do site atual, mantive a estrutura anterior e regenerei os arquivos sugeridos.",
        `Alteracoes aplicadas: ${project.features.slice(0, 4).join(", ")}.`,
      ].join("\n\n"),
      suggestions: [
        "Crie uma area de agendamento com horarios.",
        "Adicione uma secao de planos com Mercado Pago.",
        "Deixe o hero mais sofisticado e com prova social.",
      ],
      tokenCost: estimateTokenCost(message, "edit"),
    };
  }

  if (looksLikeBuild(message) || !input.project) {
    const project = buildProjectFromPrompt(message);

    return {
      mode: "create",
      project,
      reply: [
        `Criei uma primeira versao de ${project.name} com preview ao vivo.`,
        project.summary,
        "Tambem deixei uma estrutura de arquivos para evoluir o projeto para codigo real, com componentes, rotas e configuracoes funcionais.",
      ].join("\n\n"),
      suggestions: [
        "Troque o titulo principal por outro nome.",
        "Adicione autenticacao, pagamentos e painel admin.",
        "Crie uma versao mobile com CTA fixo.",
      ],
      tokenCost: estimateTokenCost(message, "create"),
    };
  }

  return {
    mode: "chat",
    reply: buildConversationalReply(message, input.project),
    suggestions: defaultSuggestions,
    tokenCost: estimateTokenCost(message, "chat"),
  };
}

export function buildProjectFromPrompt(prompt: string): BuilderProject {
  const cleanPrompt = prompt.trim();
  const now = new Date().toISOString();
  const kind = detectKind(cleanPrompt);
  const industry = detectIndustry(cleanPrompt);
  const palette = pickPalette(cleanPrompt);
  const name = buildName(cleanPrompt, industry, kind);
  const features = buildFeatures(cleanPrompt, kind, industry);
  const steps = [
    "Entendimento do publico, objetivo e tipo de produto.",
    "Definicao de arquitetura visual, paginas e componentes.",
    "Geracao do preview seguro dentro do iframe.",
    "Criacao de arquivos sugeridos para evoluir o projeto real.",
    "Preparacao para integrar banco, autenticacao, APIs e pagamentos.",
  ];
  const summary =
    kind === "saas" || kind === "dashboard"
      ? `${name} e um sistema com onboarding, painel, metricas, entidades de negocio e caminhos preparados para autenticacao, banco e pagamento.`
      : `${name} e um site responsivo com hero forte, secoes de valor, prova social, CTA e estrutura pronta para virar codigo publicado.`;

  return {
    id: createId(cleanPrompt),
    name,
    kind,
    summary,
    prompt: cleanPrompt,
    industry,
    paletteName: palette.name,
    steps,
    features,
    files: buildFiles(name, kind, features, cleanPrompt),
    previewHtml: buildPreviewHtml({
      prompt: cleanPrompt,
      name,
      kind,
      industry,
      features,
      palette,
      editNotes: [],
    }),
    editCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function editProjectFromPrompt(project: BuilderProject, prompt: string): BuilderProject {
  const now = new Date().toISOString();
  const changes: string[] = [];
  const requestedName = extractRequestedName(prompt);
  const requestedKind = extractRequestedKind(prompt);
  const requestedPalette = pickEditPalette(prompt) ?? getPalette(project.paletteName);
  const nextFeatures = mergeFeatures(
    project.features,
    buildFeatures(prompt, requestedKind ?? project.kind, project.industry),
  );

  let name = project.name;
  if (requestedName) {
    name = requestedName;
    changes.push(`titulo/nome alterado para ${requestedName}`);
  }

  if (requestedPalette.name !== project.paletteName) {
    changes.push(`paleta alterada para ${requestedPalette.name}`);
  }

  const kind = requestedKind ?? project.kind;
  if (kind !== project.kind) {
    changes.push(`tipo ajustado para ${kind}`);
  }

  if (changes.length === 0) {
    changes.push("pedido aplicado como refinamento de conteudo e estrutura");
  }

  const nextPrompt = `${project.prompt}\nEdicao ${project.editCount + 1}: ${prompt}`;
  const summary = `${name} foi atualizado com ${changes.join(", ")}. O preview e os arquivos foram regenerados preservando a base do projeto.`;

  return {
    ...project,
    name,
    kind,
    summary,
    prompt: nextPrompt,
    paletteName: requestedPalette.name,
    features: nextFeatures,
    files: buildFiles(name, kind, nextFeatures, nextPrompt),
    previewHtml: buildPreviewHtml({
      prompt: nextPrompt,
      name,
      kind,
      industry: project.industry,
      features: nextFeatures,
      palette: requestedPalette,
      editNotes: changes,
    }),
    editCount: project.editCount + 1,
    updatedAt: now,
  };
}

function looksLikeBuild(prompt: string) {
  const lower = normalize(prompt);
  return [
    "crie",
    "criar",
    "faca",
    "fazer",
    "gere",
    "gerar",
    "monte",
    "site",
    "saas",
    "sistema",
    "landing",
    "dashboard",
    "loja",
    "barbearia",
    "clinica",
    "restaurante",
    "aplicativo",
  ].some((word) => lower.includes(word));
}

function looksLikeEdit(prompt: string) {
  const lower = normalize(prompt);
  return [
    "troque",
    "mude",
    "altere",
    "edite",
    "adicione",
    "coloque",
    "remova",
    "tire",
    "aumente",
    "diminua",
    "titulo",
    "nome",
    "cor",
    "botao",
    "secao",
    "seção",
    "whatsapp",
    "pagamento",
    "login",
    "dashboard",
  ].some((word) => lower.includes(word));
}

function buildConversationalReply(prompt: string, project?: BuilderProject | null) {
  const lower = normalize(prompt);

  if (lower.includes("ola") || lower.includes("oi") || lower.includes("bom dia")) {
    return "Oi, zs. Eu posso conversar normal, criar um site do zero ou editar o preview atual. Se ja tiver um projeto aberto, fale algo como: troque o titulo para Barbearia Elite, ou adicione uma area de planos.";
  }

  if (lower.includes("como funciona") || lower.includes("ajuda")) {
    return [
      "Funciona assim: voce descreve o site ou SaaS, eu gero o preview, listo arquivos e depois entendo pedidos de edicao no projeto atual.",
      "Exemplos: crie um SaaS para academias; mude a cor para verde neon; adicione login e dashboard; troque o titulo por Barbearia Elite.",
    ].join("\n\n");
  }

  if (project) {
    return `O projeto atual e ${project.name}. Posso editar textos, cores, secoes, CTAs, recursos e estrutura funcional. Me diga exatamente o que quer mudar no preview.`;
  }

  return "Ainda nao existe um projeto aberto. Me diga o tipo de site ou SaaS que voce quer criar e eu monto a primeira versao com preview.";
}

function detectKind(prompt: string): BuilderProject["kind"] {
  const lower = normalize(prompt);

  if (lower.includes("dashboard") || lower.includes("painel")) return "dashboard";
  if (lower.includes("landing")) return "landing";
  if (lower.includes("saas") || lower.includes("sistema") || hasWord(lower, "app") || lower.includes("aplicativo")) {
    return "saas";
  }
  if (lower.includes("site")) return "site";
  return "site";
}

function extractRequestedKind(prompt: string): BuilderProject["kind"] | null {
  const lower = normalize(prompt);
  if (lower.includes("dashboard") || lower.includes("painel")) return "dashboard";
  if (lower.includes("landing")) return "landing";
  if (lower.includes("saas") || lower.includes("sistema")) return "saas";
  if (lower.includes("site")) return "site";
  return null;
}

function detectIndustry(prompt: string) {
  const lower = normalize(prompt);
  const matches: Array<[string, string]> = [
    ["restaurante", "restaurantes"],
    ["barbearia", "barbearias"],
    ["barber", "barbearias"],
    ["academia", "academias"],
    ["imobiliaria", "imobiliarias"],
    ["clinica", "clinicas"],
    ["loja", "lojas online"],
    ["ecommerce", "lojas online"],
    ["pet", "pet shops"],
    ["advogado", "escritorios juridicos"],
    ["juridico", "escritorios juridicos"],
    ["financeiro", "operacoes financeiras"],
    ["curso", "educacao online"],
    ["escola", "educacao online"],
  ];

  return matches.find(([needle]) => lower.includes(needle))?.[1] ?? "negocios digitais";
}

function pickPalette(prompt: string) {
  return pickEditPalette(prompt) ?? palettes[0];
}

function pickEditPalette(prompt: string) {
  const lower = normalize(prompt);
  if (lower.includes("verde") || lower.includes("neon")) return getPalette("neon");
  if (lower.includes("azul") || lower.includes("financeiro")) return getPalette("blue");
  if (lower.includes("ciano") || lower.includes("cyan") || lower.includes("tech")) return getPalette("cyan");
  if (lower.includes("rosa") || lower.includes("beleza") || lower.includes("estetica")) return getPalette("rose");
  if (lower.includes("laranja") || lower.includes("amarelo") || lower.includes("barbearia")) {
    return getPalette("amber");
  }
  return null;
}

function getPalette(name: string) {
  return palettes.find((palette) => palette.name === name) ?? palettes[0];
}

function buildName(prompt: string, industry: string, kind: BuilderProject["kind"]) {
  const explicitName = prompt.match(
    /(?:chamado|chamada|nome|marca|titulo|título)\s+(?:de\s+)?["']?([A-Za-zÀ-ÿ0-9 ][A-Za-zÀ-ÿ0-9 ]{2,34})["']?/i,
  )?.[1];

  if (explicitName) return titleCase(cleanName(explicitName));

  if (industry === "barbearias") return "Barbearia ZS";
  if (industry === "restaurantes") return "Mesa ZS";
  if (industry === "academias") return "Fit ZS";
  if (industry === "clinicas") return "Clinica ZS";

  const prefix = kind === "site" || kind === "landing" ? "Site ZS" : "SaaS ZS";
  const suffix = industry
    .replace("negocios digitais", "Builder")
    .replace("lojas online", "Store")
    .replace("pet shops", "Pet")
    .replace("escritorios juridicos", "Legal")
    .replace("operacoes financeiras", "Finance")
    .replace("educacao online", "Cursos");

  return `${prefix} ${titleCase(suffix)}`;
}

function extractRequestedName(prompt: string) {
  const patterns = [
    /(?:troque|mude|altere|renomeie|coloque)[^.!?;\n]{0,60}?(?:titulo|título|nome|marca|zs)[^.!?;\n]{0,28}?(?:para|por)\s+["']?([^"',.!?;\n]+?)(?=\s+e\s+(?:mude|altere|troque|coloque|adicione|remova|tire)\b|$|[,.!?;])/i,
    /(?:titulo|título|nome|marca)[^.!?;\n]{0,28}?(?:para|por)\s+["']?([^"',.!?;\n]+?)(?=\s+e\s+(?:mude|altere|troque|coloque|adicione|remova|tire)\b|$|[,.!?;])/i,
  ];

  for (const pattern of patterns) {
    const match = prompt.match(pattern)?.[1];
    if (match) return titleCase(cleanName(match));
  }

  return null;
}

function buildFeatures(
  prompt: string,
  kind: BuilderProject["kind"],
  industry: string,
) {
  const lower = normalize(prompt);
  const base =
    kind === "dashboard"
      ? ["Metricas em tempo real", "Tabela de clientes", "Filtros rapidos", "Alertas operacionais"]
      : kind === "site" || kind === "landing"
        ? ["Hero de conversao", "Secoes responsivas", "Prova social", "CTA para WhatsApp"]
        : ["Onboarding guiado", "Dashboard de uso", "Planos e cobranca", "Area administrativa"];

  if (lower.includes("login") || lower.includes("autenticacao")) base.push("Autenticacao");
  if (lower.includes("pagamento") || lower.includes("mercado pago") || lower.includes("checkout")) {
    base.push("Pagamentos com Mercado Pago");
  }
  if (lower.includes("agendamento") || lower.includes("horario")) base.push("Agendamento online");
  if (lower.includes("admin")) base.push("Painel administrativo");
  if (lower.includes("websocket") || lower.includes("tempo real")) base.push("Realtime");
  if (industry !== "negocios digitais") base.push(`Copy adaptada para ${industry}`);

  return unique(base).slice(0, 8);
}

function mergeFeatures(current: string[], next: string[]) {
  return unique([...current, ...next]).slice(0, 10);
}

function buildFiles(
  name: string,
  kind: BuilderProject["kind"],
  features: string[],
  prompt: string,
): BuilderFile[] {
  const slug = slugify(name);
  const wantsAuth = features.some((feature) => normalize(feature).includes("autentic"));
  const wantsPayment = features.some((feature) => normalize(feature).includes("pagamento"));
  const wantsDashboard = kind === "saas" || kind === "dashboard";

  const files: BuilderFile[] = [
    {
      path: "src/app/page.tsx",
      language: "tsx",
      description: "Pagina inicial gerada com a experiencia principal.",
      content: `import { ${componentName(name)} } from "@/components/generated/${slug}";\n\nexport default function Page() {\n  return <${componentName(name)} />;\n}`,
    },
    {
      path: `src/components/generated/${slug}.tsx`,
      language: "tsx",
      description: "Componentes reutilizaveis para hero, secoes, CTA e cards.",
      content: `import { generatedConfig } from "@/lib/generated/${slug}-config";\n\nexport function ${componentName(name)}() {\n  return (\n    <main>\n      <h1>{generatedConfig.name}</h1>\n      <p>{generatedConfig.summary}</p>\n    </main>\n  );\n}`,
    },
    {
      path: `src/lib/generated/${slug}-config.ts`,
      language: "ts",
      description: "Configuracao do produto, recursos e textos principais.",
      content: `export const generatedConfig = ${JSON.stringify(
        {
          name,
          kind,
          summary: prompt,
          features,
        },
        null,
        2,
      )};`,
    },
  ];

  if (wantsDashboard) {
    files.push({
      path: "src/app/dashboard/page.tsx",
      language: "tsx",
      description: "Dashboard funcional com metricas, lista de clientes e status.",
      content: `export default function DashboardPage() {\n  const metrics = ["Receita", "Clientes", "Conversao"];\n  return <section>{metrics.map((metric) => <article key={metric}>{metric}</article>)}</section>;\n}`,
    });
  }

  if (wantsAuth) {
    files.push({
      path: "src/app/api/auth/session/route.ts",
      language: "ts",
      description: "Rota preparada para sessao segura no backend.",
      content: `export async function GET() {\n  // Produção: validar cookie/sessao no banco e nunca expor segredo no frontend.\n  return Response.json({ authenticated: false });\n}`,
    });
  }

  if (wantsPayment) {
    files.push({
      path: "src/app/api/mercado-pago/checkout/route.ts",
      language: "ts",
      description: "Endpoint preparado para criar preferencia do Mercado Pago.",
      content: `export async function POST() {\n  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;\n  if (!accessToken) {\n    return Response.json({ error: "Configure MERCADO_PAGO_ACCESS_TOKEN" }, { status: 500 });\n  }\n  // Chamar a API do Mercado Pago aqui com os dados do plano escolhido.\n  return Response.json({ ready: true });\n}`,
    });
  }

  files.push({
    path: "prisma/schema.prisma",
    language: "prisma",
    description: "Modelo inicial para persistir usuarios, projetos, tokens e assinaturas.",
    content: `model User {\n  id        String   @id @default(cuid())\n  email     String   @unique\n  name      String\n  tokens    Int      @default(500)\n  createdAt DateTime @default(now())\n}\n\nmodel Project {\n  id        String   @id @default(cuid())\n  ownerId   String\n  name      String\n  prompt    String\n  html      String\n  createdAt DateTime @default(now())\n}`,
  });

  return files;
}

function buildPreviewHtml(input: {
  prompt: string;
  name: string;
  kind: BuilderProject["kind"];
  industry: string;
  features: string[];
  palette: Palette;
  editNotes: string[];
}) {
  const isDashboard = input.kind === "dashboard" || input.kind === "saas";
  const escapedName = escapeHtml(input.name);
  const description = escapeHtml(
    isDashboard
      ? `Sistema para ${input.industry} com clientes, automacoes, metricas e operacao em um so lugar.`
      : `Site para ${input.industry} com presenca profissional, copy clara, prova social e foco em conversao.`,
  );
  const promptSummary = escapeHtml(firstSentence(input.prompt || "Projeto gerado pela IA ZS."));
  const editNotes = input.editNotes
    .map((note) => `<li>${escapeHtml(note)}</li>`)
    .join("");
  const featureCards = input.features
    .slice(0, 6)
    .map(
      (feature, index) => `
        <article class="feature">
          <span>0${index + 1}</span>
          <strong>${escapeHtml(feature)}</strong>
          <p>${escapeHtml(buildFeatureText(feature))}</p>
        </article>`,
    )
    .join("");

  const productSurface = isDashboard
    ? `
      <section class="product" aria-label="Preview do produto">
        <div class="toolbar">
          <span>Hoje</span><span>Clientes</span><span>Automacoes</span>
        </div>
        <div class="metrics">
          <div><strong>R$ 48k</strong><span>pipeline</span></div>
          <div><strong>312</strong><span>clientes</span></div>
          <div><strong>91%</strong><span>saude</span></div>
        </div>
        <div class="timeline">
          <p><b>Plano Pro</b><span>checkout pronto</span></p>
          <p><b>CRM integrado</b><span>12 tarefas abertas</span></p>
          <p><b>IA ativa</b><span>gerando melhorias</span></p>
        </div>
      </section>`
    : `
      <section class="product site" aria-label="Preview do site">
        <div class="mock-nav"><span></span><span></span><span></span></div>
        <h2>Transforme visitantes em clientes</h2>
        <p>Uma experiencia rapida, clara e pronta para publicar.</p>
        <button type="button">Quero comecar</button>
      </section>`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapedName}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at 20% 0%, color-mix(in srgb, ${input.palette.primary} 20%, transparent), transparent 34%),
        linear-gradient(145deg, ${input.palette.background}, #020403 72%);
      color: ${input.palette.text};
    }
    .page {
      min-height: 100vh;
      padding: clamp(18px, 4vw, 46px);
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: clamp(22px, 4vw, 38px);
    }
    header, footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-weight: 900;
      letter-spacing: .03em;
      color: ${input.palette.text};
    }
    .brand::before {
      content: "";
      width: 12px;
      height: 12px;
      border-radius: 4px;
      background: ${input.palette.primary};
      box-shadow: 0 0 22px ${input.palette.primary};
    }
    nav {
      display: flex;
      gap: 18px;
      color: ${input.palette.muted};
      font-size: 13px;
      font-weight: 700;
    }
    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(320px, .9fr);
      align-items: center;
      gap: clamp(22px, 5vw, 58px);
    }
    h1 {
      margin: 0;
      max-width: 820px;
      font-size: clamp(42px, 8vw, 92px);
      line-height: .9;
      letter-spacing: -0.055em;
    }
    .lead {
      max-width: 620px;
      color: ${input.palette.muted};
      font-size: clamp(16px, 2vw, 20px);
      line-height: 1.65;
      margin: 24px 0;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    button, .primary, .secondary {
      border: 0;
      border-radius: 12px;
      padding: 14px 18px;
      font-weight: 900;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 46px;
    }
    .primary {
      background: ${input.palette.primary};
      color: ${input.palette.background};
      box-shadow: 0 18px 60px color-mix(in srgb, ${input.palette.primary} 22%, transparent);
    }
    .secondary {
      border: 1px solid color-mix(in srgb, ${input.palette.primary} 28%, transparent);
      color: ${input.palette.text};
      background: color-mix(in srgb, ${input.palette.surface} 80%, transparent);
    }
    .product {
      border: 1px solid color-mix(in srgb, ${input.palette.primary} 22%, transparent);
      background:
        linear-gradient(145deg, color-mix(in srgb, ${input.palette.surfaceAlt} 86%, transparent), ${input.palette.surface});
      border-radius: 22px;
      padding: clamp(18px, 3vw, 28px);
      box-shadow: 0 28px 100px rgba(0,0,0,.42);
      min-height: 420px;
    }
    .toolbar, .metrics {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .toolbar span, .metrics div, .feature, .timeline p, .edit-log {
      border: 1px solid rgba(255,255,255,.09);
      background: rgba(255,255,255,.045);
      border-radius: 14px;
      padding: 14px;
    }
    .metrics { margin: 18px 0; }
    .metrics strong {
      display: block;
      font-size: clamp(24px, 4vw, 34px);
      letter-spacing: -0.04em;
    }
    .metrics span, .timeline span {
      color: ${input.palette.muted};
      font-size: 12px;
      font-weight: 700;
    }
    .timeline {
      display: grid;
      gap: 10px;
    }
    .timeline p {
      display: flex;
      justify-content: space-between;
      margin: 0;
      gap: 12px;
    }
    .site {
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .mock-nav {
      display: flex;
      gap: 8px;
      margin-bottom: 54px;
    }
    .mock-nav span {
      width: 64px;
      height: 8px;
      border-radius: 99px;
      background: rgba(255,255,255,.16);
    }
    .site h2 {
      font-size: clamp(34px, 6vw, 58px);
      line-height: .95;
      letter-spacing: -0.045em;
      margin: 0 0 14px;
    }
    .site p {
      color: ${input.palette.muted};
      font-size: 18px;
    }
    .site button {
      align-self: flex-start;
      margin-top: 20px;
      background: ${input.palette.primary};
      color: ${input.palette.background};
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
      font-size: 17px;
    }
    .feature p {
      margin: 0;
      color: ${input.palette.muted};
      line-height: 1.5;
      font-size: 13px;
    }
    .edit-log {
      margin-top: 16px;
      color: ${input.palette.muted};
      font-size: 13px;
      line-height: 1.5;
    }
    .edit-log strong {
      color: ${input.palette.text};
    }
    footer {
      color: ${input.palette.muted};
      font-size: 13px;
    }
    @media (max-width: 860px) {
      .hero { grid-template-columns: 1fr; }
      .features { grid-template-columns: 1fr; }
      nav { display: none; }
      .toolbar, .metrics { grid-template-columns: 1fr; }
      .timeline p { flex-direction: column; }
    }
  </style>
</head>
<body>
  <main class="page">
    <header>
      <div class="brand">${escapedName}</div>
      <nav><span>Produto</span><span>Recursos</span><span>Planos</span><span>Contato</span></nav>
    </header>
    <section class="hero">
      <div>
        <h1>${isDashboard ? "Operacao pronta para escalar" : escapedName}</h1>
        <p class="lead">${description}</p>
        <div class="actions">
          <a class="primary">Comecar agora</a>
          <a class="secondary">Ver estrutura</a>
        </div>
        ${
          editNotes
            ? `<div class="edit-log"><strong>Edicao aplicada:</strong><ul>${editNotes}</ul></div>`
            : ""
        }
      </div>
      ${productSurface}
    </section>
    <section class="features">${featureCards}</section>
    <footer><span>Gerado pela IA ZS</span><span>${promptSummary}</span></footer>
  </main>
</body>
</html>`;
}

function buildFeatureText(feature: string) {
  const normalized = normalize(feature);
  if (normalized.includes("pagamento")) return "Estrutura pronta para checkout, assinatura e webhooks.";
  if (normalized.includes("autentic")) return "Fluxo preparado para rotas privadas, sessoes e banco.";
  if (normalized.includes("dashboard")) return "Indicadores e modulos organizados para gestao diaria.";
  if (normalized.includes("hero")) return "Primeiro impacto com mensagem direta e acao clara.";
  if (normalized.includes("whatsapp")) return "Chamada rapida para contato e conversao.";
  if (normalized.includes("agendamento")) return "Base para agenda, horarios e confirmacoes.";
  if (normalized.includes("realtime")) return "Preparado para atualizacoes em tempo real.";
  return "Bloco reutilizavel para evoluir o produto com consistencia.";
}

function estimateTokenCost(prompt: string, mode: BuilderAssistantResponse["mode"]) {
  const base = mode === "create" ? 44 : mode === "edit" ? 28 : 8;
  return Math.min(120, base + Math.ceil(prompt.length / 42));
}

function titleCase(input: string) {
  return input
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function cleanName(input: string) {
  return input
    .replace(/\b(e|com|por favor|porfavor|agora|no site|na pagina|na página)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 42);
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

function slugify(input: string) {
  return normalize(input)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 44);
}

function componentName(input: string) {
  const cleaned = slugify(input)
    .split("-")
    .map((part) => titleCase(part))
    .join("");

  return `${cleaned || "Generated"}Page`;
}

function normalize(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function firstSentence(input: string) {
  const sentence = input.split(/[.!?\n]/)[0]?.trim();
  return sentence ? sentence.slice(0, 120) : "Projeto gerado pela IA ZS";
}

function hasWord(input: string, word: string) {
  return new RegExp(`\\b${word}\\b`, "i").test(input);
}
