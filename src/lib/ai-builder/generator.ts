import { buildAugmentedPrompt, getReusableTemplateFiles } from "./context";

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
  const projectName = titleCase(cleanBrief.companyName);
  const augmentedPrompt = `${prompt}\n\nContexto IA:\n${buildAugmentedPrompt({
    message: prompt,
    industry,
    projectName,
    brief: cleanBrief,
  })}`;
  const summary = `${cleanBrief.companyName} e um site profissional para ${industry}, com imagem real do nicho, CTA de contato, prova social, servicos e uma primeira estrutura pronta para publicar.`;

  return {
    id: createId(prompt),
    name: projectName,
    kind: "site",
    summary,
    prompt: augmentedPrompt,
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
    files: buildFiles(cleanBrief.companyName, "site", features, augmentedPrompt, cleanBrief),
    previewHtml: buildPreviewHtml({
      prompt: augmentedPrompt,
      name: projectName,
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
  const augmentedPrompt = `${cleanPrompt}\n\nContexto IA:\n${buildAugmentedPrompt({
    message: cleanPrompt,
    industry,
    projectName: name,
  })}`;
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
    prompt: augmentedPrompt,
    industry,
    paletteName: palette.name,
    steps,
    features,
    files: buildFiles(name, kind, features, augmentedPrompt),
    previewHtml: buildPreviewHtml({
      prompt: augmentedPrompt,
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
    "imagem",
    "foto",
    "banner",
    "descricao",
    "po de queijo",
    "pao de queijo",
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
    if (match && !isStyleOnlyTitleValue(match)) return titleCase(cleanName(match));
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
  if (industry === "padarias") {
    base.push("Catalogo de produtos", "Combo promocional", "Depoimentos", "Contato com mapa");
  }
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

  const files: BuilderFile[] = buildGeneratedNextFiles(name, kind, features, prompt, brief);

  files.push(...getReusableTemplateFiles(slug));

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

function buildGeneratedNextFiles(
  name: string,
  kind: BuilderProject["kind"],
  features: string[],
  prompt: string,
  brief?: ProjectBrief,
): BuilderFile[] {
  const slug = slugify(name);
  const component = componentName(name);

  return [
    {
      path: "src/app/page.tsx",
      language: "tsx",
      description: "Página inicial Next.js que renderiza o site gerado.",
      content: `import { ${component} } from "@/components/generated/${slug}";

export default function Page() {
  return <${component} />;
}
`,
    },
    {
      path: `src/components/generated/${slug}/index.tsx`,
      language: "tsx",
      description: "Composição principal do site com estado editável simples.",
      content: buildGeneratedSiteIndexSource(slug, component),
    },
    {
      path: `src/components/generated/${slug}/Header.tsx`,
      language: "tsx",
      description: "Cabeçalho fixo com menu, marca e botão real de WhatsApp.",
      content: buildGeneratedHeaderSource(slug),
    },
    {
      path: `src/components/generated/${slug}/Hero.tsx`,
      language: "tsx",
      description: "Hero responsivo com título, subtítulo, imagem e CTAs únicos.",
      content: buildGeneratedHeroSource(slug),
    },
    {
      path: `src/components/generated/${slug}/Features.tsx`,
      language: "tsx",
      description: "Seções de sobre, diferenciais, produtos, destaque e depoimentos.",
      content: buildGeneratedFeaturesSource(slug),
    },
    {
      path: `src/components/generated/${slug}/ContactSection.tsx`,
      language: "tsx",
      description: "Contato responsivo com WhatsApp, e-mail, endereço, horário e mapa.",
      content: buildGeneratedContactSectionSource(slug),
    },
    {
      path: `src/components/generated/${slug}/Footer.tsx`,
      language: "tsx",
      description: "Rodapé com links rápidos, redes sociais e copyright.",
      content: buildGeneratedFooterSource(slug),
    },
    {
      path: `src/components/generated/${slug}/SiteEditor.tsx`,
      language: "tsx",
      description: "Editor visual simples para textos, cores, contato e imagens.",
      content: buildGeneratedSiteEditorSource(slug),
    },
    {
      path: `src/lib/generated/${slug}-config.ts`,
      language: "ts",
      description: "Configuração editável do site com textos, cores, imagens, contato e produtos.",
      content: buildGeneratedConfigSource(name, kind, features, prompt, brief),
    },
  ];
}

function buildGeneratedSiteIndexSource(slug: string, component: string) {
  return `"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { generatedSiteConfig, type GeneratedSiteConfig } from "@/lib/generated/${slug}-config";
import { ContactSection } from "./ContactSection";
import { Features } from "./Features";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { Hero } from "./Hero";
import { SiteEditor } from "./SiteEditor";

export function ${component}() {
  const [site, setSite] = useState<GeneratedSiteConfig>(generatedSiteConfig);

  const whatsappHref = useMemo(() => {
    const digits = site.contact.whatsapp.replace(/\\D/g, "");

    if (digits.length < 10) {
      return "#contato";
    }

    return "https://wa.me/" + digits + "?text=" + encodeURIComponent(site.whatsappMessage);
  }, [site.contact.whatsapp, site.whatsappMessage]);

  function updateSite<Key extends keyof GeneratedSiteConfig>(
    key: Key,
    value: GeneratedSiteConfig[Key],
  ) {
    setSite((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <main
      className="min-h-screen bg-[var(--site-bg)] text-[var(--site-text)]"
      style={
        {
          "--site-bg": site.theme.background,
          "--site-card": site.theme.card,
          "--site-primary": site.theme.primary,
          "--site-secondary": site.theme.secondary,
          "--site-text": site.theme.text,
          "--site-muted": site.theme.muted,
        } as CSSProperties
      }
    >
      <Header site={site} whatsappHref={whatsappHref} />
      <Hero site={site} whatsappHref={whatsappHref} />
      <Features site={site} whatsappHref={whatsappHref} />
      <ContactSection site={site} whatsappHref={whatsappHref} />
      <Footer site={site} />
      <SiteEditor site={site} onUpdate={updateSite} />
    </main>
  );
}
`;
}

function buildGeneratedHeaderSource(slug: string) {
  return `import type { GeneratedSiteConfig } from "@/lib/generated/${slug}-config";

type HeaderProps = {
  site: GeneratedSiteConfig;
  whatsappHref: string;
};

export function Header({ site, whatsappHref }: HeaderProps) {
  const isExternalWhatsapp = whatsappHref.startsWith("https://");

  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <a className="text-base font-black tracking-tight text-zinc-950 sm:text-lg" href="#inicio">
          {site.name}
        </a>
        <nav className="hidden items-center gap-5 text-sm font-semibold text-zinc-700 lg:flex">
          {site.navigation.map((item) => (
            <a className="transition hover:text-zinc-950" href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <a
          className="rounded-full bg-[var(--site-primary)] px-4 py-2 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
          href={whatsappHref}
          rel={isExternalWhatsapp ? "noreferrer" : undefined}
          target={isExternalWhatsapp ? "_blank" : undefined}
        >
          Fazer pedido
        </a>
      </div>
    </header>
  );
}
`;
}

function buildGeneratedHeroSource(slug: string) {
  return `import type { GeneratedSiteConfig } from "@/lib/generated/${slug}-config";

type HeroProps = {
  site: GeneratedSiteConfig;
  whatsappHref: string;
};

export function Hero({ site, whatsappHref }: HeroProps) {
  const isExternalWhatsapp = whatsappHref.startsWith("https://");

  return (
    <section className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8" id="inicio">
      <div>
        <p className="text-sm font-black uppercase tracking-[0.18em] text-[var(--site-primary)]">
          {site.hero.eyebrow}
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight tracking-tight text-zinc-950 sm:text-6xl">
          {site.hero.title}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--site-muted)]">
          {site.hero.subtitle}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            className="inline-flex items-center justify-center rounded-full bg-[var(--site-primary)] px-6 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            href={whatsappHref}
            rel={isExternalWhatsapp ? "noreferrer" : undefined}
            target={isExternalWhatsapp ? "_blank" : undefined}
          >
            {site.hero.primaryCta}
          </a>
          <a
            className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-6 py-3 text-sm font-black text-zinc-950 transition hover:border-zinc-950"
            href="#produtos"
          >
            {site.hero.secondaryCta}
          </a>
        </div>
      </div>
      <div className="relative overflow-hidden rounded-[2rem] bg-zinc-200 shadow-2xl shadow-black/10">
        <img
          alt={site.images.heroAlt}
          className="h-[360px] w-full object-cover sm:h-[500px]"
          src={site.images.hero}
        />
        <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-white/90 p-4 shadow-lg backdrop-blur">
          <p className="text-sm font-black text-zinc-950">{site.hero.cardTitle}</p>
          <p className="mt-1 text-sm text-zinc-600">{site.hero.cardText}</p>
        </div>
      </div>
    </section>
  );
}
`;
}

function buildGeneratedFeaturesSource(slug: string) {
  return `import type { GeneratedSiteConfig } from "@/lib/generated/${slug}-config";

type FeaturesProps = {
  site: GeneratedSiteConfig;
  whatsappHref: string;
};

export function Features({ site, whatsappHref }: FeaturesProps) {
  const isExternalWhatsapp = whatsappHref.startsWith("https://");

  return (
    <>
      <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8" id="sobre">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[var(--site-primary)]">Sobre</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-zinc-950 sm:text-5xl">
              {site.about.title}
            </h2>
            <p className="mt-4 text-base leading-8 text-[var(--site-muted)]">{site.about.text}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {site.differentials.map((item) => (
              <article className="rounded-2xl bg-[var(--site-card)] p-5 shadow-sm ring-1 ring-black/5" key={item.title}>
                <h3 className="text-lg font-black text-zinc-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--site-muted)]">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8" id="produtos">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[var(--site-primary)]">Produtos</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-zinc-950 sm:text-5xl">
              {site.productsTitle}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {site.categories.map((category) => (
              <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-black text-zinc-700" key={category}>
                {category}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {site.products.map((product) => (
            <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5" key={product.name}>
              <img alt={product.imageAlt} className="h-48 w-full object-cover" src={product.image} />
              <div className="p-5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--site-primary)]">{product.category}</p>
                <h3 className="mt-2 text-xl font-black text-zinc-950">{product.name}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--site-muted)]">{product.description}</p>
                <p className="mt-4 text-lg font-black text-zinc-950">{product.price}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8" id="cardapio">
        <div className="grid overflow-hidden rounded-[2rem] bg-[var(--site-secondary)] text-white lg:grid-cols-[1fr_0.8fr]">
          <div className="p-8 sm:p-12">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-white/70">Destaque</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">{site.promo.title}</h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-white/80">{site.promo.text}</p>
            <a
              className="mt-8 inline-flex rounded-full bg-white px-6 py-3 text-sm font-black text-zinc-950 transition hover:-translate-y-0.5"
              href={whatsappHref}
              rel={isExternalWhatsapp ? "noreferrer" : undefined}
              target={isExternalWhatsapp ? "_blank" : undefined}
            >
              {site.promo.cta}
            </a>
          </div>
          <img alt={site.images.promoAlt} className="h-full min-h-[320px] w-full object-cover" src={site.images.promo} />
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8" id="depoimentos">
        <p className="text-sm font-black uppercase tracking-[0.18em] text-[var(--site-primary)]">Depoimentos</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-zinc-950 sm:text-5xl">
          Clientes satisfeitos
        </h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {site.testimonials.map((testimonial) => (
            <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5" key={testimonial.name}>
              <p className="text-sm font-black text-[var(--site-primary)]">{testimonial.rating}</p>
              <p className="mt-4 text-sm leading-7 text-[var(--site-muted)]">“{testimonial.comment}”</p>
              <h3 className="mt-5 font-black text-zinc-950">{testimonial.name}</h3>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
`;
}

function buildGeneratedContactSectionSource(slug: string) {
  return `import type { GeneratedSiteConfig } from "@/lib/generated/${slug}-config";

type ContactSectionProps = {
  site: GeneratedSiteConfig;
  whatsappHref: string;
};

export function ContactSection({ site, whatsappHref }: ContactSectionProps) {
  const isExternalWhatsapp = whatsappHref.startsWith("https://");

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8" id="contato">
      <div className="grid gap-8 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[var(--site-primary)]">Contato</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-zinc-950 sm:text-5xl">
            Peça pelo WhatsApp ou visite a loja
          </h2>
          <div className="mt-6 grid gap-3 text-sm text-zinc-700">
            <p><strong>WhatsApp:</strong> {site.contact.whatsapp}</p>
            <p><strong>E-mail:</strong> {site.contact.email}</p>
            <p><strong>Endereço:</strong> {site.contact.address}</p>
            <p><strong>Horário:</strong> {site.contact.hours}</p>
          </div>
          <a
            className="mt-8 inline-flex rounded-full bg-[var(--site-primary)] px-6 py-3 text-sm font-black text-white transition hover:-translate-y-0.5"
            href={whatsappHref}
            rel={isExternalWhatsapp ? "noreferrer" : undefined}
            target={isExternalWhatsapp ? "_blank" : undefined}
          >
            Chamar no WhatsApp
          </a>
        </div>
        <div className="grid min-h-[320px] place-items-center overflow-hidden rounded-2xl bg-zinc-100 text-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-zinc-500">Mapa</p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-600">
              Espaço pronto para incorporar Google Maps ou outro mapa do endereço.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
`;
}

function buildGeneratedFooterSource(slug: string) {
  return `import type { GeneratedSiteConfig } from "@/lib/generated/${slug}-config";

export function Footer({ site }: { site: GeneratedSiteConfig }) {
  return (
    <footer className="border-t border-black/10 bg-zinc-950 px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col justify-between gap-8 md:flex-row md:items-center">
        <div>
          <p className="text-xl font-black">{site.name}</p>
          <p className="mt-2 text-sm text-white/60">{site.footerText}</p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm font-semibold text-white/70">
          {site.navigation.map((item) => (
            <a className="hover:text-white" href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </div>
        <div className="flex gap-3 text-sm font-semibold text-white/70">
          {site.social.map((item) => (
            <a className="hover:text-white" href={item.href} key={item.label}>
              {item.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
`;
}

function buildGeneratedSiteEditorSource(slug: string) {
  return `"use client";

import type { GeneratedSiteConfig } from "@/lib/generated/${slug}-config";

type SiteEditorProps = {
  site: GeneratedSiteConfig;
  onUpdate: <Key extends keyof GeneratedSiteConfig>(
    key: Key,
    value: GeneratedSiteConfig[Key],
  ) => void;
};

const inputClass =
  "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-zinc-950";

export function SiteEditor({ site, onUpdate }: SiteEditorProps) {
  function updateHero(field: keyof GeneratedSiteConfig["hero"], value: string) {
    onUpdate("hero", { ...site.hero, [field]: value });
  }

  function updateTheme(field: keyof GeneratedSiteConfig["theme"], value: string) {
    onUpdate("theme", { ...site.theme, [field]: value });
  }

  function updateImages(field: keyof GeneratedSiteConfig["images"], value: string) {
    onUpdate("images", { ...site.images, [field]: value });
  }

  function updateContact(field: keyof GeneratedSiteConfig["contact"], value: string) {
    onUpdate("contact", { ...site.contact, [field]: value });
  }

  return (
    <aside className="fixed bottom-4 right-4 z-50 max-h-[82vh] w-[min(380px,calc(100vw-2rem))] overflow-auto rounded-2xl border border-black/10 bg-white/95 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--site-primary)]">Editor</p>
          <h2 className="text-lg font-black text-zinc-950">Textos, cores e imagens</h2>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-500">ao vivo</span>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1 text-xs font-bold text-zinc-600">
          Título principal
          <input className={inputClass} onChange={(event) => updateHero("title", event.target.value)} value={site.hero.title} />
        </label>
        <label className="grid gap-1 text-xs font-bold text-zinc-600">
          Descrição principal
          <textarea className={inputClass} onChange={(event) => updateHero("subtitle", event.target.value)} rows={3} value={site.hero.subtitle} />
        </label>
        <label className="grid gap-1 text-xs font-bold text-zinc-600">
          Cor principal
          <input className={inputClass} onChange={(event) => updateTheme("primary", event.target.value)} type="color" value={site.theme.primary} />
        </label>
        <label className="grid gap-1 text-xs font-bold text-zinc-600">
          Imagem principal
          <input className={inputClass} onChange={(event) => updateImages("hero", event.target.value)} value={site.images.hero} />
        </label>
        <label className="grid gap-1 text-xs font-bold text-zinc-600">
          WhatsApp
          <input className={inputClass} onChange={(event) => updateContact("whatsapp", event.target.value)} value={site.contact.whatsapp} />
        </label>
        <label className="grid gap-1 text-xs font-bold text-zinc-600">
          E-mail
          <input className={inputClass} onChange={(event) => updateContact("email", event.target.value)} value={site.contact.email} />
        </label>
      </div>
    </aside>
  );
}
`;
}

function buildGeneratedConfigSource(
  name: string,
  kind: BuilderProject["kind"],
  features: string[],
  prompt: string,
  brief?: ProjectBrief,
) {
  const config = buildGeneratedConfig(name, kind, features, prompt, brief);

  return `export type GeneratedSiteConfig = {
  name: string;
  kind: "saas" | "site" | "landing" | "dashboard";
  niche: string;
  whatsappMessage: string;
  footerText: string;
  theme: {
    background: string;
    card: string;
    primary: string;
    secondary: string;
    text: string;
    muted: string;
  };
  navigation: Array<{ label: string; href: string }>;
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
    cardTitle: string;
    cardText: string;
  };
  about: {
    title: string;
    text: string;
  };
  images: {
    hero: string;
    heroAlt: string;
    promo: string;
    promoAlt: string;
  };
  differentials: Array<{ title: string; text: string }>;
  categories: string[];
  productsTitle: string;
  products: Array<{
    category: string;
    name: string;
    description: string;
    price: string;
    image: string;
    imageAlt: string;
  }>;
  promo: {
    title: string;
    text: string;
    cta: string;
  };
  testimonials: Array<{ name: string; rating: string; comment: string }>;
  contact: {
    whatsapp: string;
    email: string;
    address: string;
    hours: string;
  };
  social: Array<{ label: string; href: string }>;
};

export const generatedSiteConfig = ${JSON.stringify(config, null, 2)} satisfies GeneratedSiteConfig;
`;
}

function buildGeneratedConfig(
  name: string,
  kind: BuilderProject["kind"],
  features: string[],
  prompt: string,
  brief?: ProjectBrief,
) {
  const industry = detectIndustry(`${brief?.niche ?? ""} ${prompt}`);
  const isBakery = normalize(industry).includes("padaria");
  const media = getNicheMedia(industry);
  const palette = brief?.primaryColor ? buildPaletteFromColor(brief.primaryColor, prompt) : pickPalette(prompt);
  const siteName = titleCase(brief?.companyName ?? name);
  const phone = brief?.phoneWhatsapp?.trim() || "5511999990000";
  const email = brief?.email?.trim() || "contato@exemplo.com";
  const nicheLabel = brief?.niche?.trim() || industry;
  const differentials = isBakery
    ? [
        {
          title: "Pães frescos",
          text: "Fornadas ao longo do dia para entregar aroma, crocância e sabor de padaria de verdade.",
        },
        {
          title: "Produção artesanal",
          text: "Receitas preparadas com cuidado, fermentação correta e ingredientes selecionados.",
        },
        {
          title: "Entrega rápida",
          text: "Contato direto pelo WhatsApp para combinar retirada, entrega e pedidos especiais.",
        },
        {
          title: "Qualidade garantida",
          text: "Produtos organizados por categoria, com preço claro e padrão visual consistente.",
        },
      ]
    : unique(features.slice(0, 4)).map((feature) => ({
        title: feature,
        text: buildFeatureText(feature),
      }));

  while (differentials.length < 4) {
    differentials.push({
      title: ["Atendimento rápido", "Visual profissional", "Conteúdo editável", "Contato direto"][differentials.length],
      text: "Bloco reutilizável para manter o site claro, responsivo e pronto para evoluir.",
    });
  }

  return {
    name: siteName,
    kind,
    niche: nicheLabel,
    whatsappMessage: `Olá, vim pelo site da ${siteName} e quero fazer um pedido.`,
    footerText: `© ${new Date().getFullYear()} ${siteName}. Todos os direitos reservados.`,
    theme: {
      background: isBakery ? "#fff7ed" : palette.background,
      card: isBakery ? "#ffffff" : palette.surface,
      primary: palette.primary,
      secondary: isBakery ? "#7c3f18" : palette.secondary,
      text: isBakery ? "#28180d" : palette.text,
      muted: isBakery ? "#765b43" : palette.muted,
    },
    navigation: [
      { label: "Início", href: "#inicio" },
      { label: "Sobre", href: "#sobre" },
      { label: "Produtos", href: "#produtos" },
      { label: "Cardápio", href: "#cardapio" },
      { label: "Depoimentos", href: "#depoimentos" },
      { label: "Contato", href: "#contato" },
    ],
    hero: {
      eyebrow: isBakery ? "Padaria artesanal" : "Site profissional",
      title: isBakery
        ? `${siteName}: pães frescos e produção artesanal todos os dias`
        : `${siteName}: presença digital pronta para converter`,
      subtitle: isBakery
        ? "Monte pedidos pelo WhatsApp, veja produtos com preço e conheça os diferenciais da padaria em uma página moderna e responsiva."
        : "Site responsivo com proposta clara, imagens do nicho, prova social e contato direto para transformar visitas em oportunidades.",
      primaryCta: isBakery ? "Pedir pelo WhatsApp" : "Chamar no WhatsApp",
      secondaryCta: isBakery ? "Ver produtos" : "Ver serviços",
      cardTitle: isBakery ? "Forno aberto cedo" : "Primeira versão editável",
      cardText: isBakery
        ? "Pães, bolos, doces, salgados e bebidas organizados para pedido rápido."
        : "Textos, cores, contato e imagens podem ser ajustados no editor simples.",
    },
    about: {
      title: isBakery ? "Tradição, frescor e atendimento próximo" : "Uma estrutura clara para vender melhor",
      text: isBakery
        ? `${siteName} combina produção artesanal, ingredientes selecionados e atendimento direto para quem quer comprar pães, bolos, doces e salgados sem complicação.`
        : `${siteName} apresenta a empresa com uma experiência objetiva, responsiva e preparada para crescer com novas páginas, APIs e integrações.`,
    },
    images: {
      hero: media.hero,
      heroAlt: isBakery ? "Pães artesanais frescos em uma padaria" : media.secondaryAlt,
      promo: media.secondary,
      promoAlt: isBakery ? "Mesa com produtos de padaria e café" : media.tertiaryAlt,
    },
    differentials,
    categories: isBakery
      ? ["Pães", "Bolos", "Doces", "Salgados", "Bebidas"]
      : ["Serviços", "Planos", "Resultados", "Contato"],
    productsTitle: isBakery ? "Produtos mais pedidos" : "Serviços em destaque",
    products: isBakery ? buildBakeryGeneratedProducts(media) : buildGenericGeneratedProducts(industry, media),
    promo: {
      title: isBakery ? "Combo do café da manhã" : "Oferta principal pronta para conversão",
      text: isBakery
        ? "Um combo com pão francês, pão de queijo, bolo caseiro, doce do dia e café para pedir em poucos cliques."
        : "Bloco promocional para destacar o serviço mais importante e levar o visitante direto ao contato.",
      cta: isBakery ? "Pedir combo no WhatsApp" : "Conversar agora",
    },
    testimonials: [
      {
        name: "Marina Costa",
        rating: "★★★★★",
        comment: isBakery
          ? "Os pães chegam quentinhos e o atendimento pelo WhatsApp é muito rápido."
          : "A página ficou clara, bonita e facilitou o contato dos clientes.",
      },
      {
        name: "Rafael Lima",
        rating: "★★★★★",
        comment: isBakery
          ? "O combo do café da manhã virou pedido fixo aqui em casa."
          : "A estrutura ficou profissional e simples de atualizar.",
      },
      {
        name: "Camila Rocha",
        rating: "★★★★★",
        comment: isBakery
          ? "Gostei de ver produtos, preços e contato no mesmo lugar."
          : "O site passa confiança logo na primeira tela.",
      },
    ],
    contact: {
      whatsapp: phone,
      email,
      address: "Rua Exemplo, 123 - Centro",
      hours: isBakery ? "Segunda a sábado, das 6h às 20h" : "Segunda a sexta, das 9h às 18h",
    },
    social: [
      { label: "Instagram", href: "#" },
      { label: "Facebook", href: "#" },
      { label: "WhatsApp", href: "#contato" },
    ],
  };
}

function buildBakeryGeneratedProducts(media: ReturnType<typeof getNicheMedia>) {
  return [
    {
      category: "Pães",
      name: "Pão francês",
      description: "Casquinha crocante, miolo macio e fornada fresca todos os dias.",
      price: "R$ 0,90",
      image: media.hero,
      imageAlt: "Pães franceses recém-assados",
    },
    {
      category: "Bolos",
      name: "Bolo caseiro",
      description: "Massa fofinha com sabor de casa para acompanhar o café.",
      price: "R$ 24,90",
      image: media.secondary,
      imageAlt: "Bolo caseiro em mesa de café",
    },
    {
      category: "Doces",
      name: "Sonho de creme",
      description: "Doce leve, recheio cremoso e finalização com açúcar.",
      price: "R$ 7,90",
      image: "https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=900&q=82",
      imageAlt: "Doces de padaria em vitrine",
    },
    {
      category: "Salgados",
      name: "Pão de queijo",
      description: "Porção dourada, macia por dentro e perfeita para o café.",
      price: "R$ 5,90",
      image: "https://images.unsplash.com/photo-1568254183919-78a4f43a2877?auto=format&fit=crop&w=900&q=82",
      imageAlt: "Pão de queijo dourado servido quente",
    },
  ];
}

function buildGenericGeneratedProducts(industry: string, media: ReturnType<typeof getNicheMedia>) {
  const label = titleCase(industry);

  return [
    {
      category: "Essencial",
      name: `Plano ${label}`,
      description: "Apresentação clara do serviço principal com chamada de contato.",
      price: "Sob consulta",
      image: media.hero,
      imageAlt: media.secondaryAlt,
    },
    {
      category: "Profissional",
      name: "Atendimento completo",
      description: "Bloco para explicar benefícios, processo e próximos passos.",
      price: "Sob consulta",
      image: media.secondary,
      imageAlt: media.secondaryAlt,
    },
    {
      category: "Premium",
      name: "Experiência personalizada",
      description: "Oferta destacada para clientes que precisam de solução sob medida.",
      price: "Sob consulta",
      image: media.tertiary,
      imageAlt: media.tertiaryAlt,
    },
    {
      category: "Contato",
      name: "Orçamento rápido",
      description: "Caminho direto para WhatsApp, e-mail ou formulário de contato.",
      price: "Grátis",
      image: media.secondary,
      imageAlt: media.secondaryAlt,
    },
  ];
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
  const directives = extractPreviewDirectives(input.prompt);
  const media = applyMediaDirectives(getNicheMedia(input.industry), directives);
  const profile = getNicheProfile(input.industry, input.name);
  const theme = profile.theme;
  const contact = buildContact(input.brief);
  const isBakery = normalize(input.industry).includes("padaria");
  const description = escapeHtml(
    isDashboard
      ? `Sistema para ${input.industry} com clientes, automacoes, metricas e operacao em um so lugar.`
      : directives.description || profile.description,
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
    .map((item) => `<a href="${getNavTarget(item)}">${escapeHtml(item)}</a>`)
    .join("");
  const secondaryHref = isBakery ? "#produtos" : "#servicos";
  const bakerySections = isBakery ? buildBakerySections(input.name, contact) : "";
  const mapBlock = isBakery
    ? `<div class="map-placeholder">Mapa da regiao<br><span>Espaco pronto para incorporar Google Maps ou mapa estatico.</span></div>`
    : "";
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
      --heading: ${directives.titleColor ?? theme.text};
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
      color: var(--heading);
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
    .section-title {
      margin: 0 0 18px;
      font-family: Georgia, "Times New Roman", serif;
      font-size: clamp(34px, 5vw, 56px);
      line-height: 1;
      color: var(--heading);
    }
    .catalog, .promo, .testimonials {
      margin: 0 0 64px;
      scroll-margin-top: 90px;
    }
    .category-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 18px;
    }
    .category-tabs span {
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--surface);
      padding: 9px 12px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 900;
    }
    .product-grid, .testimonial-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }
    .product-card, .testimonial-card, .promo {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .product-card img {
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: cover;
      display: block;
    }
    .product-card div, .testimonial-card {
      padding: 16px;
    }
    .product-card small {
      color: var(--accent);
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
    }
    .product-card h3, .testimonial-card h3 {
      margin: 8px 0;
      font-size: 20px;
    }
    .product-card p, .testimonial-card p {
      color: var(--muted);
      line-height: 1.55;
      margin: 0;
      font-size: 14px;
    }
    .product-card strong {
      display: block;
      margin-top: 12px;
      font-size: 18px;
    }
    .promo {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(260px, .7fr);
      align-items: center;
      gap: 18px;
      padding: clamp(22px, 4vw, 42px);
      background:
        linear-gradient(135deg, var(--accent-soft), var(--surface-strong));
    }
    .promo p {
      color: var(--muted);
      line-height: 1.7;
    }
    .promo img {
      width: 100%;
      min-height: 260px;
      object-fit: cover;
      border-radius: 8px;
    }
    .map-placeholder {
      margin-top: 18px;
      display: grid;
      place-items: center;
      min-height: 160px;
      border: 1px dashed var(--line);
      border-radius: 8px;
      background: var(--surface-strong);
      color: var(--text);
      text-align: center;
      font-weight: 900;
    }
    .map-placeholder span {
      display: block;
      margin-top: 6px;
      color: var(--muted);
      font-size: 12px;
      font-weight: 700;
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
      .product-grid, .testimonial-grid, .promo { grid-template-columns: 1fr; }
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
    <section id="inicio" class="hero">
      <div>
        <h1>${isDashboard ? "Operacao pronta para escalar" : escapeHtml(profile.headline)}</h1>
        <p class="lead">${description}</p>
        <div class="actions">
          <a class="primary" href="${contact.primaryHref}">${contact.primary || "Comecar agora"}</a>
          <a class="secondary" href="${secondaryHref}">${isBakery ? "Ver produtos" : "Ver servicos"}</a>
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
    <section id="${isBakery ? "sobre" : "servicos"}" class="features">${featureCards}</section>
    ${bakerySections}
    <section id="contato" class="story">
      <img src="${media.tertiary}" alt="${escapeHtml(media.tertiaryAlt)}" referrerpolicy="no-referrer" />
      <div class="story-panel">
        <h2>${escapeHtml(profile.storyTitle)}</h2>
        <p>${escapeHtml(profile.storyText)}</p>
        <div class="contact-card">${contactRows}</div>
        ${mapBlock}
        <p class="credit">Imagens gratuitas via Unsplash. ${escapeHtml(media.credit)}</p>
      </div>
    </section>
    <footer><span>${escapedName}</span><span>${promptSummary}</span><span>Gerado pela IA ZS</span></footer>
  </main>
</body>
</html>`;
}

function buildBakerySections(name: string, contact: ReturnType<typeof buildContact>) {
  const escapedName = escapeHtml(titleCase(name));
  const contactHref = contact.primaryHref;
  const products = [
    {
      category: "Paes",
      name: "Pao frances artesanal",
      description: "Casquinha crocante, miolo leve e fornada ao longo do dia.",
      price: "R$ 0,90",
      image: "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=900&q=82",
    },
    {
      category: "Salgados",
      name: "Pao de queijo",
      description: "Porcao quentinha, dourada e perfeita para o cafe da manha.",
      price: "R$ 5,90",
      image: "https://images.unsplash.com/photo-1568254183919-78a4f43a2877?auto=format&fit=crop&w=900&q=82",
    },
    {
      category: "Bolos",
      name: "Bolo caseiro",
      description: "Massa fofinha com sabores do dia e cobertura simples.",
      price: "R$ 24,90",
      image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=82",
    },
    {
      category: "Doces",
      name: "Sonho de creme",
      description: "Recheio delicado, acucar leve e preparo artesanal.",
      price: "R$ 7,90",
      image: "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=900&q=82",
    },
    {
      category: "Bebidas",
      name: "Cafe coado",
      description: "Cafe fresco para acompanhar paes, bolos e salgados.",
      price: "R$ 6,90",
      image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=82",
    },
    {
      category: "Combos",
      name: "Cesta da manha",
      description: "Selecao de paes, bolo, doce e bebida para pedir rapido.",
      price: "R$ 39,90",
      image: "https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=900&q=82",
    },
  ];

  const productCards = products
    .map(
      (product) => `
        <article class="product-card">
          <img src="${product.image}" alt="${escapeHtml(product.name)}" referrerpolicy="no-referrer" />
          <div>
            <small>${escapeHtml(product.category)}</small>
            <h3>${escapeHtml(product.name)}</h3>
            <p>${escapeHtml(product.description)}</p>
            <strong>${escapeHtml(product.price)}</strong>
          </div>
        </article>`,
    )
    .join("");
  const testimonials = [
    ["Marina Lopes", "★★★★★", "O pao chega sempre quente e o atendimento pelo WhatsApp e muito rapido."],
    ["Carlos Mendes", "★★★★★", "A vitrine online ficou clara. Encomendei bolo e salgados sem precisar ligar."],
    ["Aline Rocha", "★★★★★", "O combo do cafe da manha virou pedido fixo aqui em casa."],
  ]
    .map(
      ([client, rating, text]) => `
        <article class="testimonial-card">
          <h3>${escapeHtml(client)}</h3>
          <strong>${escapeHtml(rating)}</strong>
          <p>${escapeHtml(text)}</p>
        </article>`,
    )
    .join("");

  return `
    <section id="produtos" class="catalog">
      <h2 class="section-title">Produtos frescos da ${escapedName}</h2>
      <div class="category-tabs">
        <span>Paes</span><span>Bolos</span><span>Doces</span><span>Salgados</span><span>Bebidas</span>
      </div>
      <div class="product-grid">${productCards}</div>
    </section>
    <section id="cardapio" class="promo">
      <div>
        <h2 class="section-title">Combo do cafe da manha</h2>
        <p>Monte um pedido com paes frescos, pao de queijo, bolo caseiro, doce do dia e cafe. Um bloco promocional pronto para conectar ao WhatsApp ou checkout.</p>
        <a class="primary" href="${contactHref}">Pedir combo</a>
      </div>
      <img src="https://images.unsplash.com/photo-1517433367423-c7e5b0f35086?auto=format&fit=crop&w=900&q=82" alt="Combo de cafe da manha com produtos de padaria" referrerpolicy="no-referrer" />
    </section>
    <section id="depoimentos" class="testimonials">
      <h2 class="section-title">Clientes que voltam toda semana</h2>
      <div class="testimonial-grid">${testimonials}</div>
    </section>`;
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

type PreviewDirectives = {
  description?: string;
  titleColor?: string;
  imageTarget?: "pao de queijo" | "paes" | "bolos" | "doces" | "cafe";
};

function extractPreviewDirectives(prompt: string): PreviewDirectives {
  const intent = latestPromptIntent(prompt);

  return {
    description: extractDescriptionOverride(intent),
    titleColor: extractHeroTitleColor(intent),
    imageTarget: extractImageTarget(intent),
  };
}

function applyMediaDirectives<T extends ReturnType<typeof getNicheMedia>>(
  media: T,
  directives: PreviewDirectives,
) {
  if (!directives.imageTarget) return media;

  const imageByTarget = {
    "pao de queijo": {
      url: "https://images.unsplash.com/photo-1568254183919-78a4f43a2877?auto=format&fit=crop&w=1200&q=82",
      alt: "Pao de queijo dourado servido quente",
    },
    paes: {
      url: "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=1200&q=82",
      alt: "Paes artesanais recem assados",
    },
    bolos: {
      url: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1200&q=82",
      alt: "Bolo caseiro em destaque",
    },
    doces: {
      url: "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=1200&q=82",
      alt: "Doces de padaria em vitrine",
    },
    cafe: {
      url: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=82",
      alt: "Cafe fresco servido na padaria",
    },
  } satisfies Record<NonNullable<PreviewDirectives["imageTarget"]>, { url: string; alt: string }>;
  const nextImage = imageByTarget[directives.imageTarget];

  return {
    ...media,
    secondary: nextImage.url,
    secondaryAlt: nextImage.alt,
  };
}

function extractDescriptionOverride(prompt: string) {
  const patterns = [
    /(?:troque|mude|altere|coloque|reescreva)[^.!?;\n]{0,80}?(?:descricao principal|descri[cç][aã]o principal|subtitulo|texto principal)[^.!?;\n]{0,24}?(?:para|por)\s+["']?([^"'.!?;\n]+(?:[.!?][^"'\n]+)?)/i,
    /(?:descricao principal|descri[cç][aã]o principal|subtitulo|texto principal)[^.!?;\n]{0,24}?(?:para|por)\s+["']?([^"'.!?;\n]+(?:[.!?][^"'\n]+)?)/i,
  ];

  for (const pattern of patterns) {
    const match = prompt.match(pattern)?.[1]?.trim();
    if (match) return cleanSentence(match, 180);
  }

  return undefined;
}

function extractHeroTitleColor(prompt: string) {
  const lower = normalize(prompt);
  if (!lower.includes("titulo") && !lower.includes("headline")) return undefined;

  const hex = prompt.match(/#[0-9a-f]{3,6}\b/i)?.[0];
  if (hex) return normalizeColor(hex) ?? undefined;

  const colors: Array<[string, string]> = [
    ["verde", "#22c55e"],
    ["marrom", "#7a3f18"],
    ["amarelo", "#d99a12"],
    ["dourado", "#c47f17"],
    ["azul", "#2563eb"],
    ["vermelho", "#dc2626"],
    ["rosa", "#db2777"],
    ["roxo", "#7c3aed"],
    ["preto", "#111111"],
    ["branco", "#ffffff"],
  ];

  return colors.find(([name]) => lower.includes(name))?.[1];
}

function extractImageTarget(prompt: string): PreviewDirectives["imageTarget"] {
  const lower = normalize(prompt);
  if (!lower.includes("imagem") && !lower.includes("foto") && !lower.includes("banner")) {
    return undefined;
  }

  if (lower.includes("pao de queijo") || lower.includes("po de queijo") || lower.includes("queijo")) {
    return "pao de queijo";
  }
  if (lower.includes("bolo")) return "bolos";
  if (lower.includes("doce") || lower.includes("sonho")) return "doces";
  if (lower.includes("cafe")) return "cafe";
  if (lower.includes("pao") || lower.includes("paes")) return "paes";

  return undefined;
}

function getNavTarget(label: string) {
  const lower = normalize(label);
  if (lower.includes("inicio")) return "#inicio";
  if (lower.includes("sobre")) return "#sobre";
  if (lower.includes("produto")) return "#produtos";
  if (lower.includes("cardapio")) return "#cardapio";
  if (lower.includes("depoimento")) return "#depoimentos";
  if (lower.includes("agenda")) return "#contato";
  if (lower.includes("contato")) return "#contato";
  return "#servicos";
}

function latestPromptIntent(prompt: string) {
  const editMatches = Array.from(prompt.matchAll(/Edicao\s+\d+:\s*/gi));
  const lastEdit = editMatches.at(-1);
  if (lastEdit?.index !== undefined) {
    return prompt.slice(lastEdit.index + lastEdit[0].length);
  }

  const marker = "Pedido do usuario:";
  const lastMarkerIndex = prompt.lastIndexOf(marker);
  if (lastMarkerIndex >= 0) return prompt.slice(lastMarkerIndex + marker.length);

  return prompt;
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
      navItems: ["Inicio", "Sobre", "Produtos", "Cardapio", "Depoimentos", "Contato"],
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
  if (normalized.includes("autentic")) return "Fluxo preparado para rotas privadas, sessões e banco.";
  if (normalized.includes("dashboard")) return "Indicadores e módulos organizados para gestão diária.";
  if (normalized.includes("hero")) return "Primeiro impacto com mensagem direta e ação clara.";
  if (normalized.includes("whatsapp")) return "Chamada rápida para contato e conversão.";
  if (normalized.includes("catalogo")) return "Produtos com categoria, imagem, descrição e preço.";
  if (normalized.includes("combo")) return "Bloco promocional pronto para pedido rápido.";
  if (normalized.includes("depoimento")) return "Prova social organizada em cards responsivos.";
  if (normalized.includes("mapa")) return "Contato com endereço, horário e espaço para mapa.";
  if (normalized.includes("agendamento")) return "Base para agenda, horários e confirmações.";
  if (normalized.includes("realtime")) return "Preparado para atualizações em tempo real.";
  return "Bloco reutilizável para evoluir o produto com consistência.";
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

function cleanSentence(input: string, maxLength: number) {
  return input
    .replace(/\s+/g, " ")
    .replace(/^["']|["']$/g, "")
    .trim()
    .slice(0, maxLength);
}

function isStyleOnlyTitleValue(input: string) {
  const lower = normalize(input).trim();
  return [
    "verde",
    "verde neon",
    "azul",
    "vermelho",
    "amarelo",
    "marrom",
    "dourado",
    "preto",
    "branco",
    "rosa",
    "roxo",
  ].includes(lower) || /^#[0-9a-f]{3,6}$/i.test(input.trim());
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
