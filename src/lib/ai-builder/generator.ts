export type BuilderFile = {
  path: string;
  language: string;
  description: string;
  content: string;
};

export type ProjectBrief = {
  companyName: string;
  phoneWhatsapp?: string;
  email?: string;
  niche: string;
  primaryColor: string;
};

export type BuilderProject = {
  id: string;
  name: string;
  kind: "saas" | "site" | "landing" | "dashboard";
  summary: string;
  prompt: string;
  industry: string;
  paletteName: string;
  brief?: ProjectBrief;
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
  brief?: ProjectBrief | null;
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

  if (input.brief) {
    const project = buildProjectFromBrief(input.brief);

    return {
      mode: "create",
      project,
      reply: [
        `Criei um projeto para ${project.name} usando o briefing inicial.`,
        project.summary,
        "Usei nicho, cor principal e contato para montar uma primeira versao mais parecida com um site real, com imagens gratuitas no preview.",
      ].join("\n\n"),
      suggestions: [
        "Adicione depoimentos de clientes reais.",
        "Crie uma secao de servicos com precos.",
        "Troque a imagem principal por outra referencia.",
      ],
      tokenCost: estimateTokenCost(message, "create"),
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

export function buildProjectFromBrief(brief: ProjectBrief): BuilderProject {
  const cleanBrief = normalizeBrief(brief);
  const prompt = [
    `Crie um site profissional para ${cleanBrief.companyName}.`,
    `Nicho: ${cleanBrief.niche}.`,
    `Cor principal: ${cleanBrief.primaryColor}.`,
    cleanBrief.phoneWhatsapp ? `Telefone/WhatsApp: ${cleanBrief.phoneWhatsapp}.` : "",
    cleanBrief.email ? `Email: ${cleanBrief.email}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const now = new Date().toISOString();
  const industry = detectIndustry(cleanBrief.niche);
  const palette = buildPaletteFromColor(cleanBrief.primaryColor, prompt);
  const features = buildFeatures(prompt, "site", industry);
  const summary = `${cleanBrief.companyName} e um site profissional para ${industry}, com imagem real do nicho, CTA de contato, prova social, servicos e uma primeira estrutura pronta para publicar.`;

  return {
    id: createId(prompt),
    name: titleCase(cleanBrief.companyName),
    kind: "site",
    summary,
    prompt,
    industry,
    paletteName: palette.name,
    brief: cleanBrief,
    steps: [
      "Briefing estruturado recebido.",
      "Nicho, contato e cor principal aplicados.",
      "Imagens gratuitas do nicho selecionadas para o preview.",
      "Secoes de servicos, prova social e CTA montadas.",
      "Arquivos sugeridos preparados para evoluir o projeto.",
    ],
    features,
    files: buildFiles(cleanBrief.companyName, "site", features, prompt, cleanBrief),
    previewHtml: buildPreviewHtml({
      prompt,
      name: titleCase(cleanBrief.companyName),
      kind: "site",
      industry,
      features,
      palette,
      brief: cleanBrief,
      editNotes: [],
    }),
    editCount: 0,
    createdAt: now,
    updatedAt: now,
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
      brief: undefined,
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
    files: buildFiles(name, kind, nextFeatures, nextPrompt, project.brief),
    previewHtml: buildPreviewHtml({
      prompt: nextPrompt,
      name,
      kind,
      industry: project.industry,
      features: nextFeatures,
      palette: requestedPalette,
      brief: project.brief,
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
    ["padaria", "padarias"],
    ["pao", "padarias"],
    ["paes", "padarias"],
    ["odontologia", "clinicas odontologicas"],
    ["odontologica", "clinicas odontologicas"],
    ["dentista", "clinicas odontologicas"],
    ["dental", "clinicas odontologicas"],
    ["oficina mecanica", "oficinas mecanicas"],
    ["oficina", "oficinas mecanicas"],
    ["mecanica", "oficinas mecanicas"],
    ["mecanico", "oficinas mecanicas"],
    ["auto", "oficinas mecanicas"],
    ["roupa", "lojas de roupas"],
    ["roupas", "lojas de roupas"],
    ["moda", "lojas de roupas"],
    ["vestuario", "lojas de roupas"],
    ["boutique", "lojas de roupas"],
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

function buildPaletteFromColor(color: string, fallbackPrompt: string): Palette {
  const cleanColor = normalizeColor(color);

  if (!cleanColor) return pickPalette(fallbackPrompt);

  return {
    name: "custom",
    background: "#070706",
    surface: "#11110f",
    surfaceAlt: "#1a1a16",
    primary: cleanColor,
    secondary: "#f6f1df",
    text: "#fffdf5",
    muted: "#c8c0ad",
  };
}

function normalizeColor(color: string) {
  const trimmed = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }

  return null;
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
  if (industry === "clinicas odontologicas") return "Clinica ZS";
  if (industry === "padarias") return "Padaria ZS";
  if (industry === "oficinas mecanicas") return "Auto ZS";
  if (industry === "lojas de roupas") return "Moda ZS";

  const prefix = kind === "site" || kind === "landing" ? "Site ZS" : "SaaS ZS";
  const suffix = industry
    .replace("negocios digitais", "Builder")
    .replace("padarias", "Padaria")
    .replace("clinicas odontologicas", "Dental")
    .replace("oficinas mecanicas", "Auto")
    .replace("lojas de roupas", "Moda")
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
  brief?: ProjectBrief,
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
          contact: brief
            ? {
                phoneWhatsapp: brief.phoneWhatsapp,
                email: brief.email,
                niche: brief.niche,
                primaryColor: brief.primaryColor,
              }
            : undefined,
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
  brief?: ProjectBrief;
  editNotes: string[];
}) {
  const isDashboard = input.kind === "dashboard" || input.kind === "saas";
  const escapedName = escapeHtml(input.name);
  const media = getNicheMedia(input.industry);
  const profile = getNicheProfile(input.industry, input.name);
  const theme = profile.theme;
  const contact = buildContact(input.brief);
  const description = escapeHtml(
    isDashboard
      ? `Sistema para ${input.industry} com clientes, automacoes, metricas e operacao em um so lugar.`
      : profile.description,
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
  const contactRows = [
    contact.whatsapp ? `<span>${escapeHtml(contact.whatsapp)}</span>` : "",
    contact.email ? `<span>${escapeHtml(contact.email)}</span>` : "",
    !contact.whatsapp && !contact.email ? "<span>Adicione telefone ou email no briefing para mostrar o contato aqui.</span>" : "",
  ]
    .filter(Boolean)
    .join("");
  const navItems = profile.navItems
    .map((item, index) => `<a href="${index === profile.navItems.length - 1 ? "#contato" : "#servicos"}">${escapeHtml(item)}</a>`)
    .join("");
  const dashboardSurface = `
      <section class="product dashboard-panel" aria-label="Preview do produto">
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
      </section>`;

  const productSurface = isDashboard
    ? dashboardSurface
    : `
      <section class="product media-card" aria-label="Preview do site">
        <img src="${media.secondary}" alt="${escapeHtml(media.secondaryAlt)}" referrerpolicy="no-referrer" />
        <div class="media-overlay">
          <p>${escapeHtml(profile.kicker)}</p>
          <h2>${escapeHtml(profile.cardTitle)}</h2>
        </div>
        <div class="floating-proof">
          <strong>${escapeHtml(profile.proofPoints[0] ?? "Atendimento")}</strong>
          <span>${escapeHtml(profile.testimonial)}</span>
        </div>
      </section>`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <base href="about:srcdoc" />
  <title>${escapedName}</title>
  <style>
    * { box-sizing: border-box; }
    :root {
      --bg: ${theme.background};
      --surface: ${theme.surface};
      --surface-strong: ${theme.surfaceStrong};
      --text: ${theme.text};
      --muted: ${theme.muted};
      --line: ${theme.line};
      --header: ${theme.header};
      --accent: ${input.palette.primary};
      --accent-soft: ${theme.accentSoft};
      --shadow: ${theme.shadow};
    }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        linear-gradient(180deg, rgba(255,255,255,.08), transparent 34%),
        var(--bg);
      color: var(--text);
    }
    .page {
      min-height: 100vh;
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 22px 0 32px;
    }
    header, footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    header {
      position: sticky;
      top: 12px;
      z-index: 5;
      min-height: 62px;
      padding: 12px 14px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--header);
      backdrop-filter: blur(16px);
      box-shadow: 0 12px 36px rgba(0, 0, 0, .08);
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-weight: 900;
      letter-spacing: 0;
      color: var(--text);
    }
    .brand::before {
      content: "";
      width: 12px;
      height: 12px;
      border-radius: 3px;
      background: var(--accent);
      box-shadow: 0 0 22px color-mix(in srgb, var(--accent) 48%, transparent);
    }
    nav {
      display: flex;
      gap: 18px;
      font-size: 13px;
      font-weight: 700;
    }
    nav a {
      color: var(--muted);
      text-decoration: none;
    }
    .nav-cta {
      color: #080808;
      background: var(--accent);
      border-radius: 999px;
      padding: 9px 13px;
      font-size: 12px;
      font-weight: 900;
      text-decoration: none;
    }
    .hero {
      display: grid;
      grid-template-columns: minmax(0, .92fr) minmax(340px, 1.08fr);
      align-items: center;
      gap: 48px;
      min-height: calc(100vh - 120px);
      padding: 42px 0 34px;
    }
    h1 {
      margin: 0;
      max-width: 820px;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 70px;
      line-height: .96;
      letter-spacing: 0;
      font-weight: 700;
    }
    h1::selection, p::selection, strong::selection, span::selection {
      background: var(--accent);
      color: #050505;
    }
    .proof {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 18px;
    }
    .proof span {
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--surface);
      padding: 9px 12px;
      color: var(--text);
      font-size: 12px;
      font-weight: 800;
    }
    .lead {
      max-width: 620px;
      color: var(--muted);
      font-size: 19px;
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
      border-radius: 8px;
      padding: 14px 18px;
      font-weight: 900;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 46px;
    }
    .primary {
      background: var(--accent);
      color: #080808;
      box-shadow: 0 18px 54px color-mix(in srgb, var(--accent) 26%, transparent);
    }
    .secondary {
      border: 1px solid var(--line);
      color: var(--text);
      background: var(--surface);
    }
    .product {
      border: 1px solid var(--line);
      background: var(--surface-strong);
      border-radius: 8px;
      padding: 24px;
      box-shadow: var(--shadow);
      min-height: 420px;
    }
    .media-card {
      position: relative;
      overflow: hidden;
      padding: 0;
      min-height: 570px;
      isolation: isolate;
    }
    .media-card img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      filter: saturate(1.05) contrast(1.04);
      z-index: -2;
    }
    .media-card::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, transparent 18%, rgba(0,0,0,.76));
      z-index: -1;
    }
    .media-overlay {
      position: absolute;
      inset-inline: 22px;
      bottom: 22px;
    }
    .media-overlay p {
      color: var(--accent);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0;
      text-transform: uppercase;
      margin: 0 0 10px;
    }
    .media-overlay h2 {
      margin: 0;
      max-width: 520px;
      color: #fffdf5;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 45px;
      line-height: 1;
      letter-spacing: 0;
    }
    .floating-proof {
      position: absolute;
      top: 18px;
      right: 18px;
      width: min(260px, calc(100% - 36px));
      display: grid;
      gap: 6px;
      border: 1px solid rgba(255,255,255,.18);
      border-radius: 8px;
      background: rgba(0, 0, 0, .44);
      color: #fffdf5;
      padding: 14px;
      backdrop-filter: blur(12px);
    }
    .floating-proof strong {
      font-size: 13px;
    }
    .floating-proof span {
      color: rgba(255,255,255,.78);
      font-size: 12px;
      line-height: 1.45;
    }
    .toolbar, .metrics {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .toolbar span, .metrics div, .feature, .timeline p, .edit-log {
      border: 1px solid var(--line);
      background: var(--surface);
      border-radius: 8px;
      padding: 14px;
    }
    .metrics { margin: 18px 0; }
    .metrics strong {
      display: block;
      font-size: 30px;
      letter-spacing: 0;
    }
    .metrics span, .timeline span {
      color: var(--muted);
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
    .features {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin: 10px 0 64px;
    }
    .feature span {
      color: var(--accent);
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
      color: var(--muted);
      line-height: 1.5;
      font-size: 13px;
    }
    .edit-log {
      margin-top: 16px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.5;
    }
    .edit-log strong {
      color: var(--text);
    }
    .story {
      display: grid;
      grid-template-columns: minmax(0, .85fr) minmax(0, 1fr);
      gap: 22px;
      align-items: stretch;
      border-top: 1px solid var(--line);
      padding-top: 34px;
    }
    .story img {
      width: 100%;
      min-height: 360px;
      height: 100%;
      object-fit: cover;
      border-radius: 8px;
      border: 1px solid var(--line);
      box-shadow: var(--shadow);
    }
    .story-panel {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 34px;
      background: var(--surface);
    }
    .story-panel h2 {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 44px;
      line-height: 1;
      letter-spacing: 0;
    }
    .story-panel p {
      color: var(--muted);
      line-height: 1.7;
      font-size: 16px;
    }
    .contact-card {
      margin-top: 18px;
      display: grid;
      gap: 10px;
    }
    .contact-card span {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 13px 14px;
      color: var(--text);
      background: var(--surface-strong);
      font-weight: 800;
    }
    .credit {
      color: var(--muted);
      font-size: 11px;
      margin-top: 12px;
    }
    footer {
      margin-top: 30px;
      color: var(--muted);
      font-size: 13px;
    }
    @media (max-width: 1080px) {
      h1 { font-size: 56px; }
      .media-overlay h2 { font-size: 38px; }
    }
    @media (max-width: 860px) {
      .hero { grid-template-columns: 1fr; }
      .features { grid-template-columns: 1fr; }
      .story { grid-template-columns: 1fr; }
      nav { display: none; }
      .toolbar, .metrics { grid-template-columns: 1fr; }
      .timeline p { flex-direction: column; }
      h1 { font-size: 42px; }
      .hero { min-height: auto; padding-top: 26px; }
      .media-card { min-height: 430px; }
      .story-panel h2 { font-size: 34px; }
    }
  </style>
</head>
<body>
  <main class="page">
    <header>
      <div class="brand">${escapedName}</div>
      <nav>${navItems}</nav>
      ${contact.primary ? `<a class="nav-cta" href="${contact.primaryHref}">${contact.primary}</a>` : ""}
    </header>
    <section class="hero">
      <div>
        <h1>${isDashboard ? "Operacao pronta para escalar" : escapeHtml(profile.headline)}</h1>
        <p class="lead">${description}</p>
        <div class="actions">
          <a class="primary" href="${contact.primaryHref}">${contact.primary || "Comecar agora"}</a>
          <a class="secondary" href="#servicos">Ver servicos</a>
        </div>
        <div class="proof">
          ${profile.proofPoints.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
        </div>
        ${
          editNotes
            ? `<div class="edit-log"><strong>Edicao aplicada:</strong><ul>${editNotes}</ul></div>`
            : ""
        }
      </div>
      ${productSurface}
    </section>
    <section id="servicos" class="features">${featureCards}</section>
    <section id="contato" class="story">
      <img src="${media.tertiary}" alt="${escapeHtml(media.tertiaryAlt)}" referrerpolicy="no-referrer" />
      <div class="story-panel">
        <h2>${escapeHtml(profile.storyTitle)}</h2>
        <p>${escapeHtml(profile.storyText)}</p>
        <div class="contact-card">${contactRows}</div>
        <p class="credit">Imagens gratuitas via Unsplash. ${escapeHtml(media.credit)}</p>
      </div>
    </section>
    <footer><span>Gerado pela IA ZS</span><span>${promptSummary}</span></footer>
  </main>
</body>
</html>`;
}

function normalizeBrief(brief: ProjectBrief): ProjectBrief {
  return {
    companyName: brief.companyName.trim() || "Nova Empresa",
    phoneWhatsapp: brief.phoneWhatsapp?.trim(),
    email: brief.email?.trim(),
    niche: brief.niche.trim() || "negocios digitais",
    primaryColor: normalizeColor(brief.primaryColor) ?? "#7cff6b",
  };
}

function buildContact(brief?: ProjectBrief) {
  const phone = brief?.phoneWhatsapp?.trim();
  const digits = phone?.replace(/\D/g, "") ?? "";
  const hasWhatsapp = digits.length >= 10;
  const email = brief?.email?.trim();

  return {
    primary: hasWhatsapp ? "Agendar pelo WhatsApp" : email ? "Enviar email" : "Ver servicos",
    primaryHref: hasWhatsapp || email ? "#contato" : "#servicos",
    whatsapp: phone ? `WhatsApp: ${phone}` : "",
    whatsappHref: "#contato",
    email: email ?? "",
  };
}

function getNicheMedia(industry: string) {
  const normalized = normalize(industry);
  const images = {
    padarias: {
      hero: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1800&q=82",
      secondary: "https://images.unsplash.com/photo-1517433367423-c7e5b0f35086?auto=format&fit=crop&w=1200&q=82",
      tertiary: "https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=1200&q=82",
      secondaryAlt: "Paes artesanais em vitrine de padaria",
      tertiaryAlt: "Balcao de padaria com produtos frescos",
      credit: "Bakery photos from Unsplash.",
    },
    "clinicas odontologicas": {
      hero: "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?auto=format&fit=crop&w=1800&q=82",
      secondary: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1200&q=82",
      tertiary: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=1200&q=82",
      secondaryAlt: "Consultorio odontologico moderno",
      tertiaryAlt: "Atendimento odontologico profissional",
      credit: "Dental clinic photos from Unsplash.",
    },
    "oficinas mecanicas": {
      hero: "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=1800&q=82",
      secondary: "https://images.unsplash.com/photo-1625047509248-ec889cbff17f?auto=format&fit=crop&w=1200&q=82",
      tertiary: "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=1200&q=82",
      secondaryAlt: "Mecanico trabalhando em manutencao automotiva",
      tertiaryAlt: "Carro em oficina mecanica",
      credit: "Auto repair photos from Unsplash.",
    },
    "lojas de roupas": {
      hero: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1800&q=82",
      secondary: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=82",
      tertiary: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=82",
      secondaryAlt: "Araras de roupas em loja de moda",
      tertiaryAlt: "Editorial de moda para loja de roupas",
      credit: "Fashion retail photos from Unsplash.",
    },
    barbearias: {
      hero: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1800&q=82",
      secondary: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=82",
      tertiary: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1200&q=82",
      secondaryAlt: "Cadeira e ferramentas de barbearia",
      tertiaryAlt: "Atendimento em barbearia moderna",
      credit: "Barber shop photos from Unsplash.",
    },
    restaurantes: {
      hero: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1800&q=82",
      secondary: "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=82",
      tertiary: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=82",
      secondaryAlt: "Sala de restaurante com mesas preparadas",
      tertiaryAlt: "Prato servido em restaurante",
      credit: "Restaurant photos from Unsplash.",
    },
    academias: {
      hero: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1800&q=82",
      secondary: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=82",
      tertiary: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=82",
      secondaryAlt: "Pessoa treinando em academia",
      tertiaryAlt: "Equipamentos de musculacao",
      credit: "Fitness photos from Unsplash.",
    },
    clinicas: {
      hero: "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=1800&q=82",
      secondary: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1200&q=82",
      tertiary: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1200&q=82",
      secondaryAlt: "Atendimento medico em clinica",
      tertiaryAlt: "Ambiente clinico organizado",
      credit: "Clinic photos from Unsplash.",
    },
    "lojas online": {
      hero: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1800&q=82",
      secondary: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=82",
      tertiary: "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?auto=format&fit=crop&w=1200&q=82",
      secondaryAlt: "Produto em loja online",
      tertiaryAlt: "Compra online em andamento",
      credit: "Commerce photos from Unsplash.",
    },
    default: {
      hero: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1800&q=82",
      secondary: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=82",
      tertiary: "https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=1200&q=82",
      secondaryAlt: "Equipe trabalhando em projeto digital",
      tertiaryAlt: "Ambiente de trabalho moderno",
      credit: "Business photos from Unsplash.",
    },
  } satisfies Record<string, {
    hero: string;
    secondary: string;
    tertiary: string;
    secondaryAlt: string;
    tertiaryAlt: string;
    credit: string;
  }>;

  if (normalized.includes("padaria")) return images.padarias;
  if (normalized.includes("odont")) return images["clinicas odontologicas"];
  if (normalized.includes("oficina") || normalized.includes("mecanica")) return images["oficinas mecanicas"];
  if (normalized.includes("roupa") || normalized.includes("moda")) return images["lojas de roupas"];
  if (normalized.includes("barbearia")) return images.barbearias;
  if (normalized.includes("restaurante")) return images.restaurantes;
  if (normalized.includes("academia")) return images.academias;
  if (normalized.includes("clinica")) return images.clinicas;
  if (normalized.includes("loja")) return images["lojas online"];

  return images.default;
}

function getNicheProfile(industry: string, name: string) {
  const normalized = normalize(industry);
  const safeName = titleCase(name);

  const darkTheme = {
    mode: "dark",
    background: "#0b0d0c",
    surface: "rgba(16, 18, 16, .88)",
    surfaceStrong: "#151814",
    text: "#fffdf5",
    muted: "#c9c1ae",
    line: "rgba(255, 255, 255, .14)",
    header: "rgba(9, 10, 9, .74)",
    accentSoft: "rgba(255, 255, 255, .08)",
    shadow: "0 28px 80px rgba(0, 0, 0, .34)",
  };

  const warmTheme = {
    mode: "light",
    background: "#fbf4e8",
    surface: "rgba(255, 252, 246, .9)",
    surfaceStrong: "#ffffff",
    text: "#28180d",
    muted: "#6f5b45",
    line: "rgba(80, 48, 22, .16)",
    header: "rgba(255, 252, 246, .82)",
    accentSoft: "#fff0d3",
    shadow: "0 24px 70px rgba(99, 58, 19, .18)",
  };

  const cleanTheme = {
    mode: "light",
    background: "#eef8fb",
    surface: "rgba(255, 255, 255, .9)",
    surfaceStrong: "#ffffff",
    text: "#10262d",
    muted: "#557078",
    line: "rgba(16, 38, 45, .13)",
    header: "rgba(255, 255, 255, .82)",
    accentSoft: "#dff8fb",
    shadow: "0 24px 70px rgba(20, 83, 95, .14)",
  };

  const fashionTheme = {
    mode: "light",
    background: "#f5f2ee",
    surface: "rgba(255, 255, 255, .9)",
    surfaceStrong: "#ffffff",
    text: "#1f1d1a",
    muted: "#665f57",
    line: "rgba(31, 29, 26, .14)",
    header: "rgba(255, 255, 255, .82)",
    accentSoft: "#f0e2d7",
    shadow: "0 24px 70px rgba(55, 45, 35, .14)",
  };

  const garageTheme = {
    mode: "dark",
    background: "#101315",
    surface: "rgba(22, 25, 27, .9)",
    surfaceStrong: "#1b2023",
    text: "#fffaf0",
    muted: "#c1b9aa",
    line: "rgba(255, 255, 255, .13)",
    header: "rgba(14, 16, 18, .78)",
    accentSoft: "rgba(255, 199, 104, .12)",
    shadow: "0 28px 80px rgba(0, 0, 0, .38)",
  };

  if (normalized.includes("padaria")) {
    return {
      kicker: "fornada artesanal",
      headline: `${safeName}: paes frescos, cafe e encomendas todos os dias`,
      cardTitle: "Cheiro de pao quente, vitrine clara e pedido rapido",
      storyTitle: "Uma vitrine digital que abre o apetite",
      storyText:
        "O layout valoriza foto real de produtos, horarios, encomendas e chamada de contato. A pagina fica com cara de padaria local forte, nao de template vazio.",
      description:
        "Mostre paes, doces, lanches e encomendas com uma pagina acolhedora, visual e pronta para transformar visitantes em pedidos.",
      proofPoints: ["Fornada do dia", "Encomendas", "Cafe e lanches", "Contato rapido"],
      navItems: ["Produtos", "Encomendas", "Contato"],
      testimonial: "Clientes encontram a fornada, escolhem o pedido e chamam sem sair do preview.",
      theme: warmTheme,
    };
  }

  if (normalized.includes("odont")) {
    return {
      kicker: "odontologia de confianca",
      headline: `${safeName}: sorrisos cuidados com agenda simples`,
      cardTitle: "Clinica limpa, equipe visivel e chamada clara para consulta",
      storyTitle: "Credibilidade antes do agendamento",
      storyText:
        "O site prioriza ambiente clinico, tratamentos, diferenciais e contato. A pessoa entende a especialidade e sabe exatamente como marcar uma avaliacao.",
      description:
        "Apresente tratamentos, estrutura, equipe e agendamento com visual limpo, confiavel e adaptado para clinicas odontologicas.",
      proofPoints: ["Avaliacao", "Tratamentos", "Equipe", "Agenda"],
      navItems: ["Tratamentos", "Equipe", "Contato"],
      testimonial: "O primeiro clique ja mostra cuidado, organizacao e caminho direto para consulta.",
      theme: cleanTheme,
    };
  }

  if (normalized.includes("oficina") || normalized.includes("mecanica")) {
    return {
      kicker: "oficina mecanica",
      headline: `${safeName}: manutencao automotiva com diagnostico claro`,
      cardTitle: "Servico tecnico, prazos combinados e confianca visual",
      storyTitle: "O cliente entende o servico antes de chegar",
      storyText:
        "A pagina destaca revisao, diagnostico, freios, suspensao e contato. O visual passa precisao e evita o aspecto generico de anuncio simples.",
      description:
        "Crie uma presenca forte para revisoes, manutencao e orcamentos com imagem real, prova de confianca e CTA objetivo.",
      proofPoints: ["Diagnostico", "Revisao", "Orcamento", "Garantia"],
      navItems: ["Servicos", "Diagnostico", "Contato"],
      testimonial: "A oficina parece tecnica, organizada e pronta para receber pedidos de orcamento.",
      theme: garageTheme,
    };
  }

  if (normalized.includes("roupa") || normalized.includes("moda")) {
    return {
      kicker: "moda e estilo",
      headline: `${safeName}: colecoes, looks e compra com identidade`,
      cardTitle: "Editorial forte, produtos em destaque e marca memoravel",
      storyTitle: "Um site que vende estilo, nao so produtos",
      storyText:
        "A estrutura aproxima vitrine, colecao, prova social e contato. O resultado fica mais parecido com uma loja de moda real do que uma lista comum de cards.",
      description:
        "Mostre colecoes, pecas em destaque e diferenciais com visual editorial, fotos de moda e CTA para compra ou atendimento.",
      proofPoints: ["Colecoes", "Looks", "Vitrine", "Atendimento"],
      navItems: ["Colecao", "Looks", "Contato"],
      testimonial: "A marca ganha uma primeira dobra editorial com imagem grande e produtos claros.",
      theme: fashionTheme,
    };
  }

  if (normalized.includes("barbearia")) {
    return {
      kicker: "barbearia premium",
      headline: `${safeName}: corte, barba e agenda sem atrito`,
      cardTitle: "Ambiente masculino, atendimento pontual e acabamento de respeito",
      storyTitle: "Um site feito para lotar a agenda",
      storyText:
        "A estrutura prioriza fotos reais, servicos claros, prova social e chamada direta para WhatsApp. O cliente entende o estilo da barbearia antes mesmo de mandar mensagem.",
      description:
        "Apresente cortes, barba, horarios e diferenciais com visual premium, imagem forte e botao direto para agendamento.",
      proofPoints: ["Agenda rapida", "Servicos claros", "Prova social", "WhatsApp em destaque"],
      navItems: ["Servicos", "Agenda", "Contato"],
      testimonial: "A primeira tela mostra estilo, confianca e caminho direto para reservar horario.",
      theme: darkTheme,
    };
  }

  if (normalized.includes("restaurante")) {
    return {
      kicker: "restaurante",
      headline: `${safeName}: pratos marcantes, reserva facil e sabor de casa`,
      cardTitle: "Atmosfera, cardapio e reserva em uma experiencia direta",
      storyTitle: "Cardapio e reserva no mesmo fluxo",
      storyText:
        "O site mostra ambiente, pratos, horarios e contato sem esconder a acao principal: reservar mesa ou chamar no WhatsApp.",
      description:
        "Mostre pratos, ambiente e reservas com uma pagina visual, rapida e feita para converter visitantes em clientes.",
      proofPoints: ["Reservas", "Cardapio visual", "Ambiente", "Contato facil"],
      navItems: ["Cardapio", "Reservas", "Contato"],
      testimonial: "O visitante sente o clima do restaurante antes de escolher como reservar.",
      theme: warmTheme,
    };
  }

  if (normalized.includes("academia")) {
    return {
      kicker: "fitness",
      headline: `${safeName}: treino, planos e matricula em minutos`,
      cardTitle: "Energia, resultado e matricula sem formulario pesado",
      storyTitle: "Planos claros para novos alunos",
      storyText:
        "A pagina conecta imagens de treino, beneficios, horarios e CTA de matricula, ajudando o visitante a decidir rapido.",
      description:
        "Crie uma presenca forte para planos, aulas, horarios e captacao de alunos com visual esportivo.",
      proofPoints: ["Planos", "Aulas", "Resultados", "Matricula rapida"],
      navItems: ["Planos", "Aulas", "Contato"],
      testimonial: "O preview combina energia, planos e conversao sem formulario pesado.",
      theme: darkTheme,
    };
  }

  return {
    kicker: "site profissional",
    headline: `${safeName}: presenca digital pronta para converter`,
    cardTitle: "Imagem, mensagem e contato em uma pagina objetiva",
    storyTitle: "Do primeiro clique ao contato",
    storyText:
      "A pagina combina imagem real, proposta de valor, servicos e chamada de contato para transformar visitantes em oportunidades.",
    description:
      "Site profissional com imagem real do nicho, secoes objetivas, prova social e chamada de contato clara.",
    proofPoints: ["Imagem real", "Copy objetiva", "Servicos", "Contato facil"],
    navItems: ["Servicos", "Resultados", "Contato"],
    testimonial: "A primeira versao ja nasce com imagem, proposta e caminho claro para contato.",
    theme: fashionTheme,
  };
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
