import { buildAugmentedPrompt, getReusableTemplateFiles } from "./context";
import { enhanceBuilderRequest } from "./external-ai";
import { buildEditDoneReply } from "./responses";
import type { AiEngineReport, AiGenerationBlueprint, AiModelMode } from "./engine-types";
import type { BuilderImageAttachment, VisionAnalysis, VisionContext, VisionTarget } from "./vision";

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
  aiEngine?: AiEngineReport;
  visionReferences?: BuilderVisionReference[];
  editCount: number;
  createdAt: string;
  updatedAt: string;
};

export type BuilderVisionReference = BuilderImageAttachment & {
  target: Exclude<VisionTarget, "none">;
  summary: string;
  layout: string;
  visualPrompt: string;
  colors: string[];
  source: VisionAnalysis["source"];
  createdAt: string;
};

export type BuilderAssistantResponse = {
  mode: "chat" | "create" | "edit";
  reply: string;
  project?: BuilderProject;
  vision?: VisionAnalysis | null;
  aiEngine?: AiEngineReport;
  aiBlueprint?: AiGenerationBlueprint | null;
  suggestions: string[];
  tokenCost: number;
};

type BuilderGenerationContext = {
  blueprint?: AiGenerationBlueprint | null;
  aiEngine?: AiEngineReport;
  memoryContext?: string;
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

export async function respondToBuilderMessage(input: {
  message: string;
  project?: BuilderProject | null;
  brief?: ProjectBrief | null;
  vision?: VisionContext | null;
  userName?: string;
  modelMode?: AiModelMode | string;
}): Promise<BuilderAssistantResponse> {
  const message = input.message.trim();
  const vision = input.vision ?? null;
  const intent = classifyBuilderIntent({
    message,
    project: input.project ?? null,
    hasBrief: Boolean(input.brief),
    vision,
  });

  if (!message) {
    return {
      mode: "chat",
      reply: "Me diga o site, SaaS ou ajuste que voce quer criar.",
      vision: vision?.analysis ?? null,
      suggestions: defaultSuggestions,
      tokenCost: 0,
    };
  }

  const aiEnhancement = await enhanceBuilderRequest({
    message,
    intent,
    modelMode: input.modelMode,
    hasProject: Boolean(input.project),
    hasBrief: Boolean(input.brief),
    visionSummary: vision?.analysis.summary ?? null,
  });
  const generationContext: BuilderGenerationContext = {
    blueprint: aiEnhancement.blueprint,
    aiEngine: aiEnhancement.report,
    memoryContext: aiEnhancement.memoryContext,
  };
  const effectiveMessage = buildEffectivePrompt(message, generationContext);
  const externalReply = aiEnhancement.blueprint?.reply?.trim();
  const externalTokenCost = aiEnhancement.report.usedExternal ? aiEnhancement.report.estimatedTokenCost : 0;

  if (input.brief) {
    const project = buildProjectFromBrief(input.brief, vision, generationContext);

    return {
      mode: "create",
      project,
      vision: vision?.analysis ?? null,
      aiEngine: aiEnhancement.report,
      aiBlueprint: aiEnhancement.blueprint,
      reply: [
        externalReply || `Criei ${project.name} com o modelo visual principal.`,
        project.summary,
        "O projeto ja inclui estrutura de site, area logada, rotas de backend, banco, vendas, estoque e agendamentos.",
      ].join("\n\n"),
      suggestions: [
        "Adicione depoimentos de clientes reais.",
        "Crie uma secao de servicos com precos.",
        "Troque a imagem principal por outra referencia.",
      ],
      tokenCost: estimateTokenCost(message, "create") + externalTokenCost,
    };
  }

  if (input.project && intent === "edit") {
    const project = editProjectFromPrompt(input.project, message, vision, generationContext);
    const editTarget = describeEditTarget(message);
    const isRemoval = isRemovalPrompt(message);

    return {
      mode: "edit",
      project,
      vision: vision?.analysis ?? null,
      aiEngine: aiEnhancement.report,
      aiBlueprint: aiEnhancement.blueprint,
      reply: buildEditDoneReply({
        userName: input.userName,
        projectName: project.name,
        summary: project.summary,
        target: editTarget,
        isRemoval,
      }),
      suggestions: [
        "Crie uma area de agendamento com horarios.",
        "Adicione uma secao de planos com Mercado Pago.",
        "Deixe o hero mais sofisticado e com prova social.",
      ],
      tokenCost: estimateTokenCost(message, "edit") + externalTokenCost,
    };
  }

  if (intent === "create") {
    const project = buildProjectFromPrompt(effectiveMessage, vision, generationContext);

    return {
      mode: "create",
      project,
      vision: vision?.analysis ?? null,
      aiEngine: aiEnhancement.report,
      aiBlueprint: aiEnhancement.blueprint,
      reply: [
        externalReply || `Criei ${project.name}.`,
        project.summary,
        "A estrutura gerada ja vem com componentes, rotas, banco, autenticacao, vendas, estoque e agendamento para evoluir como projeto real.",
      ].join("\n\n"),
      suggestions: [
        "Troque o titulo principal por outro nome.",
        "Adicione autenticacao, pagamentos e painel admin.",
        "Crie uma versao mobile com CTA fixo.",
      ],
      tokenCost: estimateTokenCost(message, "create") + externalTokenCost,
    };
  }

  return {
    mode: "chat",
    reply: externalReply || buildConversationalReply(message, input.project, vision),
    vision: vision?.analysis ?? null,
    aiEngine: aiEnhancement.report,
    aiBlueprint: aiEnhancement.blueprint,
    suggestions: defaultSuggestions,
    tokenCost: estimateTokenCost(message, "chat") + (vision ? 6 : 0) + externalTokenCost,
  };
}

export function buildProjectFromBrief(
  brief: ProjectBrief,
  vision?: VisionContext | null,
  generationContext: BuilderGenerationContext = {},
): BuilderProject {
  const cleanBrief = normalizeBrief(brief);
  const blueprint = generationContext.blueprint;
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
  const features = withVisionFeatures(
    mergeFeatures(buildFeatures(prompt, "site", industry), blueprint?.features ?? []),
    vision,
  );
  const projectName = titleCase(blueprint?.projectName || cleanBrief.companyName);
  const contextMessage = appendVisionContext(prompt, vision);
  const augmentedPrompt = `${prompt}\n\nContexto IA:\n${buildAugmentedPrompt({
    message: contextMessage,
    industry,
    projectName,
    brief: cleanBrief,
    externalAiContext: buildExternalAiContext(generationContext),
    memoryContext: generationContext.memoryContext,
  })}`;
  const visionReferences = buildVisionReferences(vision, now);
  const summary = [
    `${cleanBrief.companyName} agora tem uma base completa para ${industry}, com site responsivo, area logada, vendas, estoque, agendamento e painel administrativo.`,
    blueprint?.reply || "",
    visionReferences.length ? "A referencia visual anexada foi incorporada ao preview." : "",
  ]
    .filter(Boolean)
    .join(" ");

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
      ...(visionReferences.length ? ["Vision Agent analisou a imagem anexada."] : []),
      buildAiEngineStep(generationContext.aiEngine),
      "Conteudo, tema e imagens adaptados ao nicho.",
      "Area logada, vendas, estoque e agendamento preparados.",
      "Preview validado com estrutura HTML segura para iframe sandbox.",
      "Arquivos organizados para download em ZIP.",
    ].filter(Boolean),
    features,
    files: buildFiles(cleanBrief.companyName, "site", features, augmentedPrompt, cleanBrief, visionReferences, generationContext),
    aiEngine: generationContext.aiEngine,
    visionReferences,
    previewHtml: buildPreviewHtml({
      prompt: augmentedPrompt,
      name: projectName,
      kind: "site",
      industry,
      features,
      palette,
      brief: cleanBrief,
      visionReferences,
      editNotes: [],
    }),
    editCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildProjectFromPrompt(
  prompt: string,
  vision?: VisionContext | null,
  generationContext: BuilderGenerationContext = {},
): BuilderProject {
  const cleanPrompt = prompt.trim();
  const blueprint = generationContext.blueprint;
  const now = new Date().toISOString();
  const inferencePrompt = appendVisionContext(cleanPrompt, vision);
  const kind = blueprint?.kind ?? detectKind(inferencePrompt);
  const industry = blueprint?.industry || detectIndustry(inferencePrompt);
  const palette = pickPalette(inferencePrompt);
  const name = blueprint?.projectName ? titleCase(cleanName(blueprint.projectName)) : buildName(inferencePrompt, industry, kind);
  const features = withVisionFeatures(
    mergeFeatures(buildFeatures(inferencePrompt, kind, industry), blueprint?.features ?? []),
    vision,
  );
  const augmentedPrompt = `${cleanPrompt}\n\nContexto IA:\n${buildAugmentedPrompt({
    message: inferencePrompt,
    industry,
    projectName: name,
    externalAiContext: buildExternalAiContext(generationContext),
    memoryContext: generationContext.memoryContext,
  })}`;
  const visionReferences = buildVisionReferences(vision, now);
  const steps = [
    "Entendimento do publico, objetivo e tipo de produto.",
    ...(visionReferences.length ? ["Vision Agent analisou screenshot/imagem anexada."] : []),
    buildAiEngineStep(generationContext.aiEngine),
    "Definicao de arquitetura visual, paginas e componentes.",
    "Agentes de arquitetura, design, codigo, QA e SEO aplicados quando necessario.",
    "Geracao do preview seguro dentro do iframe.",
    "Preview validado com estrutura HTML, viewport e conteudo principal.",
    "Criacao de arquivos sugeridos para evoluir o projeto real.",
    "Preparacao para integrar banco, autenticacao, APIs e pagamentos.",
  ].filter(Boolean);
  const summary =
    kind === "saas" || kind === "dashboard"
      ? `${name} e um sistema com onboarding, painel, metricas, entidades de negocio e caminhos preparados para autenticacao, banco e pagamento.`
      : `${name} e um projeto completo com site responsivo, backend, area logada, vendas, estoque, agendamento e painel administrativo.`;
  const fullSummary = [
    summary,
    blueprint?.reply,
    visionReferences.length ? "A referencia visual enviada foi usada para orientar o preview." : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: createId(cleanPrompt),
    name,
    kind,
    summary: fullSummary,
    prompt: augmentedPrompt,
    industry,
    paletteName: palette.name,
    steps,
    features,
    files: buildFiles(name, kind, features, augmentedPrompt, undefined, visionReferences, generationContext),
    aiEngine: generationContext.aiEngine,
    visionReferences,
    previewHtml: buildPreviewHtml({
      prompt: augmentedPrompt,
      name,
      kind,
      industry,
      features,
      palette,
      brief: undefined,
      visionReferences,
      editNotes: [],
    }),
    editCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function editProjectFromPrompt(
  project: BuilderProject,
  prompt: string,
  vision?: VisionContext | null,
  generationContext: BuilderGenerationContext = {},
): BuilderProject {
  const now = new Date().toISOString();
  const blueprint = generationContext.blueprint;
  const changes: string[] = [];
  const intent = latestPromptIntent(prompt);
  const selectedElement = extractSelectedElement(prompt);
  const descriptionOverride = extractDescriptionOverride(intent);
  const imageTarget = extractImageTarget(intent);
  const removalDirectives = extractRemovalDirectives(prompt);
  const newVisionReferences = buildVisionReferences(vision, now);
  const visionReferences = mergeVisionReferences(
    shouldClearVisionReferences(prompt) ? [] : project.visionReferences ?? [],
    newVisionReferences,
  );
  const requestedName = extractRequestedName(prompt);
  const requestedKind = isRemovalPrompt(prompt) ? null : blueprint?.kind ?? extractRequestedKind(prompt);
  const requestedPalette = pickEditPalette(prompt) ?? getPalette(project.paletteName);
  let nextFeatures = mergeFeatures(
    project.features,
    withVisionFeatures(
      mergeFeatures(
        buildFeatures(appendVisionContext(prompt, vision), requestedKind ?? project.kind, project.industry),
        blueprint?.features ?? [],
      ),
      vision,
    ),
  );
  nextFeatures = applyFeatureRemovals(nextFeatures, removalDirectives);

  let name = project.name;
  if (requestedName) {
    name = requestedName;
    changes.push(`titulo/nome alterado para ${requestedName}`);
  }

  if (requestedPalette.name !== project.paletteName) {
    changes.push(`paleta alterada para ${requestedPalette.name}`);
  }

  if (descriptionOverride) {
    changes.push("descricao principal atualizada");
  }

  if (imageTarget) {
    changes.push(`imagem de ${imageTarget} atualizada`);
  }

  if (removalDirectives.removeAuthSystem) {
    changes.push("sistema de login removido");
  }

  if (removalDirectives.removeHeroTitle) {
    changes.push("titulo central removido");
  }

  if (removalDirectives.removeAuthTitle) {
    changes.push("titulo do card de login removido");
  }

  if (newVisionReferences.length) {
    changes.push("referencia visual anexada aplicada pelo Vision Agent");
  }

  if (blueprint?.editNotes?.length) {
    changes.push(...blueprint.editNotes.slice(0, 4));
  }

  if (shouldClearVisionReferences(prompt)) {
    changes.push("referencias visuais anexadas removidas");
  }

  if (selectedElement) {
    changes.push(`item selecionado ajustado: ${selectedElement}`);
  }

  const kind = requestedKind ?? project.kind;
  if (kind !== project.kind) {
    changes.push(`tipo ajustado para ${kind}`);
  }

  if (changes.length === 0) {
    changes.push("conteudo e layout ajustados conforme o pedido");
  }

  const nextPrompt = `${project.prompt}\nEdicao ${project.editCount + 1}: ${prompt}`;
  const summary = `Mudancas aplicadas: ${changes.join(", ")}. Mantive o modelo visual, atualizei o conteudo solicitado e regenerei os arquivos do projeto.`;

  return {
    ...project,
    name,
    kind,
    summary,
    prompt: nextPrompt,
    paletteName: requestedPalette.name,
    features: nextFeatures,
    files: buildFiles(name, kind, nextFeatures, nextPrompt, project.brief, visionReferences, generationContext),
    aiEngine: generationContext.aiEngine,
    visionReferences,
    previewHtml: buildPreviewHtml({
      prompt: nextPrompt,
      name,
      kind,
      industry: project.industry,
      features: nextFeatures,
      palette: requestedPalette,
      brief: project.brief,
      visionReferences,
      editNotes: changes,
    }),
    editCount: project.editCount + 1,
    updatedAt: now,
  };
}

function classifyBuilderIntent(input: {
  message: string;
  project: BuilderProject | null;
  hasBrief: boolean;
  vision: VisionContext | null;
}): BuilderAssistantResponse["mode"] {
  if (input.hasBrief) return "create";

  const latest = latestPromptIntent(input.message);
  const visionShouldApply = Boolean(input.vision?.analysis.shouldApplyToPreview);

  if (input.project && (looksLikeEdit(latest) || visionShouldApply)) {
    return "edit";
  }

  if (looksLikeBuild(latest)) return "create";

  if (!input.project && visionShouldApply && looksLikeVisionBuild(latest)) {
    return "create";
  }

  return "chat";
}

function looksLikeBuild(prompt: string) {
  const lower = normalize(prompt);
  const buildWords = [
    "crie",
    "criar",
    "faca",
    "fazer",
    "gere",
    "gerar",
    "monte",
  ];
  const productWords = [
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
  ];

  if (buildWords.some((word) => lower.includes(word)) && productWords.some((word) => lower.includes(word))) {
    return true;
  }

  return [
    "site para",
    "saas para",
    "sistema para",
    "landing page",
    "dashboard para",
    "loja online",
    "barbearia com",
    "clinica com",
    "restaurante com",
  ].some((phrase) => lower.includes(phrase));
}

function looksLikeEdit(prompt: string) {
  const lower = normalize(prompt);
  const editWords = [
    "troque",
    "mude",
    "altere",
    "edite",
    "adicione",
    "coloque",
    "remova",
    "remover",
    "retire",
    "retirar",
    "tire",
    "tirar",
    "apague",
    "apagar",
    "exclua",
    "excluir",
    "aumente",
    "diminua",
    "substitua",
    "aplique",
    "refaca",
    "deixe",
    "colocar",
  ];
  const targets = [
    "titulo",
    "hero",
    "headline",
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
    "premium",
    "moderno",
    "sofisticado",
  ];

  return editWords.some((word) => lower.includes(word)) && targets.some((word) => lower.includes(word));
}

type RemovalDirectives = {
  removeAuthSystem: boolean;
  removeHeroTitle: boolean;
  removeAuthTitle: boolean;
};

function extractRemovalDirectives(prompt: string): RemovalDirectives {
  const lower = normalize(prompt);
  const hasRemovalVerb = [
    "remova",
    "remover",
    "retire",
    "retirar",
    "tire",
    "tirar",
    "apague",
    "apagar",
    "exclua",
    "excluir",
    "elimine",
    "deletar",
    "delete",
  ].some((word) => lower.includes(word));

  if (!hasRemovalVerb) {
    return {
      removeAuthSystem: false,
      removeHeroTitle: false,
      removeAuthTitle: false,
    };
  }

  const mentionsAuth = [
    "login",
    "loguin",
    "autenticacao",
    "autenticacao",
    "cadastro",
    "entrar",
    "conta",
    "area logada",
    "sistema de login",
  ].some((word) => lower.includes(word));
  const mentionsEntireSystem = [
    "sistema",
    "inteiro",
    "ineiro",
    "inteira",
    "todo",
    "completo",
    "area logada",
    "autenticacao",
    "login inteiro",
  ].some((word) => lower.includes(word));
  const mentionsTitle = ["titulo", "titilo", "titlo", "title", "h1", "headline", "cabecalho"].some((word) =>
    lower.includes(word),
  );
  const mentionsCentral = ["central", "principal", "hero", "meio"].some((word) => lower.includes(word));
  const mentionsLoginCard = ["card de login", "modal de login", "tela de login", "login"].some((word) =>
    lower.includes(word),
  );
  const mentionsOnlyAuthRemoval = mentionsAuth && !mentionsTitle;

  return {
    removeAuthSystem: mentionsAuth && (mentionsEntireSystem || mentionsOnlyAuthRemoval),
    removeHeroTitle: mentionsTitle && mentionsCentral && !mentionsLoginCard,
    removeAuthTitle: mentionsTitle && mentionsLoginCard,
  };
}

function extractRemovalDirectivesFromHistory(prompt: string): RemovalDirectives {
  const editSegments = prompt.split(/\nEdicao\s+\d+:\s*/i).slice(1);
  const segments = editSegments.length ? editSegments : [latestPromptIntent(prompt)];

  return segments.reduce<RemovalDirectives>(
    (merged, segment) => {
      const next = extractRemovalDirectives(segment);
      return {
        removeAuthSystem: merged.removeAuthSystem || next.removeAuthSystem,
        removeHeroTitle: merged.removeHeroTitle || next.removeHeroTitle,
        removeAuthTitle: merged.removeAuthTitle || next.removeAuthTitle,
      };
    },
    {
      removeAuthSystem: false,
      removeHeroTitle: false,
      removeAuthTitle: false,
    },
  );
}

function applyFeatureRemovals(features: string[], removals: RemovalDirectives) {
  if (!removals.removeAuthSystem) return features;

  return features.filter((feature) => {
    const lower = normalize(feature);
    return !lower.includes("autentic") && !lower.includes("logada") && !lower.includes("login");
  });
}

function isRemovalPrompt(prompt: string) {
  const removals = extractRemovalDirectivesFromHistory(prompt);
  if (removals.removeAuthSystem || removals.removeHeroTitle || removals.removeAuthTitle) return true;

  const lower = normalize(prompt);
  return ["remova", "remover", "retire", "retirar", "tire", "tirar", "apague", "apagar", "exclua"].some(
    (word) => lower.includes(word),
  );
}

function describeEditTarget(prompt: string) {
  const removals = extractRemovalDirectivesFromHistory(prompt);
  if (removals.removeAuthSystem) return "o sistema de login inteiro";
  if (removals.removeHeroTitle) return "o titulo central";
  if (removals.removeAuthTitle) return "o titulo do card de login";

  const selectedElement = extractSelectedElement(prompt);
  if (selectedElement) return selectedElement;

  const lower = normalize(prompt);
  if (lower.includes("cor")) return "as cores do site";
  if (lower.includes("imagem") || lower.includes("foto") || lower.includes("banner")) return "a imagem solicitada";
  if (lower.includes("titulo") || lower.includes("headline")) return "o titulo solicitado";
  if (lower.includes("descricao") || lower.includes("subtitulo")) return "o texto principal";
  if (lower.includes("botao") || lower.includes("cta")) return "o botao solicitado";
  if (lower.includes("secao") || lower.includes("seção")) return "a secao solicitada";
  if (lower.includes("login")) return "o login";

  return undefined;
}

function looksLikeVisionBuild(prompt: string) {
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
    "pagina",
    "landing",
    "preview",
  ].some((word) => lower.includes(word));
}

function buildConversationalReply(
  prompt: string,
  project?: BuilderProject | null,
  vision?: VisionContext | null,
) {
  const lower = normalize(prompt);

  if (vision) {
    const analysis = vision.analysis;
    if (!analysis.shouldApplyToPreview) {
      return [
        `Vision Agent analisou o anexo: ${analysis.summary}`,
        "Ainda nao alterei o preview porque a fala nao pediu uma acao clara. Para aplicar, diga algo como: coloque essa imagem no hero, use esse print como referencia visual, ou troque a imagem selecionada por essa foto.",
      ].join("\n\n");
    }
  }

  if (lower.includes("ola") || lower.includes("oi") || lower.includes("bom dia")) {
    return "Oi, zs. Eu posso conversar normal, criar um site do zero ou editar o preview atual. Se ja tiver um projeto aberto, fale algo como: troque o titulo para Barbearia Elite, ou adicione uma area de planos.";
  }

  if (lower.includes("como funciona") || lower.includes("ajuda")) {
    return [
      "Funciona assim: voce descreve o site ou SaaS, eu gero o preview, listo arquivos e depois entendo pedidos de edicao no projeto atual.",
      "Exemplos: crie um SaaS para academias; mude a cor para verde neon; adicione login e dashboard; troque o titulo por Barbearia Elite.",
    ].join("\n\n");
  }

  if (looksLikeCodeInput(prompt)) {
    return buildLocalCodeAnalysisReply(prompt);
  }

  if (project) {
    return `O projeto atual e ${project.name}. Posso editar textos, cores, secoes, CTAs, recursos e estrutura funcional. Me diga exatamente o que quer mudar no preview.`;
  }

  return "Ainda nao existe um projeto aberto. Me diga o tipo de site ou SaaS que voce quer criar e eu monto a primeira versao com preview.";
}

function looksLikeCodeInput(prompt: string) {
  return /```[\s\S]+```/.test(prompt) || /\b(function|const|let|class|interface|export|import|model\s+\w+|SELECT\s+)/i.test(prompt);
}

function buildLocalCodeAnalysisReply(prompt: string) {
  const language = detectCodeLanguage(prompt);
  const lower = normalize(prompt);
  const findings = [
    lower.includes("use client") || lower.includes("usestate")
      ? "React: confirme se o componente que usa hooks esta marcado com 'use client'."
      : "",
    lower.includes("prisma") || lower.includes("model ")
      ? "Prisma: valide nomes de models, relacoes obrigatorias e rode migrate/db push depois da alteracao."
      : "",
    lower.includes("fetch(")
      ? "API: trate response.ok, erros de JSON e estados de carregamento antes de renderizar dados."
      : "",
    lower.includes("process.env") ? "Seguranca: mantenha variaveis sensiveis em Route Handlers ou codigo server-side." : "",
  ].filter(Boolean);

  return [
    `Identifiquei codigo em ${language}.`,
    "Finalidade provavel: implementar uma parte funcional do projeto, como componente, rota, schema ou consulta.",
    findings.length
      ? `Pontos para corrigir/validar:\n${findings.map((finding) => `- ${finding}`).join("\n")}`
      : "Nao encontrei um erro obvio so pela leitura local. Com uma chave de IA externa configurada, eu faco uma revisao mais profunda e proponho a correcao.",
    "Melhorias gerais: tipar entradas/saidas, validar dados no backend, tratar estados de erro e rodar lint/typecheck/build antes de entregar.",
  ].join("\n\n");
}

function detectCodeLanguage(prompt: string) {
  const lower = normalize(prompt);
  if (lower.includes("schema.prisma") || lower.includes("model ")) return "Prisma";
  if (lower.includes("tsx") || lower.includes("jsx") || lower.includes("react") || lower.includes("usestate")) return "React/TSX";
  if (lower.includes("typescript") || lower.includes("interface ") || lower.includes("type ")) return "TypeScript";
  if (lower.includes("select ") || lower.includes("insert ")) return "SQL";
  if (lower.includes("{") && lower.includes("}")) return "JavaScript/TypeScript";
  return "linguagem nao identificada com confianca";
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
        ? ["Cabecalho do modelo", "Conteudo por nicho", "Area logada", "Vendas e agenda"]
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
  if (industry !== "negocios digitais") base.push(`Experiencia completa para ${industry}`);

  return unique(base).slice(0, 8);
}

function mergeFeatures(current: string[], next: string[]) {
  return unique([...current, ...next]).slice(0, 10);
}

function withVisionFeatures(features: string[], vision?: VisionContext | null) {
  if (!vision?.analysis.shouldApplyToPreview) return features;

  return unique([
    ...features,
    vision.analysis.intent === "use-image-as-layout-reference"
      ? "Layout orientado por screenshot"
      : "Imagem anexada aplicada ao site",
    "Vision Agent",
  ]).slice(0, 10);
}

function appendVisionContext(prompt: string, vision?: VisionContext | null) {
  if (!vision) return prompt;

  const analysis = vision.analysis;
  return [
    prompt,
    "",
    "Contexto do Vision Agent:",
    `Aplicar no preview: ${analysis.shouldApplyToPreview ? "sim" : "nao"}`,
    `Intencao visual: ${analysis.intent}`,
    `Alvo visual: ${analysis.target}`,
    `Resumo: ${analysis.summary}`,
    analysis.layout ? `Layout: ${analysis.layout}` : "",
    analysis.visualPrompt ? `Direcao visual: ${analysis.visualPrompt}` : "",
    analysis.colors.length ? `Cores detectadas: ${analysis.colors.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildVisionReferences(vision: VisionContext | null | undefined, createdAt: string) {
  if (!vision?.analysis.shouldApplyToPreview || vision.analysis.target === "none") return [];

  const target = vision.analysis.target === "selected" ? "hero" : vision.analysis.target;
  return vision.attachments.map((attachment): BuilderVisionReference => ({
    ...attachment,
    target,
    summary: vision.analysis.summary,
    layout: vision.analysis.layout,
    visualPrompt: vision.analysis.visualPrompt,
    colors: vision.analysis.colors,
    source: vision.analysis.source,
    createdAt,
  }));
}

function mergeVisionReferences(
  current: BuilderVisionReference[],
  next: BuilderVisionReference[],
) {
  if (!next.length) return current;

  const nextTargets = new Set(next.map((reference) => reference.target));
  return [...current.filter((reference) => !nextTargets.has(reference.target)), ...next].slice(-4);
}

function shouldClearVisionReferences(prompt: string) {
  const lower = normalize(prompt);
  const wantsRemoval = ["remova", "remover", "tire", "tirar", "apague", "apagar"].some((word) =>
    lower.includes(word),
  );
  const mentionsVision = ["imagem anexada", "imagem enviada", "foto anexada", "referencia", "print"].some((word) =>
    lower.includes(word),
  );

  return wantsRemoval && mentionsVision;
}

function buildFiles(
  name: string,
  kind: BuilderProject["kind"],
  features: string[],
  prompt: string,
  brief?: ProjectBrief,
  visionReferences: BuilderVisionReference[] = [],
  generationContext: BuilderGenerationContext = {},
): BuilderFile[] {
  const slug = slugify(name);
  const wantsAuth = features.some((feature) => normalize(feature).includes("autentic"));
  const wantsPayment = features.some((feature) => normalize(feature).includes("pagamento"));
  const wantsDashboard = kind === "saas" || kind === "dashboard";

  const files: BuilderFile[] = buildGeneratedNextFiles(name, kind, features, prompt, brief, visionReferences);

  files.push(...buildGeneratedBackendFiles(slug, name, prompt, brief));
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
    description: "Schema Prisma completo para usuarios, sessoes, produtos, estoque, pedidos e agendamentos.",
    content: buildGeneratedPrismaSchema(),
  });

  files.push(...buildAiEngineFiles(name, kind, features, prompt, generationContext));

  return dedupeFiles(files);
}

function buildAiEngineFiles(
  name: string,
  kind: BuilderProject["kind"],
  features: string[],
  prompt: string,
  generationContext: BuilderGenerationContext,
): BuilderFile[] {
  const blueprint = generationContext.blueprint;
  const aiEngine = generationContext.aiEngine;
  const componentLibrary = unique([
    ...(blueprint?.componentLibrary ?? []),
    ...(blueprint?.components ?? []),
    "Header principal",
    "Footer institucional",
    "Cards de recursos",
    "Formulario de contato",
    "Modal de login",
    "Menu responsivo",
  ]).slice(0, 24);
  const aiPlan = [
    `# Plano de IA - ${name}`,
    "",
    `Tipo: ${kind}`,
    `Modelo: ${aiEngine?.usedExternal ? `${aiEngine.provider}/${aiEngine.model}` : "fallback local"}`,
    `Modo: ${aiEngine?.modelMode ?? "auto"} -> ${aiEngine?.resolvedMode ?? "equilibrado"}`,
    `Tarefa: ${aiEngine?.task ?? "generation"}`,
    "",
    "## Prompt Profissional",
    blueprint?.professionalPrompt || latestPromptIntent(prompt),
    "",
    "## Arquitetura",
    markdownList(blueprint?.architecture, ["Next.js App Router", "Route Handlers para integracoes externas", "Secrets somente no backend"]),
    "",
    "## Design e UX",
    markdownList(blueprint?.design, ["Primeira tela utilizavel", "Preview responsivo", "Componentes reaproveitaveis por nicho"]),
    "",
    "## Codigo",
    markdownList(blueprint?.code, ["Componentes tipados", "APIs com validacao", "Prisma preparado para producao"]),
    "",
    "## QA",
    markdownList(blueprint?.qaChecks, ["Rodar lint, typecheck e build", "Validar rotas principais", "Validar formularios e estados de erro"]),
    "",
    "## SEO",
    markdownList(blueprint?.seo, ["Metadata por pagina", "Sitemap", "Performance e indexacao"]),
  ].join("\n");

  const files: BuilderFile[] = [
    {
      path: "docs/ai-engine-plan.md",
      language: "md",
      description: "Plano consolidado pelo motor multi-IA com arquitetura, design, codigo, QA e SEO.",
      content: aiPlan,
    },
    {
      path: "docs/qa-checklist.md",
      language: "md",
      description: "Checklist de validacao do projeto gerado antes de entregar para producao.",
      content: [
        `# QA Checklist - ${name}`,
        "",
        ...[
          "Build Next.js sem erro.",
          "TypeScript sem erro.",
          "Preview HTML com viewport, body e conteudo principal.",
          "Rotas de API retornando JSON previsivel.",
          "Formularios com validacao e estado de erro.",
          "Nenhum token exposto no frontend.",
          ...(blueprint?.qaChecks ?? []),
        ].map((item) => `- [ ] ${item}`),
      ].join("\n"),
    },
    {
      path: "docs/seo-plan.md",
      language: "md",
      description: "Plano de SEO, metadados, sitemap e performance.",
      content: [
        `# SEO - ${name}`,
        "",
        ...[
          "Gerar title e description especificos por pagina.",
          "Criar sitemap.xml e robots.txt no deploy final.",
          "Usar imagens otimizadas e textos alternativos.",
          "Manter LCP rapido na primeira dobra.",
          ...(blueprint?.seo ?? []),
        ].map((item) => `- ${item}`),
      ].join("\n"),
    },
    {
      path: "src/lib/generated/component-library.ts",
      language: "ts",
      description: "Biblioteca propria de componentes reaproveitaveis salva pela IA.",
      content: `export const generatedComponentLibrary = ${JSON.stringify(
        componentLibrary.map((component) => ({
          name: component,
          category: categorizeGeneratedComponent(component),
          sourceProject: name,
          reusable: true,
        })),
        null,
        2,
      )} as const;\n`,
    },
    {
      path: "src/lib/generated/project-blueprint.ts",
      language: "ts",
      description: "Blueprint estruturado usado para gerar paginas, APIs, schemas e componentes.",
      content: `export const projectBlueprint = ${JSON.stringify(
        {
          name,
          kind,
          features,
          pages: blueprint?.pages ?? [],
          apis: blueprint?.apis ?? [],
          databaseModels: blueprint?.databaseModels ?? [],
          files: blueprint?.files?.map((file) => ({
            path: file.path,
            language: file.language,
            description: file.description,
          })) ?? [],
        },
        null,
        2,
      )} as const;\n`,
    },
  ];

  for (const artifact of blueprint?.files ?? []) {
    files.push({
      path: artifact.path,
      language: artifact.language,
      description: artifact.description,
      content: artifact.content || buildArtifactPlaceholder(artifact, name),
    });
  }

  return files;
}

function buildArtifactPlaceholder(
  artifact: NonNullable<AiGenerationBlueprint["files"]>[number],
  projectName: string,
) {
  if (artifact.language === "md") {
    return `# ${artifact.description}\n\nArquivo planejado pela IA para ${projectName}.\n`;
  }

  if (artifact.language === "prisma") {
    return `// ${artifact.description}\n// Integre este bloco ao schema Prisma principal conforme o modelo de dados do projeto.\n`;
  }

  if (artifact.language === "json") {
    return JSON.stringify({ description: artifact.description, projectName }, null, 2);
  }

  return `// ${artifact.description}\n// Arquivo planejado pela IA para ${projectName}. Complete a implementacao antes do deploy.\n`;
}

function dedupeFiles(files: BuilderFile[]) {
  const seen = new Set<string>();
  return files.filter((file) => {
    const key = file.path.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildGeneratedBackendFiles(
  slug: string,
  name: string,
  prompt: string,
  brief?: ProjectBrief,
): BuilderFile[] {
  const industry = detectIndustry(brief?.niche?.trim() || latestPromptIntent(prompt));
  const hasCommerce = shouldIncludeCommerce(industry);
  const hasScheduling = shouldIncludeScheduling(industry);

  return [
    {
      path: "package.json",
      language: "json",
      description: "Dependencias para rodar o projeto Next.js completo com Prisma.",
      content: JSON.stringify(
        {
          scripts: {
            dev: "next dev",
            build: "next build",
            start: "next start",
            "db:push": "prisma db push",
            "db:studio": "prisma studio",
          },
          dependencies: {
            "@prisma/client": "latest",
            bcryptjs: "latest",
            next: "latest",
            prisma: "latest",
            react: "latest",
            "react-dom": "latest",
            zod: "latest",
          },
          devDependencies: {
            "@tailwindcss/postcss": "latest",
            "@types/bcryptjs": "latest",
            "@types/node": "latest",
            "@types/react": "latest",
            "@types/react-dom": "latest",
            tailwindcss: "latest",
            typescript: "latest",
          },
        },
        null,
        2,
      ),
    },
    {
      path: ".env.example",
      language: "env",
      description: "Variaveis necessarias para banco, sessao e pagamentos.",
      content: `DATABASE_URL="postgresql://user:password@localhost:5432/${slug}"
AUTH_SECRET="troque-por-um-segredo-forte"
MERCADO_PAGO_ACCESS_TOKEN=""
NEXT_PUBLIC_SITE_NAME="${name}"
`,
    },
    {
      path: "src/app/layout.tsx",
      language: "tsx",
      description: "Layout raiz do projeto gerado.",
      content: `import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: process.env.NEXT_PUBLIC_SITE_NAME ?? "${name}",
  description: "Projeto completo com site, login, vendas, estoque e agendamentos.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
`,
    },
    {
      path: "src/app/globals.css",
      language: "css",
      description: "CSS global com Tailwind e estrutura visual exata do zszoro/Site.git.",
      content: `@import "tailwindcss";

${buildSiteTemplateCss()}
`,
    },
    {
      path: "postcss.config.mjs",
      language: "js",
      description: "Configuração PostCSS para Tailwind CSS 4.",
      content: `const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
`,
    },
    {
      path: "tsconfig.json",
      language: "json",
      description: "Configuração TypeScript para Next.js.",
      content: JSON.stringify(
        {
          compilerOptions: {
            target: "ES2017",
            lib: ["dom", "dom.iterable", "esnext"],
            allowJs: true,
            skipLibCheck: true,
            strict: true,
            noEmit: true,
            esModuleInterop: true,
            module: "esnext",
            moduleResolution: "bundler",
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: "react-jsx",
            incremental: true,
            paths: {
              "@/*": ["./src/*"],
            },
          },
          include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
          exclude: ["node_modules"],
        },
        null,
        2,
      ),
    },
    {
      path: "src/lib/server/db.ts",
      language: "ts",
      description: "Cliente Prisma com inicializacao lazy para build seguro.",
      content: `import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | null = null;

export function getDb() {
  if (!prisma) {
    prisma = new PrismaClient();
  }

  return prisma;
}
`,
    },
    {
      path: "src/lib/server/auth.ts",
      language: "ts",
      description: "Funcoes de autenticacao, senha e sessao para backend.",
      content: `import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { getDb } from "./db";

const sessionCookie = "app_session";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const db = getDb();
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  await db.session.create({ data: { token, userId, expiresAt } });
  const store = await cookies();
  store.set(sessionCookie, token, { httpOnly: true, sameSite: "lax", secure: true, path: "/", expires: expiresAt });
  return token;
}

export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(sessionCookie)?.value;
  if (!token) return null;
  const session = await getDb().session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}
`,
    },
    {
      path: "src/app/api/auth/register/route.ts",
      language: "ts",
      description: "Cadastro real com senha criptografada e sessao.",
      content: `import { z } from "zod";
import { createSession, hashPassword } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  const body = schema.parse(await request.json());
  const db = getDb();
  const user = await db.user.create({
    data: {
      name: body.name,
      email: body.email.toLowerCase(),
      passwordHash: await hashPassword(body.password),
    },
  });
  await createSession(user.id);
  return Response.json({ user: { id: user.id, name: user.name, email: user.email } }, { status: 201 });
}
`,
    },
    {
      path: "src/app/api/auth/login/route.ts",
      language: "ts",
      description: "Login funcional com cookie httpOnly.",
      content: `import { z } from "zod";
import { createSession, verifyPassword } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const body = schema.parse(await request.json());
  const user = await getDb().user.findUnique({ where: { email: body.email.toLowerCase() } });
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    return Response.json({ error: "Email ou senha invalidos" }, { status: 401 });
  }
  await createSession(user.id);
  return Response.json({ user: { id: user.id, name: user.name, email: user.email } });
}
`,
    },
    {
      path: "src/app/api/me/route.ts",
      language: "ts",
      description: "Endpoint para recuperar usuario autenticado.",
      content: `import { getCurrentUser } from "@/lib/server/auth";

export async function GET() {
  const user = await getCurrentUser();
  return Response.json({ user: user ? { id: user.id, name: user.name, email: user.email } : null });
}
`,
    },
    {
      path: "src/app/api/products/route.ts",
      language: "ts",
      description: hasCommerce ? "CRUD base de produtos para vendas e estoque." : "Catalogo de servicos/produtos pronto para evoluir.",
      content: `import { z } from "zod";
import { getCurrentUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";

const schema = z.object({
  name: z.string().min(2),
  category: z.string().min(2),
  price: z.number().nonnegative(),
  stock: z.number().int().nonnegative().default(0),
});

export async function GET() {
  const products = await getDb().product.findMany({ orderBy: { createdAt: "desc" } });
  return Response.json({ products });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Nao autenticado" }, { status: 401 });
  const body = schema.parse(await request.json());
  const product = await getDb().product.create({ data: body });
  return Response.json({ product }, { status: 201 });
}
`,
    },
    {
      path: "src/app/api/orders/route.ts",
      language: "ts",
      description: "Pedidos de venda com baixa de estoque em transacao.",
      content: `import { z } from "zod";
import { getCurrentUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";

const itemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
});

const schema = z.object({
  customerName: z.string().min(2),
  customerPhone: z.string().min(8),
  items: z.array(itemSchema).min(1),
});

export async function GET() {
  const orders = await getDb().order.findMany({ include: { items: true }, orderBy: { createdAt: "desc" } });
  return Response.json({ orders });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Nao autenticado" }, { status: 401 });
  const body = schema.parse(await request.json());
  const db = getDb();
  const order = await db.$transaction(async (tx) => {
    const products = await tx.product.findMany({ where: { id: { in: body.items.map((item) => item.productId) } } });
    const total = body.items.reduce((sum, item) => {
      const product = products.find((entry) => entry.id === item.productId);
      if (!product) throw new Error("Produto nao encontrado");
      if (product.stock < item.quantity) throw new Error("Estoque insuficiente");
      return sum + product.price * item.quantity;
    }, 0);
    const created = await tx.order.create({ data: { customerName: body.customerName, customerPhone: body.customerPhone, total } });
    for (const item of body.items) {
      const product = products.find((entry) => entry.id === item.productId);
      if (!product) continue;
      await tx.orderItem.create({ data: { orderId: created.id, productId: item.productId, quantity: item.quantity, unitPrice: product.price } });
      await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } });
      await tx.stockMovement.create({ data: { productId: item.productId, type: "SALE", quantity: -item.quantity, reason: "Venda " + created.id } });
    }
    return created;
  });
  return Response.json({ order }, { status: 201 });
}
`,
    },
    {
      path: "src/app/api/appointments/route.ts",
      language: "ts",
      description: hasScheduling ? "Agendamento completo com status, horario e cliente." : "Agenda pronta para servicos, consultas ou reservas.",
      content: `import { z } from "zod";
import { getCurrentUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";

const schema = z.object({
  customerName: z.string().min(2),
  customerPhone: z.string().min(8),
  service: z.string().min(2),
  startsAt: z.string().datetime(),
});

export async function GET() {
  const appointments = await getDb().appointment.findMany({ orderBy: { startsAt: "asc" } });
  return Response.json({ appointments });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Nao autenticado" }, { status: 401 });
  const body = schema.parse(await request.json());
  const appointment = await getDb().appointment.create({
    data: { ...body, startsAt: new Date(body.startsAt), status: "SCHEDULED" },
  });
  return Response.json({ appointment }, { status: 201 });
}
`,
    },
    {
      path: "src/app/admin/page.tsx",
      language: "tsx",
      description: "Painel administrativo inicial para produtos, vendas, estoque e agenda.",
      content: `const sections = [
  "Produtos e estoque",
  "Pedidos e vendas",
  "Agendamentos",
  "Clientes",
];

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <section className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-black">Painel administrativo</h1>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {sections.map((section) => (
            <article className="rounded-xl border border-white/10 bg-white/5 p-5" key={section}>
              <h2 className="font-black">{section}</h2>
              <p className="mt-2 text-sm text-zinc-400">Modulo pronto para conectar com as APIs geradas.</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
`,
    },
  ];
}

function shouldIncludeCommerce(industry: string) {
  const normalized = normalize(industry);
  return ["padaria", "loja", "roupa", "restaurante", "oficina"].some((item) => normalized.includes(item));
}

function shouldIncludeScheduling(industry: string) {
  const normalized = normalize(industry);
  return ["barbearia", "clinica", "odont", "oficina", "academia", "restaurante"].some((item) => normalized.includes(item));
}

function buildSiteTemplateCss() {
  return `:root {
  --cream: #fff8ea;
  --cream-strong: #f8ead1;
  --sand: #e9c99b;
  --honey: #d99522;
  --honey-dark: #aa6918;
  --brown: #3b2518;
  --brown-soft: #6f4f36;
  --terracotta: #b85f3a;
  --sage: #69755d;
  --white: #fffdf8;
  --border: rgba(76, 45, 25, 0.14);
  --shadow: 0 18px 50px rgba(92, 51, 20, 0.14);
  --shadow-soft: 0 12px 30px rgba(92, 51, 20, 0.1);
  --radius: 8px;
  --radius-lg: 22px;
  --header-height: 82px;
  --container: min(1120px, calc(100vw - 40px));
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--brown);
  background: var(--cream);
}

* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background:
    radial-gradient(circle at top left, rgba(217, 149, 34, 0.12), transparent 30rem),
    linear-gradient(180deg, var(--cream), #fffdf8 42%, #f9edd8 100%);
  color: var(--brown);
}
body.nav-open { overflow: hidden; }
img { display: block; max-width: 100%; }
a { color: inherit; text-decoration: none; }
button, a { -webkit-tap-highlight-color: transparent; }
button { font: inherit; }
.generated-site-shell {
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--honey) 14%, transparent), transparent 30rem),
    linear-gradient(180deg, var(--cream), var(--white) 42%, var(--cream-strong) 100%);
  color: var(--brown);
}

.site-header {
  position: fixed;
  inset: 0 0 auto;
  z-index: 20;
  height: var(--header-height);
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 24px;
  padding: 0 max(24px, calc((100vw - 1120px) / 2));
  background: color-mix(in srgb, var(--cream) 86%, white 14%);
  border-bottom: 1px solid rgba(76, 45, 25, 0.08);
  backdrop-filter: blur(18px);
  transition: box-shadow 180ms ease, background 180ms ease;
}
.brand { display: inline-flex; align-items: center; gap: 12px; min-width: 206px; }
.brand__mark {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 50%;
  background: var(--brown);
  color: var(--cream);
  font-family: "Playfair Display", Georgia, serif;
  font-size: 1.35rem;
  font-weight: 800;
  box-shadow: 0 10px 24px rgba(59, 37, 24, 0.18);
}
.brand__text { display: grid; line-height: 1.1; }
.brand__text strong { font-size: 1rem; letter-spacing: 0; }
.brand__text small { color: var(--brown-soft); font-size: 0.76rem; margin-top: 3px; }
.main-nav {
  justify-self: center;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: rgba(255, 253, 248, 0.62);
}
.main-nav a {
  border-radius: 999px;
  color: var(--brown-soft);
  font-size: 0.91rem;
  font-weight: 700;
  padding: 10px 13px;
  transition: color 180ms ease, background 180ms ease;
}
.main-nav a:hover, .main-nav a:focus-visible {
  color: var(--brown);
  background: color-mix(in srgb, var(--honey) 18%, transparent);
}
.header-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
.header-cta, .button, .login-cta, .cart-toggle, .product-card__cart {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 46px;
  border: 0;
  border-radius: 999px;
  font-size: 0.94rem;
  font-weight: 800;
  letter-spacing: 0;
  cursor: pointer;
  transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease, color 180ms ease;
}
.header-cta, .button--primary {
  color: #fffdf8;
  background: linear-gradient(135deg, var(--honey), var(--terracotta));
  box-shadow: 0 14px 28px rgba(184, 95, 58, 0.22);
}
.header-cta { padding: 0 18px; white-space: nowrap; }
.login-cta, .cart-toggle {
  min-height: 42px;
  padding: 0 14px;
  border: 1px solid rgba(59, 37, 24, 0.14);
  background: rgba(255, 253, 248, 0.76);
  color: var(--brown);
}
.cart-toggle span {
  display: inline-grid;
  min-width: 22px;
  min-height: 22px;
  place-items: center;
  margin-left: 7px;
  border-radius: 999px;
  background: var(--brown);
  color: var(--cream);
  font-size: 0.72rem;
}
.button { padding: 0 22px; }
.button--secondary {
  color: var(--brown);
  background: rgba(255, 253, 248, 0.76);
  border: 1px solid rgba(59, 37, 24, 0.16);
}
.header-cta:hover, .button:hover, .login-cta:hover, .cart-toggle:hover, .product-card__cart:hover { transform: translateY(-2px); }
.button--primary:hover, .header-cta:hover { box-shadow: 0 18px 34px rgba(184, 95, 58, 0.28); }
.button--secondary:hover, .login-cta:hover, .cart-toggle:hover { background: var(--white); box-shadow: var(--shadow-soft); }
.nav-toggle {
  display: none;
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 5px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--white);
  color: var(--brown);
  cursor: pointer;
}
.nav-toggle span {
  width: 18px;
  height: 2px;
  border-radius: 999px;
  background: currentColor;
  transition: transform 180ms ease, opacity 180ms ease;
}
.nav-toggle.is-active span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
.nav-toggle.is-active span:nth-child(2) { opacity: 0; }
.nav-toggle.is-active span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

.section {
  width: var(--container);
  margin-inline: auto;
  scroll-margin-top: calc(var(--header-height) + 24px);
}
.hero {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(420px, 1.05fr);
  align-items: center;
  gap: 54px;
  padding-top: calc(var(--header-height) + 34px);
  padding-bottom: 86px;
}
.hero__content h1 {
  margin: 0;
  max-width: 660px;
  font-family: "Playfair Display", Georgia, serif;
  font-size: clamp(3rem, 8vw, 5.7rem);
  line-height: 0.94;
  letter-spacing: 0;
}
.hero__content p {
  max-width: 540px;
  margin: 24px 0 0;
  color: var(--brown-soft);
  font-size: clamp(1.05rem, 2vw, 1.24rem);
  line-height: 1.72;
}
.hero__actions { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 34px; }
.hero__media { position: relative; }
.hero__media img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 32px 8px 32px 8px;
  box-shadow: 0 28px 70px rgba(73, 38, 15, 0.2);
}
.hero__note {
  position: absolute;
  right: clamp(14px, 4vw, 36px);
  bottom: -24px;
  display: grid;
  gap: 3px;
  width: min(230px, calc(100% - 28px));
  padding: 18px;
  border: 1px solid rgba(59, 37, 24, 0.12);
  border-radius: var(--radius);
  background: rgba(255, 253, 248, 0.92);
  box-shadow: var(--shadow);
  backdrop-filter: blur(16px);
}
.hero__note strong { font-size: 1rem; }
.hero__note span { color: var(--brown-soft); font-size: 0.88rem; }
.section-heading { max-width: 680px; margin-bottom: 34px; }
.section-heading--center { margin-inline: auto; text-align: center; }
.section-heading__line {
  display: block;
  width: 54px;
  height: 3px;
  margin-bottom: 16px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--honey), var(--terracotta));
}
.section-heading--center .section-heading__line { margin-inline: auto; }
.section-heading h2 {
  margin: 0;
  font-family: "Playfair Display", Georgia, serif;
  font-size: clamp(2.2rem, 5vw, 3.9rem);
  line-height: 1;
  letter-spacing: 0;
}
.section-heading p {
  margin: 18px 0 0;
  color: var(--brown-soft);
  font-size: 1.02rem;
  line-height: 1.72;
}
.about, .products, .testimonials, .contact { padding-block: 84px; }
.about__grid {
  display: grid;
  grid-template-columns: minmax(280px, 0.86fr) minmax(0, 1.14fr);
  gap: 28px;
  align-items: stretch;
}
.about__story, .feature-card, .product-card, .testimonial-card, .map-card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: rgba(255, 253, 248, 0.78);
  box-shadow: var(--shadow-soft);
}
.about__story {
  display: grid;
  align-content: end;
  min-height: 360px;
  padding: 34px;
  background:
    linear-gradient(180deg, rgba(255, 253, 248, 0.62), rgba(248, 234, 209, 0.9)),
    radial-gradient(circle at top right, rgba(105, 117, 93, 0.2), transparent 16rem);
}
.about__story h3 { margin: 0 0 14px; font-size: 1.42rem; }
.about__story p, .feature-card p, .product-card p, .testimonial-card p { margin: 0; color: var(--brown-soft); line-height: 1.68; }
.feature-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.feature-card { padding: 24px; transition: transform 180ms ease, box-shadow 180ms ease; }
.feature-card:hover, .product-card:hover, .testimonial-card:hover { transform: translateY(-4px); box-shadow: var(--shadow); }
.feature-card__icon {
  display: inline-grid;
  width: 42px;
  height: 42px;
  place-items: center;
  margin-bottom: 28px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--honey) 14%, transparent);
  color: var(--honey-dark);
  font-size: 0.82rem;
  font-weight: 800;
}
.feature-card h3 { margin: 0 0 10px; font-size: 1.12rem; }
.menu-panel {
  padding: 28px;
  border: 1px solid rgba(59, 37, 24, 0.13);
  border-radius: var(--radius-lg);
  background:
    linear-gradient(180deg, rgba(255, 253, 248, 0.78), rgba(255, 248, 234, 0.9)),
    radial-gradient(circle at bottom right, color-mix(in srgb, var(--honey) 18%, transparent), transparent 24rem);
  box-shadow: var(--shadow-soft);
}
.category-tabs { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 8px; scrollbar-width: thin; }
.category-tabs button {
  flex: 0 0 auto;
  min-height: 42px;
  padding: 0 18px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--white);
  color: var(--brown-soft);
  font: inherit;
  font-size: 0.91rem;
  font-weight: 800;
  cursor: pointer;
  transition: background 180ms ease, color 180ms ease, border-color 180ms ease;
}
.category-tabs button:hover, .category-tabs button.is-active { border-color: color-mix(in srgb, var(--honey) 45%, transparent); background: var(--brown); color: var(--cream); }
.product-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; margin-top: 24px; }
.product-card { overflow: hidden; background: var(--white); transition: transform 180ms ease, box-shadow 180ms ease; }
.product-card__media { min-height: 188px; background-repeat: no-repeat; }
.product-card__body { display: grid; gap: 12px; padding: 20px; }
.product-card__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
.product-card h3 { margin: 0; font-size: 1.12rem; line-height: 1.2; }
.product-card__price { color: var(--terracotta); font-weight: 900; white-space: nowrap; }
.product-card__category {
  width: fit-content;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(105, 117, 93, 0.12);
  color: var(--sage);
  font-size: 0.78rem;
  font-weight: 800;
}
.product-card__cart {
  min-height: 42px;
  width: 100%;
  background: var(--brown);
  color: var(--cream);
}
.promo {
  display: grid;
  grid-template-columns: minmax(0, 0.86fr) minmax(280px, 0.52fr);
  gap: 32px;
  align-items: center;
  width: min(1180px, calc(100vw - 40px));
  padding: 52px;
  border-radius: 28px;
  background: linear-gradient(135deg, var(--brown), color-mix(in srgb, var(--brown) 78%, var(--terracotta)) 58%, var(--terracotta)), var(--brown);
  color: var(--cream);
  box-shadow: 0 28px 80px rgba(59, 37, 24, 0.22);
}
.promo__content h2 { margin: 0; font-family: "Playfair Display", Georgia, serif; font-size: clamp(2.4rem, 5vw, 4rem); line-height: 1; letter-spacing: 0; }
.promo__content p { max-width: 560px; margin: 18px 0 0; color: rgba(255, 248, 234, 0.78); font-size: 1.06rem; line-height: 1.7; }
.promo__meta { display: flex; align-items: baseline; gap: 12px; margin: 24px 0; }
.promo__meta span { color: rgba(255, 248, 234, 0.68); font-weight: 700; }
.promo__meta strong { color: #ffd37b; font-size: 2rem; }
.promo .button--primary { background: linear-gradient(135deg, #f2b842, var(--honey)); color: var(--brown); }
.promo__visual { min-height: 290px; }
.sprite-image {
  width: 100%;
  height: 100%;
  min-height: 290px;
  border: 8px solid rgba(255, 248, 234, 0.18);
  border-radius: 8px 28px 8px 28px;
  background-repeat: no-repeat;
  box-shadow: 0 24px 55px rgba(0, 0, 0, 0.22);
}
.testimonial-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
.testimonial-card { display: grid; gap: 18px; padding: 24px; transition: transform 180ms ease, box-shadow 180ms ease; }
.testimonial-card__rating { color: var(--honey-dark); letter-spacing: 0; font-size: 1.05rem; }
.testimonial-card__author { display: grid; gap: 2px; }
.testimonial-card__author strong { font-size: 1rem; }
.testimonial-card__author span { color: var(--brown-soft); font-size: 0.88rem; }
.contact { display: grid; grid-template-columns: minmax(0, 0.8fr) minmax(320px, 1fr); gap: 34px; align-items: stretch; }
.contact-list { display: grid; gap: 14px; }
.contact-list article { display: grid; gap: 6px; padding: 18px 20px; border-left: 3px solid var(--honey); border-radius: var(--radius); background: rgba(255, 253, 248, 0.74); box-shadow: var(--shadow-soft); }
.contact-list strong { font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0; }
.contact-list span { color: var(--brown-soft); line-height: 1.55; }
.contact-whatsapp { margin-top: 24px; }
.map-card {
  position: relative;
  display: grid;
  min-height: 410px;
  place-content: center;
  gap: 8px;
  overflow: hidden;
  text-align: center;
  background:
    linear-gradient(rgba(255, 253, 248, 0.72), rgba(255, 253, 248, 0.82)),
    repeating-linear-gradient(0deg, transparent 0 38px, rgba(59, 37, 24, 0.08) 38px 40px),
    repeating-linear-gradient(90deg, transparent 0 38px, rgba(59, 37, 24, 0.08) 38px 40px),
    var(--cream-strong);
}
.map-card::before, .map-card::after { content: ""; position: absolute; border-radius: 999px; background: rgba(184, 95, 58, 0.18); }
.map-card::before { width: 210px; height: 210px; right: -64px; top: -72px; }
.map-card::after { width: 140px; height: 140px; left: -48px; bottom: -48px; }
.map-card__pin { position: relative; z-index: 1; width: 42px; height: 42px; margin: 0 auto 8px; border-radius: 50% 50% 50% 0; background: var(--terracotta); transform: rotate(-45deg); box-shadow: 0 12px 24px rgba(184, 95, 58, 0.2); }
.map-card__pin::after { content: ""; position: absolute; inset: 12px; border-radius: 50%; background: var(--cream); }
.map-card strong, .map-card span { position: relative; z-index: 1; }
.map-card strong { font-size: 1.32rem; }
.map-card span { color: var(--brown-soft); }
.site-footer {
  width: var(--container);
  margin: 40px auto 0;
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 24px;
  padding: 32px 0 42px;
  border-top: 1px solid var(--border);
}
.footer__brand { display: grid; gap: 4px; }
.footer__brand strong { font-family: "Playfair Display", Georgia, serif; font-size: 1.4rem; }
.footer__brand span, .site-footer p { color: var(--brown-soft); font-size: 0.9rem; }
.footer__links, .footer__social { display: flex; align-items: center; gap: 12px; }
.footer__links a { color: var(--brown-soft); font-size: 0.9rem; font-weight: 700; }
.footer__links a:hover { color: var(--brown); }
.footer__social a { display: grid; width: 38px; height: 38px; place-items: center; border-radius: 50%; background: rgba(59, 37, 24, 0.08); color: var(--brown); font-size: 0.78rem; font-weight: 900; }
.site-footer p { grid-column: 1 / -1; margin: 0; }
.reveal { opacity: 0; transform: translateY(22px); transition: opacity 580ms ease, transform 580ms ease; transition-delay: var(--delay, 0ms); }
.reveal.is-visible, .generated-site-shell .reveal { opacity: 1; transform: translateY(0); }
.auth-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(35, 22, 12, 0.52);
  backdrop-filter: blur(16px);
}
.auth-backdrop[hidden], .cart-drawer[hidden] { display: none !important; }
.auth-modal, .cart-drawer {
  position: relative;
  width: min(420px, calc(100vw - 32px));
  border: 1px solid var(--border);
  border-radius: 22px;
  background: rgba(255, 253, 248, 0.96);
  box-shadow: 0 28px 80px rgba(59, 37, 24, 0.22);
  padding: 28px;
}
.auth-modal h2, .cart-drawer h2 { margin: 0; font-family: "Playfair Display", Georgia, serif; font-size: 2.2rem; line-height: 1; }
.auth-modal p, .cart-drawer p { color: var(--brown-soft); line-height: 1.6; }
.auth-modal form { display: grid; gap: 14px; margin-top: 20px; }
.auth-modal label { display: grid; gap: 7px; color: var(--brown-soft); font-size: 0.88rem; font-weight: 800; }
.auth-modal input {
  min-height: 44px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--white);
  color: var(--brown);
  padding: 0 12px;
  outline: none;
}
.auth-status { color: var(--terracotta); font-size: 0.86rem; }
.auth-switch { margin-top: 14px; border: 0; background: transparent; color: var(--brown-soft); cursor: pointer; font-weight: 800; }
.modal-close {
  position: absolute;
  right: 14px;
  top: 14px;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--white);
  color: var(--brown);
  cursor: pointer;
  font-size: 1.2rem;
}
.cart-drawer {
  position: fixed;
  z-index: 55;
  top: calc(var(--header-height) + 18px);
  right: max(20px, calc((100vw - 1120px) / 2));
  max-height: calc(100vh - 120px);
  overflow: auto;
}
.cart-list { display: grid; gap: 12px; margin-top: 18px; }
.cart-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--white); }
.cart-item div:first-child { display: grid; gap: 4px; }
.cart-item span { color: var(--brown-soft); font-size: 0.88rem; }
.cart-controls { display: inline-flex; align-items: center; gap: 8px; }
.cart-controls button { width: 30px; height: 30px; border: 0; border-radius: 50%; background: var(--brown); color: var(--cream); cursor: pointer; }
.cart-total { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-top: 1px solid var(--border); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition-duration: 1ms !important; animation-duration: 1ms !important; }
}
@media (max-width: 1040px) {
  .site-header { grid-template-columns: auto auto auto; }
  .main-nav {
    position: fixed;
    top: calc(var(--header-height) + 10px);
    right: 20px;
    left: 20px;
    display: grid;
    justify-items: stretch;
    padding: 16px;
    border-radius: var(--radius-lg);
    background: rgba(255, 253, 248, 0.98);
    box-shadow: var(--shadow);
    transform: translateY(-10px);
    opacity: 0;
    pointer-events: none;
  }
  .main-nav.is-open { transform: translateY(0); opacity: 1; pointer-events: auto; }
  .main-nav a { padding: 13px 14px; }
  .nav-toggle { display: inline-flex; justify-self: end; }
  .header-actions { justify-self: end; }
  .hero { grid-template-columns: 1fr; min-height: auto; }
  .hero__content { max-width: 760px; }
  .about__grid, .promo, .contact { grid-template-columns: 1fr; }
  .product-grid, .testimonial-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .site-footer { grid-template-columns: 1fr; }
}
@media (max-width: 720px) {
  :root { --header-height: 72px; --container: min(100vw - 28px, 1120px); }
  .site-header { gap: 10px; padding-inline: 14px; }
  .brand { min-width: 0; }
  .brand__mark { width: 38px; height: 38px; }
  .brand__text small, .header-cta { display: none; }
  .login-cta, .cart-toggle { min-height: 40px; padding: 0 10px; font-size: 0.78rem; }
  .hero { gap: 36px; padding-top: calc(var(--header-height) + 44px); padding-bottom: 58px; }
  .hero__content h1 { font-size: clamp(2.68rem, 16vw, 4.2rem); }
  .hero__actions { display: grid; }
  .hero__media img { aspect-ratio: 1 / 1; border-radius: 24px 8px 24px 8px; }
  .hero__note { position: static; margin: -20px 14px 0 auto; }
  .about, .products, .testimonials, .contact { padding-block: 58px; }
  .feature-grid, .product-grid, .testimonial-grid { grid-template-columns: 1fr; }
  .about__story, .feature-card, .testimonial-card { padding: 22px; }
  .menu-panel { padding: 18px; border-radius: 18px; }
  .product-card__media { min-height: 210px; }
  .promo { width: var(--container); padding: 30px 22px; border-radius: 20px; }
  .map-card { min-height: 330px; }
  .footer__links { flex-wrap: wrap; }
  .cart-drawer { inset-inline: 14px; right: 14px; width: auto; }
}
@media (max-width: 420px) {
  .brand__text strong { max-width: 118px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nav-toggle { width: 40px; height: 40px; }
}`;
}

function buildGeneratedPrismaSchema() {
  return `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String        @id @default(cuid())
  email        String        @unique
  name         String
  passwordHash String
  role         String        @default("USER")
  sessions     Session[]
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
}

model Session {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model Product {
  id          String          @id @default(cuid())
  name        String
  category    String
  description String?
  price       Float
  stock       Int             @default(0)
  active      Boolean         @default(true)
  items       OrderItem[]
  movements   StockMovement[]
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
}

model StockMovement {
  id        String   @id @default(cuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  type      String
  quantity  Int
  reason    String?
  createdAt DateTime @default(now())
}

model Order {
  id            String      @id @default(cuid())
  customerName  String
  customerPhone String
  status        String      @default("PENDING")
  total         Float
  items         OrderItem[]
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
}

model OrderItem {
  id        String  @id @default(cuid())
  orderId   String
  order     Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId String
  product   Product @relation(fields: [productId], references: [id])
  quantity  Int
  unitPrice Float
}

model Appointment {
  id            String   @id @default(cuid())
  customerName  String
  customerPhone String
  service       String
  startsAt      DateTime
  status        String   @default("SCHEDULED")
  notes         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
`;
}

function buildGeneratedNextFiles(
  name: string,
  kind: BuilderProject["kind"],
  features: string[],
  prompt: string,
  brief?: ProjectBrief,
  visionReferences: BuilderVisionReference[] = [],
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
      path: `src/components/generated/${slug}/LoginRegisterModal.tsx`,
      language: "tsx",
      description: "Login e cadastro local funcionais, abertos somente por Entrar ou compra.",
      content: buildGeneratedLoginRegisterModalSource(slug),
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
      content: buildGeneratedConfigSource(name, kind, features, prompt, brief, visionReferences),
    },
    {
      path: `src/lib/generated/${slug}-local-auth.ts`,
      language: "ts",
      description: "Autenticacao local em localStorage para demo sem backend obrigatorio.",
      content: buildGeneratedLocalAuthSource(),
    },
  ];
}

function buildGeneratedSiteIndexSource(slug: string, component: string) {
  return `"use client";

import type { CSSProperties, FormEvent } from "react";
import { useMemo, useState } from "react";
import { clearStoredUser, getStoredUser, type LocalAuthUser } from "@/lib/generated/${slug}-local-auth";
import { generatedSiteConfig, type GeneratedSiteConfig } from "@/lib/generated/${slug}-config";
import { ContactSection } from "./ContactSection";
import { Features } from "./Features";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { Hero } from "./Hero";
import { LoginRegisterModal } from "./LoginRegisterModal";
import { SiteEditor } from "./SiteEditor";

type Product = GeneratedSiteConfig["products"][number];

type CartItem = {
  product: Product;
  quantity: number;
};

export function ${component}() {
  const [site, setSite] = useState<GeneratedSiteConfig>(generatedSiteConfig);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState<"header" | "purchase">("header");
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [authUser, setAuthUser] = useState<LocalAuthUser | null>(() =>
    getStoredUser(generatedSiteConfig.auth.storageKey),
  );

  const whatsappHref = useMemo(() => {
    const digits = site.contact.whatsapp.replace(/\\D/g, "");

    if (digits.length < 10) {
      return "#contato";
    }

    return "https://wa.me/" + digits + "?text=" + encodeURIComponent(site.whatsappMessage);
  }, [site.contact.whatsapp, site.whatsappMessage]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + priceToNumber(item.product.price) * item.quantity, 0);

  const checkoutHref = useMemo(() => {
    const digits = site.contact.whatsapp.replace(/\\D/g, "");
    if (digits.length < 10 || cart.length === 0) return whatsappHref;

    const lines = cart.map((item) => "- " + item.quantity + "x " + item.product.name + " (" + item.product.price + ")");
    const message = [
      "Olá, vim pelo site da " + site.name + " e quero finalizar este pedido:",
      ...lines,
      "Total aproximado: " + formatCurrency(cartTotal),
    ].join("\\n");

    return "https://wa.me/" + digits + "?text=" + encodeURIComponent(message);
  }, [cart, cartTotal, site.contact.whatsapp, site.name, whatsappHref]);

  function updateSite<Key extends keyof GeneratedSiteConfig>(
    key: Key,
    value: GeneratedSiteConfig[Key],
  ) {
    setSite((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function commitAddToCart(product: Product) {
    setCart((current) => {
      const existing = current.find((item) => item.product.name === product.name);
      if (existing) {
        return current.map((item) =>
          item.product.name === product.name ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }

      return [...current, { product, quantity: 1 }];
    });
    setIsCartOpen(true);
  }

  function requestAuth(reason: "header" | "purchase", product?: Product) {
    if (!site.auth.enabled) return false;
    setAuthReason(reason);
    setPendingProduct(product ?? null);
    setIsAuthOpen(true);
    return true;
  }

  function addToCart(product: Product) {
    if (site.auth.enabled && site.auth.requireForPurchase && !authUser) {
      requestAuth("purchase", product);
      return;
    }

    commitAddToCart(product);
  }

  function handleAuthSuccess(user: LocalAuthUser) {
    setAuthUser(user);
    setIsAuthOpen(false);

    if (pendingProduct) {
      commitAddToCart(pendingProduct);
      setPendingProduct(null);
    }
  }

  function logout() {
    clearStoredUser(site.auth.storageKey);
    setAuthUser(null);
  }

  function updateCartQuantity(productName: string, quantity: number) {
    setCart((current) =>
      current
        .map((item) => (item.product.name === productName ? { ...item, quantity } : item))
        .filter((item) => item.quantity > 0),
    );
  }

  return (
    <main
      className="generated-site-shell"
      style={
        {
          "--cream": site.theme.background,
          "--cream-strong": site.theme.backgroundSoft,
          "--white": site.theme.card,
          "--honey": site.theme.primary,
          "--honey-dark": site.theme.primaryDark,
          "--terracotta": site.theme.primaryDark,
          "--brown": site.theme.text,
          "--brown-soft": site.theme.muted,
          "--border": site.theme.border,
          "--shadow": site.theme.shadow,
        } as CSSProperties
      }
    >
      <Header
        cartCount={cartCount}
        authEnabled={site.auth.enabled}
        authUserName={authUser?.name}
        site={site}
        whatsappHref={whatsappHref}
        onCartClick={() => setIsCartOpen(true)}
        onLoginClick={() => requestAuth("header")}
        onLogoutClick={logout}
      />
      <Hero site={site} whatsappHref={whatsappHref} />
      <Features site={site} whatsappHref={whatsappHref} onAddToCart={addToCart} />
      <ContactSection site={site} whatsappHref={whatsappHref} />
      <Footer site={site} />
      {site.auth.enabled && isAuthOpen ? (
        <LoginRegisterModal
          reason={authReason}
          site={site}
          onClose={() => {
            setIsAuthOpen(false);
            setPendingProduct(null);
          }}
          onSuccess={handleAuthSuccess}
        />
      ) : null}
      <CartDrawer
        cart={cart}
        checkoutHref={checkoutHref}
        isOpen={isCartOpen}
        total={cartTotal}
        onClose={() => setIsCartOpen(false)}
        onQuantityChange={updateCartQuantity}
      />
      <SiteEditor site={site} onUpdate={updateSite} />
    </main>
  );
}

function priceToNumber(price: string) {
  const normalized = price
    .replace(/[^\\d,.-]/g, "")
    .replace(/\\.(?=\\d{3})/g, "")
    .replace(",", ".");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function AuthModal({ site, onClose }: { site: GeneratedSiteConfig; onClose: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [status, setStatus] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();

    if (!email.includes("@") || password.length < 6 || (mode === "register" && name.length < 2)) {
      setStatus("Preencha os dados corretamente para continuar.");
      return;
    }

    setStatus(mode === "login" ? "Login pronto para conectar ao backend." : "Conta cadastrada na interface. Conecte ao endpoint /api/auth/register.");
  }

  return (
    <div className="auth-backdrop" role="dialog" aria-modal="true" aria-label="Entrar na conta">
      <section className="auth-modal">
        <button className="modal-close" onClick={onClose} type="button" aria-label="Fechar login">
          ×
        </button>
        <span className="section-heading__line" />
        <h2>{mode === "login" ? "Entrar em " + site.name : "Criar conta"}</h2>
        <p>
          Acesso preparado para clientes acompanharem pedidos, compras e agendamentos.
        </p>
        <form onSubmit={submit}>
          {mode === "register" ? (
            <label>
              Nome
              <input name="name" placeholder="Seu nome" />
            </label>
          ) : null}
          <label>
            Email
            <input name="email" placeholder="voce@email.com" type="email" />
          </label>
          <label>
            Senha
            <input name="password" placeholder="Minimo 6 caracteres" type="password" />
          </label>
          {status ? <strong className="auth-status">{status}</strong> : null}
          <button className="button button--primary" type="submit">
            {mode === "login" ? "Entrar" : "Cadastrar"}
          </button>
        </form>
        <button className="auth-switch" onClick={() => setMode(mode === "login" ? "register" : "login")} type="button">
          {mode === "login" ? "Não tenho conta, cadastrar" : "Já tenho conta, entrar"}
        </button>
      </section>
    </div>
  );
}

function CartDrawer(props: {
  cart: CartItem[];
  checkoutHref: string;
  isOpen: boolean;
  total: number;
  onClose: () => void;
  onQuantityChange: (productName: string, quantity: number) => void;
}) {
  if (!props.isOpen) return null;

  return (
    <aside className="cart-drawer" aria-label="Carrinho">
      <button className="modal-close" onClick={props.onClose} type="button" aria-label="Fechar carrinho">
        ×
      </button>
      <span className="section-heading__line" />
      <h2>Carrinho</h2>
      {props.cart.length === 0 ? (
        <p>Adicione produtos para montar o pedido.</p>
      ) : (
        <div className="cart-list">
          {props.cart.map((item) => (
            <article className="cart-item" key={item.product.name}>
              <div>
                <strong>{item.product.name}</strong>
                <span>{item.product.price}</span>
              </div>
              <div className="cart-controls">
                <button onClick={() => props.onQuantityChange(item.product.name, item.quantity - 1)} type="button">-</button>
                <span>{item.quantity}</span>
                <button onClick={() => props.onQuantityChange(item.product.name, item.quantity + 1)} type="button">+</button>
              </div>
            </article>
          ))}
          <div className="cart-total">
            <span>Total</span>
            <strong>{formatCurrency(props.total)}</strong>
          </div>
          <a className="button button--primary" href={props.checkoutHref} target="_blank" rel="noreferrer">
            Finalizar pedido
          </a>
        </div>
      )}
    </aside>
  );
}
`;
}

function buildGeneratedLocalAuthSource() {
  return `export type LocalAuthUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

type LocalAuthRecord = LocalAuthUser & {
  passwordHash: string;
};

type AuthResult =
  | { ok: true; user: LocalAuthUser }
  | { ok: false; error: string };

function usersKey(storageKey: string) {
  return storageKey + ":users";
}

function activeKey(storageKey: string) {
  return storageKey + ":active";
}

export function getStoredUser(storageKey: string): LocalAuthUser | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(activeKey(storageKey));
    return raw ? (JSON.parse(raw) as LocalAuthUser) : null;
  } catch {
    return null;
  }
}

export function clearStoredUser(storageKey: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(activeKey(storageKey));
}

export function registerLocalUser(
  storageKey: string,
  input: { name: string; email: string; password: string },
): AuthResult {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  if (name.length < 2) return { ok: false, error: "Digite seu nome." };
  if (!email.includes("@")) return { ok: false, error: "Digite um email valido." };
  if (input.password.length < 6) return { ok: false, error: "A senha precisa ter pelo menos 6 caracteres." };

  const users = readUsers(storageKey);
  if (users.some((user) => user.email === email)) {
    return { ok: false, error: "Esse email ja tem cadastro local. Entre com a senha." };
  }

  const user: LocalAuthRecord = {
    id: "local_" + Date.now().toString(36),
    name,
    email,
    passwordHash: demoHash(input.password),
    createdAt: new Date().toISOString(),
  };
  const nextUsers = [...users, user];
  window.localStorage.setItem(usersKey(storageKey), JSON.stringify(nextUsers));
  saveActiveUser(storageKey, user);
  return { ok: true, user: toPublicUser(user) };
}

export function loginLocalUser(
  storageKey: string,
  input: { email: string; password: string },
): AuthResult {
  const email = input.email.trim().toLowerCase();
  const users = readUsers(storageKey);
  const user = users.find((item) => item.email === email);

  if (!user || user.passwordHash !== demoHash(input.password)) {
    return { ok: false, error: "Email ou senha invalidos para esta demo local." };
  }

  saveActiveUser(storageKey, user);
  return { ok: true, user: toPublicUser(user) };
}

function saveActiveUser(storageKey: string, user: LocalAuthRecord) {
  window.localStorage.setItem(activeKey(storageKey), JSON.stringify(toPublicUser(user)));
}

function readUsers(storageKey: string): LocalAuthRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(usersKey(storageKey));
    return raw ? (JSON.parse(raw) as LocalAuthRecord[]) : [];
  } catch {
    return [];
  }
}

function toPublicUser(user: LocalAuthRecord): LocalAuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}

function demoHash(value: string) {
  const bytes = new TextEncoder().encode(value);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).split("").reverse().join("");
}
`;
}

function buildGeneratedLoginRegisterModalSource(slug: string) {
  return `"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { GeneratedSiteConfig } from "@/lib/generated/${slug}-config";
import {
  loginLocalUser,
  registerLocalUser,
  type LocalAuthUser,
} from "@/lib/generated/${slug}-local-auth";

type LoginRegisterModalProps = {
  reason: "header" | "purchase";
  site: GeneratedSiteConfig;
  onClose: () => void;
  onSuccess: (user: LocalAuthUser) => void;
};

export function LoginRegisterModal({ reason, site, onClose, onSuccess }: LoginRegisterModalProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [status, setStatus] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    };
    const result =
      mode === "register"
        ? registerLocalUser(site.auth.storageKey, payload)
        : loginLocalUser(site.auth.storageKey, payload);

    if (!result.ok) {
      setStatus(result.error);
      return;
    }

    setStatus(mode === "register" ? "Conta local criada." : "Login local realizado.");
    onSuccess(result.user);
  }

  return (
    <div className="auth-backdrop" role="dialog" aria-modal="true" aria-label="Entrar na conta">
      <section className="auth-modal">
        <button className="modal-close" onClick={onClose} type="button" aria-label="Fechar login">
          ×
        </button>
        <span className="section-heading__line" />
        {site.auth.modalTitle ? <h2>{mode === "login" ? site.auth.modalTitle : "Criar conta"}</h2> : null}
        <p>
          {reason === "purchase"
            ? "Entre ou crie uma conta local para continuar a compra."
            : "Acesse sua conta local para acompanhar compras e agendamentos."}
        </p>
        <form onSubmit={submit}>
          {mode === "register" ? (
            <label>
              Nome
              <input name="name" placeholder="Seu nome" />
            </label>
          ) : null}
          <label>
            Email
            <input name="email" placeholder="voce@email.com" type="email" />
          </label>
          <label>
            Senha
            <input name="password" placeholder="Minimo 6 caracteres" type="password" />
          </label>
          {status ? <strong className="auth-status">{status}</strong> : null}
          <button className="button button--primary" type="submit">
            {mode === "login" ? "Entrar" : "Cadastrar"}
          </button>
        </form>
        <button className="auth-switch" onClick={() => setMode(mode === "login" ? "register" : "login")} type="button">
          {mode === "login" ? "Nao tenho conta, cadastrar" : "Ja tenho conta, entrar"}
        </button>
      </section>
    </div>
  );
}
`;
}

function buildGeneratedHeaderSource(slug: string) {
  return `"use client";

import { useState } from "react";
import type { GeneratedSiteConfig } from "@/lib/generated/${slug}-config";

type HeaderProps = {
  cartCount: number;
  authEnabled: boolean;
  authUserName?: string;
  site: GeneratedSiteConfig;
  whatsappHref: string;
  onCartClick: () => void;
  onLoginClick: () => void;
  onLogoutClick: () => void;
};

export function Header({
  cartCount,
  authEnabled,
  authUserName,
  site,
  whatsappHref,
  onCartClick,
  onLoginClick,
  onLogoutClick,
}: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isExternalWhatsapp = whatsappHref.startsWith("https://");
  const brandInitial = site.name.trim().charAt(0).toUpperCase() || "Z";

  return (
    <header className="site-header" data-header>
      <a className="brand" href="#inicio" aria-label={site.name}>
        <span className="brand__mark" aria-hidden="true">{brandInitial}</span>
        <span className="brand__text">
          <strong>{site.name}</strong>
          <small>{site.brandTagline}</small>
        </span>
      </a>

      <button
        className={"nav-toggle" + (isOpen ? " is-active" : "")}
        type="button"
        aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
        aria-expanded={isOpen}
        data-nav-toggle
        onClick={() => setIsOpen((current) => !current)}
      >
        <span />
        <span />
        <span />
      </button>

      <nav className={"main-nav" + (isOpen ? " is-open" : "")} aria-label="Menu principal" data-nav>
        {site.navigation.map((item) => (
          <a href={item.href} key={item.href} onClick={() => setIsOpen(false)}>
            {item.label}
          </a>
        ))}
      </nav>

      <div className="header-actions">
        <a
          className="header-cta"
          href={whatsappHref}
          rel={isExternalWhatsapp ? "noreferrer" : undefined}
          target={isExternalWhatsapp ? "_blank" : undefined}
        >
          {site.headerCta}
        </a>
        {authEnabled ? (
          authUserName ? (
            <button className="login-cta" onClick={onLogoutClick} type="button">
              Sair
            </button>
          ) : (
            <button className="login-cta" onClick={onLoginClick} type="button">
              Entrar
            </button>
          )
        ) : null}
        <button className="cart-toggle" onClick={onCartClick} type="button" aria-label="Abrir carrinho">
          Carrinho <span>{cartCount}</span>
        </button>
      </div>
    </header>
  );
}
`;
}

function buildGeneratedHeroSource(slug: string) {
  return `import type { CSSProperties } from "react";
import type { GeneratedSiteConfig } from "@/lib/generated/${slug}-config";

type HeroProps = {
  site: GeneratedSiteConfig;
  whatsappHref: string;
};

export function Hero({ site, whatsappHref }: HeroProps) {
  const isExternalWhatsapp = whatsappHref.startsWith("https://");

  return (
    <section className="hero section" id="inicio">
      <div className="hero__content reveal">
        {site.hero.title ? (
          <h1>
            {site.hero.title}
          </h1>
        ) : null}
        <p>
          {site.hero.subtitle}
        </p>
        <div className="hero__actions" aria-label="Acoes principais">
          <a
            className="button button--primary"
            href={whatsappHref}
            rel={isExternalWhatsapp ? "noreferrer" : undefined}
            target={isExternalWhatsapp ? "_blank" : undefined}
          >
            {site.hero.primaryCta}
          </a>
          <a className="button button--secondary" href="#produtos">
            {site.hero.secondaryCta}
          </a>
        </div>
      </div>

      <div className="hero__media reveal" style={{ "--delay": "120ms" } as CSSProperties}>
        <img src={site.images.hero} alt={site.images.heroAlt} />
        <div className="hero__note" aria-label="Informacao de destaque">
          <strong>{site.hero.cardTitle}</strong>
          <span>{site.hero.cardText}</span>
        </div>
      </div>
    </section>
  );
}
`;
}

function buildGeneratedFeaturesSource(slug: string) {
  return `"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import type { GeneratedSiteConfig } from "@/lib/generated/${slug}-config";

type FeaturesProps = {
  site: GeneratedSiteConfig;
  whatsappHref: string;
  onAddToCart: (product: GeneratedSiteConfig["products"][number]) => void;
};

export function Features({ site, whatsappHref, onAddToCart }: FeaturesProps) {
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const isExternalWhatsapp = whatsappHref.startsWith("https://");
  const categories = ["Todos", ...site.categories];
  const visibleProducts = useMemo(
    () =>
      selectedCategory === "Todos"
        ? site.products
        : site.products.filter((product) => product.category === selectedCategory),
    [selectedCategory, site.products],
  );

  return (
    <>
      <section className="about section" id="sobre">
        <div className="section-heading reveal">
          <span className="section-heading__line" />
          <h2>
            {site.about.title}
          </h2>
          <p>
            {site.about.text}
          </p>
        </div>

        <div className="about__grid">
          <article className="about__story reveal">
            <h3>Receitas simples, preparo cuidadoso</h3>
            <p>
              {site.about.text}
            </p>
          </article>

          <div className="feature-grid" aria-label="Diferenciais">
            {site.differentials.map((item, index) => (
              <article className="feature-card reveal" style={{ "--delay": String(80 + index * 60) + "ms" } as CSSProperties} key={item.title}>
                <span className="feature-card__icon" aria-hidden="true">{item.code}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="products section" id="produtos">
        <div className="section-heading section-heading--center reveal">
          <span className="section-heading__line" />
          <h2>
            {site.productsTitle}
          </h2>
          <p>
            {site.productsIntro}
          </p>
        </div>

        <div className="menu-panel reveal" id="cardapio">
          <div className="category-tabs" aria-label="Categorias do cardapio" data-category-tabs>
            {categories.map((category) => (
              <button
                aria-pressed={selectedCategory === category}
                className={selectedCategory === category ? "is-active" : ""}
                key={category}
                onClick={() => setSelectedCategory(category)}
                type="button"
              >
                {category}
              </button>
            ))}
          </div>

          <div className="product-grid" data-products-grid>
            {visibleProducts.map((product) => (
              <article className="product-card reveal" key={product.name}>
                <div
                  className="product-card__media"
                  role="img"
                  aria-label={product.imageAlt}
                  style={{
                    backgroundImage: "url('" + product.image + "')",
                    backgroundPosition: "center",
                    backgroundSize: "cover",
                  }}
                />
                <div className="product-card__body">
                  <span className="product-card__category">{product.category}</span>
                  <div className="product-card__top">
                    <h3>{product.name}</h3>
                    <span className="product-card__price">{product.price}</span>
                  </div>
                  <p>{product.description}</p>
                  <button className="product-card__cart" onClick={() => onAddToCart(product)} type="button">
                    Comprar
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="promo section" aria-label="Destaque">
        <div className="promo__content reveal">
          <h2>{site.promo.title}</h2>
          <p>{site.promo.text}</p>
          <div className="promo__meta">
            <span>{site.promo.metaLabel}</span>
            <strong>{site.promo.price}</strong>
          </div>
          <a
            className="button button--primary"
            href={whatsappHref}
            rel={isExternalWhatsapp ? "noreferrer" : undefined}
            target={isExternalWhatsapp ? "_blank" : undefined}
          >
            {site.promo.cta}
          </a>
        </div>
        <div className="promo__visual reveal" style={{ "--delay": "140ms" } as CSSProperties}>
          <div
            className="sprite-image sprite-image--combo"
            aria-label={site.images.promoAlt}
            style={{
              backgroundImage: "url('" + site.images.promo + "')",
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
          />
        </div>
      </section>

      <section className="testimonials section" id="depoimentos">
        <div className="section-heading reveal">
          <span className="section-heading__line" />
          <h2>
            {site.testimonialsTitle}
          </h2>
          <p>
            {site.testimonialsIntro}
          </p>
        </div>
        <div className="testimonial-grid" data-testimonials-grid>
          {site.testimonials.map((testimonial, index) => (
            <article className="testimonial-card reveal" style={{ "--delay": String(index * 90) + "ms" } as CSSProperties} key={testimonial.name}>
              <div className="testimonial-card__rating" aria-label="Avaliacao cinco estrelas">{testimonial.rating}</div>
              <p>"{testimonial.comment}"</p>
              <div className="testimonial-card__author">
                <strong>{testimonial.name}</strong>
                <span>{testimonial.role}</span>
              </div>
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
  return `import type { CSSProperties } from "react";
import type { GeneratedSiteConfig } from "@/lib/generated/${slug}-config";

type ContactSectionProps = {
  site: GeneratedSiteConfig;
  whatsappHref: string;
};

export function ContactSection({ site, whatsappHref }: ContactSectionProps) {
  const isExternalWhatsapp = whatsappHref.startsWith("https://");

  return (
    <section className="contact section" id="contato">
      <div className="contact__details reveal">
        <div className="section-heading">
          <span className="section-heading__line" />
          <h2>
            {site.contactTitle}
          </h2>
          <p>
            {site.contactIntro}
          </p>
        </div>

        <div className="contact-list">
          <article>
            <strong>Endereço</strong>
            <span>{site.contact.address}</span>
          </article>
          <article>
            <strong>Horário</strong>
            <span>{site.contact.hours}</span>
          </article>
          <article>
            <strong>Telefone / WhatsApp</strong>
            <span>{site.contact.whatsapp}</span>
          </article>
        </div>

        <a
          className="button button--primary contact-whatsapp"
          href={whatsappHref}
          rel={isExternalWhatsapp ? "noreferrer" : undefined}
          target={isExternalWhatsapp ? "_blank" : undefined}
        >
          Chamar no WhatsApp
        </a>
      </div>

      <div className="map-card reveal" style={{ "--delay": "120ms" } as CSSProperties} aria-label="Espaco reservado para mapa">
        <div className="map-card__pin" aria-hidden="true" />
        <strong>Mapa da loja</strong>
        <span>Espaço reservado para incorporação do mapa.</span>
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
    <footer className="site-footer">
      <div className="footer__brand">
        <strong>{site.name}</strong>
        <span>{site.brandTagline}</span>
      </div>
      <nav className="footer__links" aria-label="Links rapidos">
        {site.navigation
          .filter((item) => ["#inicio", "#sobre", "#produtos", "#contato"].includes(item.href))
          .map((item) => (
            <a href={item.href} key={item.href}>{item.label}</a>
          ))}
      </nav>
      <div className="footer__social" aria-label="Redes sociais">
        {site.social.map((item) => (
          <a href={item.href} key={item.label} aria-label={item.label}>{item.label.slice(0, 2)}</a>
        ))}
      </div>
      <p>{site.footerText}</p>
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
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--honey)]">Editor</p>
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
  visionReferences: BuilderVisionReference[] = [],
) {
  const config = buildGeneratedConfig(name, kind, features, prompt, brief, visionReferences);

  return `export type GeneratedSiteConfig = {
  name: string;
  kind: "saas" | "site" | "landing" | "dashboard";
  niche: string;
  templateSource: string;
  brandTagline: string;
  headerCta: string;
  whatsappMessage: string;
  footerText: string;
  theme: {
    background: string;
    backgroundSoft: string;
    card: string;
    primary: string;
    primaryDark: string;
    secondary: string;
    text: string;
    muted: string;
    border: string;
    shadow: string;
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
  differentials: Array<{ code: string; title: string; text: string }>;
  categories: string[];
  productsTitle: string;
  productsIntro: string;
  products: Array<{
    category: string;
    name: string;
    description: string;
    price: string;
    image: string;
    imageAlt: string;
  }>;
  promo: {
    eyebrow: string;
    title: string;
    text: string;
    metaLabel: string;
    price: string;
    cta: string;
  };
  testimonialsTitle: string;
  testimonialsIntro: string;
  testimonials: Array<{ name: string; role: string; rating: string; comment: string }>;
  contactTitle: string;
  contactIntro: string;
  contact: {
    whatsapp: string;
    email: string;
    address: string;
    hours: string;
  };
  auth: {
    enabled: boolean;
    requireForPurchase: boolean;
    modalTitle: string;
    storageKey: string;
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
  visionReferences: BuilderVisionReference[] = [],
) {
  const industry = detectIndustry(brief?.niche?.trim() || latestPromptIntent(prompt));
  const isBakery = normalize(industry).includes("padaria");
  const media = getNicheMedia(industry);
  const palette = brief?.primaryColor ? buildPaletteFromColor(brief.primaryColor, prompt) : pickPalette(prompt);
  const siteName = titleCase(brief?.companyName ?? name);
  const phone = brief?.phoneWhatsapp?.trim() || "5511999990000";
  const email = brief?.email?.trim() || "contato@exemplo.com";
  const nicheLabel = brief?.niche?.trim() || industry;
  const copy = buildTemplateCopy(industry, siteName, nicheLabel, features);
  const theme = buildTemplateTheme(industry, palette, brief?.primaryColor);
  const removals = extractRemovalDirectivesFromHistory(prompt);
  const differentials = copy.differentials.slice(0, 4).map((item, index) => ({
    code: String(index + 1).padStart(2, "0"),
    ...item,
  }));

  const config = {
    name: siteName,
    kind,
    niche: nicheLabel,
    templateSource: "zszoro/Site.git",
    brandTagline: copy.brandTagline,
    headerCta: copy.headerCta,
    whatsappMessage: copy.whatsappMessage,
    footerText: `© ${new Date().getFullYear()} ${siteName}. Todos os direitos reservados.`,
    theme,
    navigation: [
      { label: "Início", href: "#inicio" },
      { label: "Sobre", href: "#sobre" },
      { label: copy.productsNavLabel, href: "#produtos" },
      { label: copy.menuNavLabel, href: "#cardapio" },
      { label: "Depoimentos", href: "#depoimentos" },
      { label: "Contato", href: "#contato" },
    ],
    hero: {
      ...copy.hero,
      title: removals.removeHeroTitle ? "" : copy.hero.title,
    },
    about: copy.about,
    images: {
      hero: media.hero,
      heroAlt: copy.heroImageAlt || (isBakery ? "Pães artesanais frescos em uma padaria" : media.secondaryAlt),
      promo: media.secondary,
      promoAlt: copy.promoImageAlt || (isBakery ? "Mesa com produtos de padaria e café" : media.tertiaryAlt),
    },
    differentials,
    categories: copy.categories,
    productsTitle: copy.productsTitle,
    productsIntro: copy.productsIntro,
    products: isBakery ? buildBakeryGeneratedProducts(media) : buildIndustryGeneratedProducts(industry, media),
    promo: copy.promo,
    testimonialsTitle: copy.testimonialsTitle,
    testimonialsIntro: copy.testimonialsIntro,
    testimonials: copy.testimonials,
    contactTitle: copy.contactTitle,
    contactIntro: copy.contactIntro,
    contact: {
      whatsapp: phone,
      email,
      address: copy.address,
      hours: copy.hours,
    },
    auth: {
      enabled: !removals.removeAuthSystem,
      requireForPurchase: true,
      modalTitle: removals.removeAuthTitle ? "" : `Entrar em ${siteName}`,
      storageKey: `generated-auth-${slugify(siteName)}`,
    },
    social: [
      { label: "Instagram", href: "#" },
      { label: "Facebook", href: "#" },
      { label: "WhatsApp", href: "#contato" },
    ],
  };

  return applyVisionReferenceToConfig(config, visionReferences);
}

function applyVisionReferenceToConfig<T extends {
  theme: {
    primary: string;
    primaryDark: string;
    border: string;
    shadow: string;
  };
  hero: {
    subtitle: string;
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
  differentials: Array<{ code: string; title: string; text: string }>;
  products: Array<{ image: string; imageAlt: string }>;
  promo: {
    title: string;
    text: string;
  };
}>(config: T, visionReferences: BuilderVisionReference[]) {
  const reference = getActiveVisionReference(visionReferences);
  if (!reference) return config;

  const primary = reference.colors.find((color) => /^#[0-9a-f]{6}$/i.test(color));
  if (primary) {
    config.theme.primary = primary;
    config.theme.primaryDark = primary;
    config.theme.border = `${primary}33`;
    config.theme.shadow = `0 18px 50px ${primary}24`;
  }

  const summary = cleanSentence(reference.summary || "Referencia visual aplicada ao site.", 150);
  const layout = cleanSentence(reference.layout || reference.visualPrompt || summary, 180);
  const alt = cleanSentence(reference.summary || reference.name, 120);

  config.hero.cardTitle = "Referencia visual aplicada";
  config.hero.cardText = summary;
  config.about.title = "Direcao visual do Vision Agent";
  config.about.text = layout;

  if (config.differentials.length) {
    config.differentials[0] = {
      code: config.differentials[0].code,
      title: "Imagem analisada",
      text: summary,
    };
  }

  if (reference.target === "style") {
    config.hero.subtitle = cleanSentence(reference.visualPrompt || layout, 190) || config.hero.subtitle;
    return config;
  }

  if (reference.target === "gallery") {
    config.images.promo = reference.dataUrl;
    config.images.promoAlt = alt;
    config.promo.title = "Destaque com imagem enviada";
    config.promo.text = summary;
    if (config.products[0]) {
      config.products[0] = {
        ...config.products[0],
        image: reference.dataUrl,
        imageAlt: alt,
      };
    }
    return config;
  }

  config.images.hero = reference.dataUrl;
  config.images.heroAlt = alt;
  return config;
}

function getActiveVisionReference(visionReferences?: BuilderVisionReference[]) {
  return visionReferences?.at(-1) ?? null;
}

function buildTemplateTheme(industry: string, palette: Palette, requestedColor?: string) {
  const normalized = normalize(industry);
  const primary = normalizeColor(requestedColor ?? "") ?? palette.primary;

  if (normalized.includes("padaria")) {
    return {
      background: "#fff8ea",
      backgroundSoft: "#f8ead1",
      card: "#fffdf8",
      primary,
      primaryDark: "#b85f3a",
      secondary: "#3b2518",
      text: "#3b2518",
      muted: "#6f4f36",
      border: "rgba(76, 45, 25, 0.14)",
      shadow: "0 18px 50px rgba(92, 51, 20, 0.14)",
    };
  }

  if (normalized.includes("barbearia")) {
    return {
      background: "#f7f2e8",
      backgroundSoft: "#e8dcc6",
      card: "#fffaf0",
      primary,
      primaryDark: "#8a5a18",
      secondary: "#1f1711",
      text: "#24170f",
      muted: "#725f4a",
      border: "rgba(36, 23, 15, 0.14)",
      shadow: "0 18px 50px rgba(36, 23, 15, 0.14)",
    };
  }

  if (normalized.includes("odont") || normalized.includes("clinica")) {
    return {
      background: "#eef9f8",
      backgroundSoft: "#d8efed",
      card: "#ffffff",
      primary,
      primaryDark: "#0f766e",
      secondary: "#143d4a",
      text: "#102f3a",
      muted: "#4c6c73",
      border: "rgba(20, 61, 74, 0.14)",
      shadow: "0 18px 50px rgba(20, 61, 74, 0.12)",
    };
  }

  if (normalized.includes("oficina") || normalized.includes("mecanica")) {
    return {
      background: "#f4f1ea",
      backgroundSoft: "#ded8ca",
      card: "#fffdf8",
      primary,
      primaryDark: "#b45309",
      secondary: "#1f2933",
      text: "#1f2933",
      muted: "#61707d",
      border: "rgba(31, 41, 51, 0.14)",
      shadow: "0 18px 50px rgba(31, 41, 51, 0.14)",
    };
  }

  if (normalized.includes("roupa") || normalized.includes("moda")) {
    return {
      background: "#fff6f7",
      backgroundSoft: "#f3e3e8",
      card: "#ffffff",
      primary,
      primaryDark: "#be185d",
      secondary: "#27212c",
      text: "#2a1f2c",
      muted: "#7a6674",
      border: "rgba(42, 31, 44, 0.12)",
      shadow: "0 18px 50px rgba(42, 31, 44, 0.12)",
    };
  }

  if (normalized.includes("restaurante")) {
    return {
      background: "#fff7ed",
      backgroundSoft: "#f4dbc1",
      card: "#fffdf8",
      primary,
      primaryDark: "#9f1239",
      secondary: "#451a03",
      text: "#3d1f10",
      muted: "#7c5c45",
      border: "rgba(69, 26, 3, 0.14)",
      shadow: "0 18px 50px rgba(69, 26, 3, 0.14)",
    };
  }

  if (normalized.includes("academia")) {
    return {
      background: "#10140f",
      backgroundSoft: "#1b2418",
      card: "#f8fff4",
      primary,
      primaryDark: "#16a34a",
      secondary: "#f8fff4",
      text: "#f8fff4",
      muted: "#b9c9b3",
      border: "rgba(248, 255, 244, 0.16)",
      shadow: "0 18px 50px rgba(0, 0, 0, 0.22)",
    };
  }

  return {
    background: "#f6f4ee",
    backgroundSoft: "#e8e1d2",
    card: "#fffdf8",
    primary,
    primaryDark: palette.secondary,
    secondary: palette.surface,
    text: "#24211d",
    muted: "#6d665c",
    border: "rgba(36, 33, 29, 0.14)",
    shadow: "0 18px 50px rgba(36, 33, 29, 0.12)",
  };
}

function buildTemplateCopy(industry: string, siteName: string, nicheLabel: string, features: string[]) {
  const normalized = normalize(industry);
  void features;
  const defaultDifferentials = [
    { title: "Atendimento rápido", text: "Contato direto para tirar dúvidas e avançar sem demora." },
    { title: "Visual profissional", text: "Layout responsivo com hierarquia clara e imagens do nicho." },
    { title: "Conteúdo editável", text: "Textos, cores e imagens organizados em configuração simples." },
    { title: "Gestão completa", text: "Base com login, banco, vendas, estoque e agendamentos." },
  ];

  const common = {
    templateSource: "zszoro/Site.git",
    headerCta: "Chamar no WhatsApp",
    productsNavLabel: "Serviços",
    menuNavLabel: "Oferta",
    heroImageAlt: "",
    promoImageAlt: "",
    address: "Rua Exemplo, 123 - Centro",
    hours: "Segunda a sexta, das 9h às 18h",
    testimonialsTitle: "Quem conhece, recomenda",
    testimonialsIntro: "Depoimentos organizados para reforçar confiança e facilitar a decisão.",
    contactTitle: "Contato e atendimento",
    contactIntro: "Chame pelo WhatsApp, tire dúvidas e avance para o próximo passo.",
  };

  if (normalized.includes("padaria")) {
    return {
      ...common,
      brandTagline: "fornada artesanal",
      headerCta: "Fazer pedido",
      productsNavLabel: "Produtos",
      menuNavLabel: "Cardápio",
      whatsappMessage: `Olá, vim pelo site da ${siteName} e quero fazer um pedido.`,
      heroImageAlt: "Cesta de pães artesanais sobre bancada de padaria",
      promoImageAlt: "Bandeja de café da manhã com produtos de padaria",
      hero: {
        eyebrow: "Padaria artesanal",
        title: "Pão fresco, café quente e carinho de bairro.",
        subtitle: "Receitas artesanais preparadas todos os dias para deixar sua mesa mais acolhedora.",
        primaryCta: "Fazer pedido",
        secondaryCta: "Ver produtos",
        cardTitle: "Fornada do dia",
        cardText: "pães e doces saindo cedo",
      },
      about: {
        title: "Padaria feita para a rotina da vizinhança",
        text: `${siteName} reúne atendimento próximo, ingredientes selecionados e produção em pequenos lotes para café da manhã, pausa da tarde e pedidos para compartilhar.`,
      },
      differentials: [
        {
          title: "Pães frescos",
          text: "Fornadas programadas ao longo do dia para manter textura, aroma e sabor.",
        },
        {
          title: "Produção artesanal",
          text: "Processos manuais e receitas próprias para criar produtos com personalidade.",
        },
        {
          title: "Entrega rápida",
          text: "Pedidos organizados para chegar com cuidado em bairros próximos.",
        },
        {
          title: "Qualidade garantida",
          text: "Ingredientes escolhidos e atendimento atento do primeiro contato à entrega.",
        },
      ],
      categories: ["Pães", "Bolos", "Doces", "Salgados", "Bebidas"],
      productsTitle: "Produtos para todos os momentos",
      productsIntro: "Escolha por categoria e monte seu pedido com produtos organizados para compra rápida.",
      promo: {
        eyebrow: "Destaque",
        title: "Combo do café da manhã",
        text: "Pães artesanais, fatia de bolo, café coado e suco natural para duas pessoas.",
        metaLabel: "A partir de",
        price: "R$ 49,90",
        cta: "Pedir no WhatsApp",
      },
      testimonialsTitle: "Quem prova, volta",
      testimonialsIntro: "Depoimentos de clientes para mostrar qualidade, atendimento e confiança.",
      testimonials: [
        {
          name: "Marina Lopes",
          role: "cliente do bairro",
          rating: "★★★★★",
          comment: "Os pães chegam quentinhos e o atendimento é sempre muito atencioso.",
        },
        {
          name: "Rafael Torres",
          role: "pedido para escritório",
          rating: "★★★★★",
          comment: "O combo de café resolveu nossa reunião da manhã com praticidade.",
        },
        {
          name: "Clara Menezes",
          role: "encomendas de fim de semana",
          rating: "★★★★★",
          comment: "Bolos bem apresentados, doces na medida e entrega dentro do horário.",
        },
      ],
      contactTitle: "Contato e funcionamento",
      contactIntro: "Faça seu pedido, consulte disponibilidade ou passe para buscar sua fornada.",
      address: "Rua das Oliveiras, 128 - Centro",
      hours: "Segunda a sábado, 6h30 às 19h",
    };
  }

  if (normalized.includes("barbearia")) {
    return buildBusinessCopy({
      ...common,
      siteName,
      niche: "barbearia premium",
      brandTagline: "corte, barba e estilo",
      heroTitle: "Corte alinhado, barba precisa e experiência sem pressa.",
      heroSubtitle: "Agende horários, conheça serviços e veja o visual da barbearia em uma página direta para converter visitantes.",
      cardTitle: "Agenda aberta",
      cardText: "cortes, barba e combos para a semana",
      aboutTitle: "Barbearia feita para rotina e presença",
      aboutText: `${siteName} apresenta serviços, equipe, ambiente e contato rápido para clientes que querem agendar com confiança.`,
      productsTitle: "Serviços mais pedidos",
      productsIntro: "Escolha o serviço e chame no WhatsApp para confirmar horário.",
      promoTitle: "Combo corte + barba",
      promoText: "Atendimento completo com corte, barba desenhada, toalha quente e finalização.",
      promoPrice: "R$ 89,90",
      categories: ["Cortes", "Barba", "Combos", "Tratamentos"],
      differentials: defaultDifferentials,
    });
  }

  if (normalized.includes("odont")) {
    return buildBusinessCopy({
      ...common,
      siteName,
      niche: "clínica odontológica",
      brandTagline: "sorrisos com cuidado",
      heroTitle: "Atendimento odontológico claro, moderno e acolhedor.",
      heroSubtitle: "Mostre tratamentos, equipe, estrutura e canais de agendamento em uma página confiável e responsiva.",
      cardTitle: "Avaliação inicial",
      cardText: "orientação, prevenção e plano de cuidado",
      aboutTitle: "Confiança desde o primeiro contato",
      aboutText: `${siteName} organiza tratamentos, diferenciais, horários e contato para facilitar a decisão do paciente.`,
      productsTitle: "Tratamentos em destaque",
      productsIntro: "Serviços organizados para explicar benefícios e próximos passos.",
      promoTitle: "Avaliação odontológica",
      promoText: "Primeira conversa para entender necessidades, orientar o paciente e indicar o melhor tratamento.",
      promoPrice: "Sob consulta",
      categories: ["Prevenção", "Estética", "Ortodontia", "Implantes"],
      differentials: defaultDifferentials,
    });
  }

  if (normalized.includes("oficina") || normalized.includes("mecanica")) {
    return buildBusinessCopy({
      ...common,
      siteName,
      niche: "oficina mecânica",
      brandTagline: "diagnóstico e manutenção",
      heroTitle: "Oficina organizada para revisão, reparo e confiança.",
      heroSubtitle: "Mostre serviços automotivos, diferenciais, horários e contato rápido com imagens do nicho.",
      cardTitle: "Diagnóstico rápido",
      cardText: "revisão, manutenção e orçamento",
      aboutTitle: "Serviço técnico com comunicação clara",
      aboutText: `${siteName} ajuda o cliente a entender serviços, pedir orçamento e escolher o melhor horário para levar o veículo.`,
      productsTitle: "Serviços automotivos",
      productsIntro: "Categorias prontas para revisão, freios, óleo, suspensão e diagnóstico.",
      promoTitle: "Check-up preventivo",
      promoText: "Inspeção inicial para identificar pontos de atenção antes de virar problema.",
      promoPrice: "A partir de R$ 99,90",
      categories: ["Revisão", "Freios", "Óleo", "Suspensão"],
      differentials: defaultDifferentials,
    });
  }

  if (normalized.includes("roupa") || normalized.includes("moda")) {
    return buildBusinessCopy({
      ...common,
      siteName,
      niche: "loja de roupas",
      brandTagline: "moda selecionada",
      heroTitle: "Coleções com estilo, vitrine bonita e compra fácil.",
      heroSubtitle: "Apresente peças, categorias, destaques e contato em uma experiência visual para vender mais.",
      cardTitle: "Nova coleção",
      cardText: "looks, acessórios e atendimento personalizado",
      aboutTitle: "Moda organizada para inspirar escolha",
      aboutText: `${siteName} destaca produtos, identidade visual e atendimento para transformar visitantes em compradores.`,
      productsTitle: "Peças em destaque",
      productsIntro: "Categorias prontas para montar uma vitrine responsiva e visual.",
      promoTitle: "Look completo da semana",
      promoText: "Combinação de peças selecionadas para facilitar a compra por WhatsApp.",
      promoPrice: "A partir de R$ 159,90",
      categories: ["Feminino", "Masculino", "Acessórios", "Novidades"],
      differentials: defaultDifferentials,
    });
  }

  if (normalized.includes("restaurante")) {
    return buildBusinessCopy({
      ...common,
      siteName,
      niche: "restaurante",
      brandTagline: "cozinha autoral",
      heroTitle: "Pratos marcantes, reserva fácil e sabor de casa.",
      heroSubtitle: "Mostre ambiente, cardápio, horários e WhatsApp com uma página feita para gerar reservas.",
      cardTitle: "Mesa pronta",
      cardText: "pratos, reservas e atendimento direto",
      aboutTitle: "Experiência que começa antes da reserva",
      aboutText: `${siteName} apresenta pratos, clima do salão e contato para deixar a decisão simples.`,
      productsTitle: "Cardápio em destaque",
      productsIntro: "Categorias para entradas, pratos, sobremesas e bebidas.",
      promoTitle: "Menu especial da casa",
      promoText: "Sugestão completa para duas pessoas com prato principal, sobremesa e bebida.",
      promoPrice: "A partir de R$ 129,90",
      categories: ["Entradas", "Pratos", "Sobremesas", "Bebidas"],
      differentials: defaultDifferentials,
    });
  }

  return buildBusinessCopy({
    ...common,
    siteName,
    niche: nicheLabel,
    brandTagline: "presença profissional",
    heroTitle: `${siteName}: presença digital pronta para converter.`,
    heroSubtitle: "Site responsivo com estrutura visual inspirada no template principal, imagens do nicho e contato direto.",
    cardTitle: "Modelo editável",
    cardText: "textos, cores e imagens adaptados por nicho",
    aboutTitle: "Uma estrutura clara para vender melhor",
    aboutText: `${siteName} apresenta a empresa com uma experiência objetiva, responsiva e preparada para crescer com novas páginas, APIs e integrações.`,
    productsTitle: "Serviços em destaque",
    productsIntro: "Blocos prontos para explicar ofertas, benefícios e próximos passos.",
    promoTitle: "Oferta principal pronta para conversão",
    promoText: "Bloco promocional para destacar o serviço mais importante e levar o visitante direto ao contato.",
    promoPrice: "Sob consulta",
    categories: ["Serviços", "Planos", "Resultados", "Contato"],
    differentials: defaultDifferentials,
  });
}

function buildBusinessCopy(input: {
  siteName: string;
  niche: string;
  brandTagline: string;
  headerCta: string;
  productsNavLabel: string;
  menuNavLabel: string;
  heroImageAlt: string;
  promoImageAlt: string;
  address: string;
  hours: string;
  testimonialsTitle: string;
  testimonialsIntro: string;
  contactTitle: string;
  contactIntro: string;
  heroTitle: string;
  heroSubtitle: string;
  cardTitle: string;
  cardText: string;
  aboutTitle: string;
  aboutText: string;
  productsTitle: string;
  productsIntro: string;
  promoTitle: string;
  promoText: string;
  promoPrice: string;
  categories: string[];
  differentials: Array<{ title: string; text: string }>;
}) {
  return {
    brandTagline: input.brandTagline,
    headerCta: "Chamar no WhatsApp",
    productsNavLabel: input.productsNavLabel,
    menuNavLabel: input.menuNavLabel,
    whatsappMessage: `Olá, vim pelo site da ${input.siteName} e quero mais informações.`,
    heroImageAlt: input.heroImageAlt,
    promoImageAlt: input.promoImageAlt,
    hero: {
      eyebrow: input.niche,
      title: input.heroTitle,
      subtitle: input.heroSubtitle,
      primaryCta: "Chamar no WhatsApp",
      secondaryCta: "Ver serviços",
      cardTitle: input.cardTitle,
      cardText: input.cardText,
    },
    about: {
      title: input.aboutTitle,
      text: input.aboutText,
    },
    differentials: input.differentials.length
      ? input.differentials
      : [
          { title: "Atendimento rápido", text: "Contato direto para tirar dúvidas e avançar sem demora." },
          { title: "Visual profissional", text: "Layout responsivo com hierarquia clara e imagens do nicho." },
          { title: "Conteúdo editável", text: "Textos, cores e imagens organizados em configuração simples." },
          { title: "Contato direto", text: "CTA real para WhatsApp sem redirecionar para a tela inicial." },
        ],
    categories: input.categories,
    productsTitle: input.productsTitle,
    productsIntro: input.productsIntro,
    promo: {
      eyebrow: "Destaque",
      title: input.promoTitle,
      text: input.promoText,
      metaLabel: "Valor",
      price: input.promoPrice,
      cta: "Conversar no WhatsApp",
    },
    testimonialsTitle: input.testimonialsTitle,
    testimonialsIntro: input.testimonialsIntro,
    testimonials: [
      {
        name: "Marina Costa",
        role: "cliente",
        rating: "★★★★★",
        comment: "A página ficou clara, bonita e facilitou o contato.",
      },
      {
        name: "Rafael Lima",
        role: "cliente recorrente",
        rating: "★★★★★",
        comment: "Consegui entender serviços, diferenciais e próximo passo sem procurar muito.",
      },
      {
        name: "Camila Rocha",
        role: "novo contato",
        rating: "★★★★★",
        comment: "O visual passa confiança e combina com o nicho da empresa.",
      },
    ],
    contactTitle: input.contactTitle,
    contactIntro: input.contactIntro,
    address: input.address,
    hours: input.hours,
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
    {
      category: "Bebidas",
      name: "Café coado",
      description: "Servido fresco, com aroma marcante e sabor equilibrado.",
      price: "R$ 6,00",
      image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=82",
      imageAlt: "Café coado servido quente",
    },
  ];
}

function buildIndustryGeneratedProducts(industry: string, media: ReturnType<typeof getNicheMedia>) {
  const normalized = normalize(industry);

  if (normalized.includes("barbearia")) {
    return [
      {
        category: "Cortes",
        name: "Corte clássico",
        description: "Corte alinhado com acabamento preciso e finalização.",
        price: "R$ 49,90",
        image: media.hero,
        imageAlt: "Corte masculino em barbearia",
      },
      {
        category: "Barba",
        name: "Barba desenhada",
        description: "Toalha quente, desenho de barba e hidratação.",
        price: "R$ 39,90",
        image: media.secondary,
        imageAlt: "Barba sendo finalizada em barbearia",
      },
      {
        category: "Combos",
        name: "Corte + barba",
        description: "Serviço completo para renovar visual em uma visita.",
        price: "R$ 89,90",
        image: media.tertiary,
        imageAlt: "Atendimento premium em barbearia",
      },
      {
        category: "Tratamentos",
        name: "Hidratação capilar",
        description: "Cuidado extra para cabelo com acabamento natural.",
        price: "R$ 29,90",
        image: media.secondary,
        imageAlt: "Produtos e ferramentas de barbearia",
      },
    ];
  }

  if (normalized.includes("odont")) {
    return [
      {
        category: "Prevenção",
        name: "Limpeza profissional",
        description: "Cuidados preventivos para manter saúde bucal em dia.",
        price: "Sob consulta",
        image: media.hero,
        imageAlt: "Atendimento odontológico preventivo",
      },
      {
        category: "Estética",
        name: "Clareamento",
        description: "Procedimento orientado para melhorar a estética do sorriso.",
        price: "Sob consulta",
        image: media.secondary,
        imageAlt: "Consultório odontológico moderno",
      },
      {
        category: "Ortodontia",
        name: "Avaliação ortodôntica",
        description: "Plano inicial para alinhamento e acompanhamento.",
        price: "Sob consulta",
        image: media.tertiary,
        imageAlt: "Paciente em avaliação odontológica",
      },
      {
        category: "Implantes",
        name: "Planejamento de implantes",
        description: "Atendimento para entender caso, exames e próximos passos.",
        price: "Sob consulta",
        image: media.secondary,
        imageAlt: "Equipe odontológica em atendimento",
      },
    ];
  }

  if (normalized.includes("oficina") || normalized.includes("mecanica")) {
    return [
      {
        category: "Revisão",
        name: "Revisão completa",
        description: "Checklist preventivo para rodar com mais segurança.",
        price: "A partir de R$ 149,90",
        image: media.hero,
        imageAlt: "Mecânico revisando veículo",
      },
      {
        category: "Freios",
        name: "Sistema de freios",
        description: "Diagnóstico de pastilhas, discos e fluido.",
        price: "Sob consulta",
        image: media.secondary,
        imageAlt: "Manutenção automotiva em oficina",
      },
      {
        category: "Óleo",
        name: "Troca de óleo",
        description: "Óleo, filtros e conferência de itens essenciais.",
        price: "A partir de R$ 119,90",
        image: media.tertiary,
        imageAlt: "Carro em manutenção",
      },
      {
        category: "Suspensão",
        name: "Suspensão e alinhamento",
        description: "Avaliação de ruídos, estabilidade e desgaste.",
        price: "Sob consulta",
        image: media.secondary,
        imageAlt: "Oficina mecânica com ferramentas",
      },
    ];
  }

  if (normalized.includes("roupa") || normalized.includes("moda")) {
    return [
      {
        category: "Feminino",
        name: "Look casual",
        description: "Peças leves para rotina com acabamento elegante.",
        price: "R$ 129,90",
        image: media.hero,
        imageAlt: "Vitrine de loja de roupas",
      },
      {
        category: "Masculino",
        name: "Camisa essencial",
        description: "Modelagem versátil para trabalho e fim de semana.",
        price: "R$ 99,90",
        image: media.secondary,
        imageAlt: "Araras com roupas em loja",
      },
      {
        category: "Acessórios",
        name: "Bolsa urbana",
        description: "Acessório prático para completar a composição.",
        price: "R$ 149,90",
        image: media.tertiary,
        imageAlt: "Editorial de moda com acessórios",
      },
      {
        category: "Novidades",
        name: "Coleção semanal",
        description: "Curadoria de peças recém-chegadas para montar looks.",
        price: "A partir de R$ 79,90",
        image: media.secondary,
        imageAlt: "Loja de moda com coleção nova",
      },
    ];
  }

  if (normalized.includes("restaurante")) {
    return [
      {
        category: "Entradas",
        name: "Entrada da casa",
        description: "Porção para abrir a experiência com sabor e textura.",
        price: "R$ 34,90",
        image: media.hero,
        imageAlt: "Mesa de restaurante preparada",
      },
      {
        category: "Pratos",
        name: "Prato principal",
        description: "Receita marcante com ingredientes frescos.",
        price: "R$ 69,90",
        image: media.secondary,
        imageAlt: "Prato servido em restaurante",
      },
      {
        category: "Sobremesas",
        name: "Sobremesa especial",
        description: "Finalização doce para compartilhar.",
        price: "R$ 24,90",
        image: media.tertiary,
        imageAlt: "Sobremesa de restaurante",
      },
      {
        category: "Bebidas",
        name: "Drink autoral",
        description: "Bebida preparada para acompanhar o cardápio.",
        price: "R$ 29,90",
        image: media.secondary,
        imageAlt: "Bebida servida em restaurante",
      },
    ];
  }

  const label = titleCase(industry);

  return [
    {
      category: "Serviços",
      name: `Plano ${label}`,
      description: "Apresentação clara do serviço principal com chamada de contato.",
      price: "Sob consulta",
      image: media.hero,
      imageAlt: media.secondaryAlt,
    },
    {
      category: "Planos",
      name: "Atendimento completo",
      description: "Bloco para explicar benefícios, processo e próximos passos.",
      price: "Sob consulta",
      image: media.secondary,
      imageAlt: media.secondaryAlt,
    },
    {
      category: "Resultados",
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
  visionReferences?: BuilderVisionReference[];
  editNotes: string[];
}) {
  if (input.name) {
    return buildSiteReferencePreviewHtml(input);
  }

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
  const featureCards = buildPreviewHighlights(input.industry)
    .map(
      (item, index) => `
        <article class="feature">
          <span>0${index + 1}</span>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.text)}</p>
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
      width: 100%;
      margin: 0;
      padding: 0 0 32px;
    }
    header {
      position: fixed;
      inset: 0 0 auto;
      z-index: 20;
      height: 82px;
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 24px;
      padding: 0 max(24px, calc((100vw - 1120px) / 2));
      background: color-mix(in srgb, var(--bg) 86%, white 14%);
      border-bottom: 1px solid var(--line);
      backdrop-filter: blur(18px);
      transition: box-shadow 180ms ease, background 180ms ease;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      min-width: 206px;
      text-decoration: none;
    }
    .brand__mark {
      display: grid;
      width: 42px;
      height: 42px;
      place-items: center;
      border-radius: 50%;
      background: var(--text);
      color: var(--bg);
      font-family: Georgia, "Times New Roman", serif;
      font-size: 1.35rem;
      font-weight: 800;
      box-shadow: 0 10px 24px rgba(59, 37, 24, 0.18);
    }
    .brand__text {
      display: grid;
      line-height: 1.1;
    }
    .brand__text strong {
      font-size: 1rem;
      letter-spacing: 0;
    }
    .brand__text small {
      color: var(--muted);
      font-size: 0.76rem;
      margin-top: 3px;
    }
    nav {
      justify-self: center;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: color-mix(in srgb, var(--surface) 58%, white 42%);
    }
    nav a {
      color: var(--muted);
      text-decoration: none;
      border-radius: 999px;
      font-size: .91rem;
      font-weight: 700;
      padding: 10px 13px;
      transition: color 180ms ease, background 180ms ease;
    }
    nav a:hover {
      color: var(--text);
      background: color-mix(in srgb, var(--accent) 18%, transparent);
    }
    .nav-cta {
      display: inline-flex;
      min-height: 46px;
      align-items: center;
      justify-content: center;
      color: #fffdf8;
      background: linear-gradient(135deg, var(--accent), var(--accent-soft));
      border-radius: 999px;
      padding: 0 18px;
      font-size: .94rem;
      font-weight: 800;
      text-decoration: none;
      white-space: nowrap;
      box-shadow: 0 14px 28px color-mix(in srgb, var(--accent) 22%, transparent);
      transition: transform 180ms ease, box-shadow 180ms ease;
    }
    .nav-cta:hover {
      transform: translateY(-2px);
      box-shadow: 0 18px 34px color-mix(in srgb, var(--accent) 28%, transparent);
    }
    .hero {
      position: relative;
      isolation: isolate;
      overflow: hidden;
      display: grid;
      align-items: center;
      min-height: 100vh;
      padding: 132px max(24px, calc((100vw - 1120px) / 2)) 78px;
      background:
        linear-gradient(90deg, rgba(27, 17, 9, .86), rgba(27, 17, 9, .52) 48%, rgba(27, 17, 9, .08)),
        url("${media.hero}") center / cover;
    }
    .hero > div {
      position: relative;
      z-index: 1;
      max-width: 680px;
    }
    h1 {
      margin: 0;
      max-width: 760px;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 70px;
      line-height: .96;
      letter-spacing: 0;
      font-weight: 700;
      color: #fffdf8;
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
      border: 1px solid rgba(255,255,255,.28);
      border-radius: 999px;
      background: rgba(255,255,255,.12);
      padding: 9px 12px;
      color: #fffdf8;
      font-size: 12px;
      font-weight: 800;
      backdrop-filter: blur(8px);
    }
    .lead {
      max-width: 620px;
      color: rgba(255,253,248,.82);
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
      background: linear-gradient(135deg, var(--accent), var(--accent-soft));
      color: #fffdf8;
      box-shadow: 0 18px 54px color-mix(in srgb, var(--accent) 26%, transparent);
    }
    .secondary {
      border: 1px solid rgba(255,255,255,.32);
      color: #fffdf8;
      background: rgba(255,255,255,.12);
      backdrop-filter: blur(8px);
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
    }
    @media (max-width: 860px) {
      .features { grid-template-columns: 1fr; }
      .product-grid, .testimonial-grid, .promo { grid-template-columns: 1fr; }
      .story { grid-template-columns: 1fr; }
      nav { display: none; }
      .toolbar, .metrics { grid-template-columns: 1fr; }
      .timeline p { flex-direction: column; }
      h1 { font-size: 42px; }
      .hero { min-height: auto; padding-top: 26px; }
      .story-panel h2 { font-size: 34px; }
    }
  </style>
</head>
<body>
  <main class="page">
    <header>
      <a class="brand" href="#inicio" aria-label="${escapedName}">
        <span class="brand__mark" aria-hidden="true">${escapedName.charAt(0).toUpperCase()}</span>
        <span class="brand__text">
          <strong>${escapedName}</strong>
          <small>${escapeHtml(profile.kicker)}</small>
        </span>
      </a>
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
      </div>
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
      </div>
    </section>
    <footer><span>${escapedName}</span><span>Todos os direitos reservados.</span></footer>
  </main>
</body>
</html>`;
}

function buildSiteReferencePreviewHtml(input: {
  prompt: string;
  name: string;
  kind: BuilderProject["kind"];
  industry: string;
  features: string[];
  palette: Palette;
  brief?: ProjectBrief;
  visionReferences?: BuilderVisionReference[];
}) {
  const config = buildGeneratedConfig(
    input.name,
    input.kind,
    input.features,
    input.prompt,
    input.brief,
    input.visionReferences,
  );
  const directives = extractPreviewDirectives(input.prompt);
  const media = applyMediaDirectives(getNicheMedia(input.industry), directives);
  const contact = buildContact(input.brief);

  if (directives.description) {
    config.hero.subtitle = directives.description;
  }

  const imageTarget = directives.imageTarget;

  if (imageTarget) {
    config.images.promo = media.secondary;
    config.products = config.products.map((product) => {
      const label = normalize(product.name + " " + product.category + " " + product.description);
      const shouldReplace =
        imageTarget === "pao de queijo"
          ? label.includes("queijo")
          : label.includes(imageTarget);
      return shouldReplace ? { ...product, image: media.secondary, imageAlt: media.secondaryAlt } : product;
    });
  }

  const escapedName = escapeHtml(config.name);
  const brandInitial = escapeHtml(config.name.trim().charAt(0).toUpperCase() || "Z");
  const whatsappHref = buildPreviewWhatsappHref(config.contact.whatsapp, config.whatsappMessage, contact.primaryHref);
  const isExternalWhatsapp = whatsappHref.startsWith("https://");
  const titleStyle = directives.titleColor ? ` style="color:${escapeHtml(directives.titleColor)}"` : "";
  const heroTitle = config.hero.title ? `<h1${titleStyle}>${escapeHtml(config.hero.title)}</h1>` : "";
  const loginButton = config.auth.enabled
    ? `<button class="login-cta" type="button" data-open-auth>Entrar</button>`
    : "";
  const authTitle = config.auth.modalTitle ? `<h2 data-auth-title>${escapeHtml(config.auth.modalTitle)}</h2>` : "";
  const authModal = config.auth.enabled
    ? `<div class="auth-backdrop" hidden data-auth-modal><section class="auth-modal"><button class="modal-close" type="button" aria-label="Fechar login" data-close-auth>&times;</button><span class="section-heading__line"></span>${authTitle}<p data-auth-copy>Entre ou crie uma conta local para continuar.</p><form data-auth-form><label data-name-field hidden>Nome<input name="name" placeholder="Seu nome" /></label><label>Email<input name="email" type="email" placeholder="voce@email.com" /></label><label>Senha<input name="password" type="password" placeholder="Minimo 6 caracteres" /></label><strong class="auth-status" data-auth-status></strong><button class="button button--primary" type="submit" data-auth-submit>Entrar</button></form><button class="auth-switch" type="button" data-auth-switch>Nao tenho conta, cadastrar</button></section></div>`
    : "";
  const bodyStyle = buildPreviewVariableStyle(config.theme);
  const navItems = config.navigation
    .map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`)
    .join("");
  const categoryTabs = ["Todos", ...config.categories]
    .map(
      (category, index) =>
        `<button class="${index === 0 ? "is-active" : ""}" type="button" data-category="${escapeHtml(category)}" aria-pressed="${index === 0 ? "true" : "false"}">${escapeHtml(category)}</button>`,
    )
    .join("");
  const productCards = config.products.map(buildPreviewProductCard).join("");
  const featureCards = config.differentials
    .map(
      (item, index) =>
        `<article class="feature-card reveal" style="--delay:${80 + index * 60}ms"><span class="feature-card__icon" aria-hidden="true">${escapeHtml(item.code)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></article>`,
    )
    .join("");
  const testimonials = config.testimonials
    .map(
      (testimonial, index) =>
        `<article class="testimonial-card reveal" style="--delay:${index * 90}ms"><div class="testimonial-card__rating" aria-label="Avaliacao cinco estrelas">${escapeHtml(testimonial.rating)}</div><p>"${escapeHtml(testimonial.comment)}"</p><div class="testimonial-card__author"><strong>${escapeHtml(testimonial.name)}</strong><span>${escapeHtml(testimonial.role)}</span></div></article>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${escapedName} - site criado com a estrutura do zszoro/Site.git." />
    <base href="about:srcdoc" />
    <title>${escapedName}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet" />
    <style>${buildSiteTemplateCss()}</style>
  </head>
  <body style="${bodyStyle}">
    <header class="site-header" data-header>
      <a class="brand" href="#inicio" aria-label="${escapedName}">
        <span class="brand__mark" aria-hidden="true">${brandInitial}</span>
        <span class="brand__text"><strong>${escapedName}</strong><small>${escapeHtml(config.brandTagline)}</small></span>
      </a>
      <button class="nav-toggle" type="button" aria-label="Abrir menu" aria-expanded="false" data-nav-toggle><span></span><span></span><span></span></button>
      <nav class="main-nav" aria-label="Menu principal" data-nav>${navItems}</nav>
      <div class="header-actions">
        <a class="header-cta" href="${escapeHtml(whatsappHref)}"${isExternalWhatsapp ? ' target="_blank" rel="noreferrer"' : ""}>${escapeHtml(config.headerCta)}</a>
        ${loginButton}
        <button class="cart-toggle" type="button" data-open-cart>Carrinho <span data-cart-count>0</span></button>
      </div>
    </header>

    <main>
      <section class="hero section" id="inicio">
        <div class="hero__content reveal">
          ${heroTitle}
          <p>${escapeHtml(config.hero.subtitle)}</p>
          <div class="hero__actions" aria-label="Acoes principais">
            <a class="button button--primary" href="${escapeHtml(whatsappHref)}"${isExternalWhatsapp ? ' target="_blank" rel="noreferrer"' : ""}>${escapeHtml(config.hero.primaryCta)}</a>
            <a class="button button--secondary" href="#produtos">${escapeHtml(config.hero.secondaryCta)}</a>
          </div>
        </div>
        <div class="hero__media reveal" style="--delay:120ms">
          <img src="${escapeHtml(config.images.hero)}" alt="${escapeHtml(config.images.heroAlt)}" referrerpolicy="no-referrer" />
          <div class="hero__note" aria-label="Informacao de destaque"><strong>${escapeHtml(config.hero.cardTitle)}</strong><span>${escapeHtml(config.hero.cardText)}</span></div>
        </div>
      </section>

      <section class="about section" id="sobre">
        <div class="section-heading reveal"><span class="section-heading__line"></span><h2>${escapeHtml(config.about.title)}</h2><p>${escapeHtml(config.about.text)}</p></div>
        <div class="about__grid">
          <article class="about__story reveal"><h3>Receitas simples, preparo cuidadoso</h3><p>${escapeHtml(config.about.text)}</p></article>
          <div class="feature-grid" aria-label="Diferenciais">${featureCards}</div>
        </div>
      </section>

      <section class="products section" id="produtos">
        <div class="section-heading section-heading--center reveal"><span class="section-heading__line"></span><h2>${escapeHtml(config.productsTitle)}</h2><p>${escapeHtml(config.productsIntro)}</p></div>
        <div class="menu-panel reveal" id="cardapio">
          <div class="category-tabs" aria-label="Categorias do cardapio" data-category-tabs>${categoryTabs}</div>
          <div class="product-grid" data-products-grid>${productCards}</div>
        </div>
      </section>

      <section class="promo section" aria-label="Destaque">
        <div class="promo__content reveal"><h2>${escapeHtml(config.promo.title)}</h2><p>${escapeHtml(config.promo.text)}</p><div class="promo__meta"><span>${escapeHtml(config.promo.metaLabel)}</span><strong>${escapeHtml(config.promo.price)}</strong></div><a class="button button--primary" href="${escapeHtml(whatsappHref)}"${isExternalWhatsapp ? ' target="_blank" rel="noreferrer"' : ""}>${escapeHtml(config.promo.cta)}</a></div>
        <div class="promo__visual reveal" style="--delay:140ms"><div class="sprite-image sprite-image--combo" role="img" aria-label="${escapeHtml(config.images.promoAlt)}" style="background-image:url('${escapeHtml(config.images.promo)}');background-position:center;background-size:cover"></div></div>
      </section>

      <section class="testimonials section" id="depoimentos">
        <div class="section-heading reveal"><span class="section-heading__line"></span><h2>${escapeHtml(config.testimonialsTitle)}</h2><p>${escapeHtml(config.testimonialsIntro)}</p></div>
        <div class="testimonial-grid" data-testimonials-grid>${testimonials}</div>
      </section>

      <section class="contact section" id="contato">
        <div class="contact__details reveal"><div class="section-heading"><span class="section-heading__line"></span><h2>${escapeHtml(config.contactTitle)}</h2><p>${escapeHtml(config.contactIntro)}</p></div><div class="contact-list"><article><strong>Endereço</strong><span>${escapeHtml(config.contact.address)}</span></article><article><strong>Horário</strong><span>${escapeHtml(config.contact.hours)}</span></article><article><strong>Telefone / WhatsApp</strong><span>${escapeHtml(config.contact.whatsapp)}</span></article></div></div>
        <div class="map-card reveal" style="--delay:120ms" aria-label="Espaco reservado para mapa"><div class="map-card__pin" aria-hidden="true"></div><strong>Mapa da loja</strong><span>Espaço reservado para incorporação do mapa.</span></div>
      </section>
    </main>

    <footer class="site-footer"><div class="footer__brand"><strong>${escapedName}</strong><span>${escapeHtml(config.brandTagline)}</span></div><nav class="footer__links" aria-label="Links rapidos"><a href="#inicio">Início</a><a href="#sobre">Sobre</a><a href="#produtos">Produtos</a><a href="#contato">Contato</a></nav><div class="footer__social" aria-label="Redes sociais"><a href="#" aria-label="Instagram">Ig</a><a href="#" aria-label="Facebook">Fb</a><a href="#" aria-label="WhatsApp">Wa</a></div><p>${escapeHtml(config.footerText)}</p></footer>

    ${authModal}
    <aside class="cart-drawer" hidden data-cart-drawer><button class="modal-close" type="button" aria-label="Fechar carrinho" data-close-cart>×</button><span class="section-heading__line"></span><h2>Carrinho</h2><div class="cart-list" data-cart-list><p>Adicione produtos para montar o pedido.</p></div></aside>
    <script>${buildPreviewTemplateScript(config, whatsappHref)}</script>
  </body>
</html>`;
}

function buildPreviewVariableStyle(theme: ReturnType<typeof buildTemplateTheme>) {
  return [
    ["--cream", theme.background],
    ["--cream-strong", theme.backgroundSoft],
    ["--white", theme.card],
    ["--honey", theme.primary],
    ["--honey-dark", theme.primaryDark],
    ["--terracotta", theme.primaryDark],
    ["--brown", theme.text],
    ["--brown-soft", theme.muted],
    ["--border", theme.border],
    ["--shadow", theme.shadow],
  ]
    .map(([key, value]) => `${key}:${escapeHtml(value)}`)
    .join(";");
}

function buildPreviewWhatsappHref(phone: string, message: string, fallback: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return fallback || "#contato";
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function buildPreviewProductCard(product: ReturnType<typeof buildGeneratedConfig>["products"][number]) {
  return `<article class="product-card reveal" data-product-card data-category="${escapeHtml(product.category)}"><div class="product-card__media" style="background-image:url('${escapeHtml(product.image)}');background-position:center;background-size:cover" role="img" aria-label="${escapeHtml(product.imageAlt)}"></div><div class="product-card__body"><span class="product-card__category">${escapeHtml(product.category)}</span><div class="product-card__top"><h3>${escapeHtml(product.name)}</h3><span class="product-card__price">${escapeHtml(product.price)}</span></div><p>${escapeHtml(product.description)}</p><button class="product-card__cart" type="button" data-add-cart="${escapeHtml(product.name)}">Comprar</button></div></article>`;
}

function buildPreviewTemplateScript(config: ReturnType<typeof buildGeneratedConfig>, whatsappHref: string) {
  const productsJson = JSON.stringify(config.products).replace(/</g, "\\u003c");
  const siteName = JSON.stringify(config.name);
  const authConfigJson = JSON.stringify(config.auth).replace(/</g, "\\u003c");
  return `
const products = ${productsJson};
const siteName = ${siteName};
const baseWhatsappHref = ${JSON.stringify(whatsappHref)};
const authConfig = ${authConfigJson};
const authUsersKey = authConfig.storageKey + ":users";
const authActiveKey = authConfig.storageKey + ":active";
let selectedCategory = "Todos";
let cart = [];
let authMode = "login";
let fallbackUsers = [];
let fallbackActiveUser = null;
let authUser = readAuthUser();
let pendingProductName = null;
function priceToNumber(price) {
  const normalized = String(price).replace(/[^\\d,.-]/g, "").replace(/\\.(?=\\d{3})/g, "").replace(",", ".");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : 0;
}
function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
function demoHash(value) {
  let hash = 0;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash, 31) + text.charCodeAt(index);
  }
  return String(hash >>> 0);
}
function readUsers() {
  try {
    return JSON.parse(window.localStorage.getItem(authUsersKey) || "[]");
  } catch {
    return fallbackUsers;
  }
}
function writeUsers(users) {
  fallbackUsers = users;
  try {
    window.localStorage.setItem(authUsersKey, JSON.stringify(users));
  } catch {
    // Sandbox previews can block localStorage; keep the local demo alive in memory.
  }
}
function toPublicUser(user) {
  return { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt };
}
function readAuthUser() {
  try {
    const raw = window.localStorage.getItem(authActiveKey);
    return raw ? JSON.parse(raw) : fallbackActiveUser;
  } catch {
    return fallbackActiveUser;
  }
}
function setActiveUser(user) {
  authUser = toPublicUser(user);
  fallbackActiveUser = authUser;
  try {
    window.localStorage.setItem(authActiveKey, JSON.stringify(authUser));
  } catch {
    // Sandbox previews can block localStorage; keep the local demo alive in memory.
  }
  updateAuthButton();
}
function updateAuthButton() {
  const button = document.querySelector("[data-open-auth]");
  if (!button) return;
  if (authUser) {
    button.textContent = "Sair";
    button.dataset.logout = "true";
    button.setAttribute("aria-label", "Sair da conta local");
    return;
  }
  button.textContent = "Entrar";
  delete button.dataset.logout;
  button.setAttribute("aria-label", "Entrar na conta");
}
function registerLocalUser(input) {
  const name = String(input.name || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const password = String(input.password || "");
  if (name.length < 2) return { ok: false, error: "Digite seu nome." };
  if (!email.includes("@")) return { ok: false, error: "Digite um email valido." };
  if (password.length < 6) return { ok: false, error: "A senha precisa ter pelo menos 6 caracteres." };
  const users = readUsers();
  if (users.some((user) => user.email === email)) {
    return { ok: false, error: "Esse email ja tem cadastro local. Entre com a senha." };
  }
  const user = {
    id: "local_" + Date.now().toString(36),
    name,
    email,
    passwordHash: demoHash(password),
    createdAt: new Date().toISOString(),
  };
  writeUsers([...users, user]);
  return { ok: true, user };
}
function loginLocalUser(input) {
  const email = String(input.email || "").trim().toLowerCase();
  const password = String(input.password || "");
  const user = readUsers().find((item) => item.email === email);
  if (!user || user.passwordHash !== demoHash(password)) {
    return { ok: false, error: "Email ou senha invalidos para esta demo local." };
  }
  return { ok: true, user };
}
function setAuthStatus(message) {
  const status = document.querySelector("[data-auth-status]");
  if (status) status.textContent = message;
}
function setAuthCopy(reason) {
  const copy = document.querySelector("[data-auth-copy]");
  if (!copy) return;
  copy.textContent =
    reason === "purchase"
      ? "Entre ou crie uma conta local para continuar a compra."
      : "Acesse sua conta local para acompanhar compras e agendamentos.";
}
function openAuth(reason, productName) {
  if (!authConfig.enabled) return;
  pendingProductName = productName || null;
  const modal = document.querySelector("[data-auth-modal]");
  if (!modal) return;
  modal.hidden = false;
  setAuthCopy(reason);
  setAuthMode("login");
}
function closeAuth(clearPending) {
  const modal = document.querySelector("[data-auth-modal]");
  if (modal) modal.hidden = true;
  if (clearPending !== false) pendingProductName = null;
}
function renderProducts() {
  document.querySelectorAll("[data-product-card]").forEach((card) => {
    card.hidden = selectedCategory !== "Todos" && card.dataset.category !== selectedCategory;
  });
}
function renderCategories() {
  document.querySelectorAll("[data-category]").forEach((button) => {
    const active = button.dataset.category === selectedCategory;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}
function renderCart() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + priceToNumber(item.product.price) * item.quantity, 0);
  const countEl = document.querySelector("[data-cart-count]");
  const list = document.querySelector("[data-cart-list]");
  if (countEl) countEl.textContent = String(count);
  if (!list) return;
  if (!cart.length) {
    list.innerHTML = "<p>Adicione produtos para montar o pedido.</p>";
    return;
  }
  list.innerHTML = cart.map((item) => '<article class="cart-item"><div><strong>' + item.product.name + '</strong><span>' + item.product.price + '</span></div><div class="cart-controls"><button type="button" data-dec="' + item.product.name + '">-</button><span>' + item.quantity + '</span><button type="button" data-inc="' + item.product.name + '">+</button></div></article>').join("") + '<div class="cart-total"><span>Total</span><strong>' + formatCurrency(total) + '</strong></div><a class="button button--primary" target="_blank" rel="noreferrer" href="' + buildCheckoutHref(total) + '">Finalizar pedido</a>';
}
function buildCheckoutHref(total) {
  if (!baseWhatsappHref.startsWith("https://wa.me/") || !cart.length) return baseWhatsappHref;
  const lines = cart.map((item) => "- " + item.quantity + "x " + item.product.name + " (" + item.product.price + ")");
  const phone = baseWhatsappHref.split("/wa.me/")[1]?.split("?")[0] || "";
  const text = ["Olá, vim pelo site da " + siteName + " e quero finalizar este pedido:", ...lines, "Total aproximado: " + formatCurrency(total)].join("\\n");
  return "https://wa.me/" + phone + "?text=" + encodeURIComponent(text);
}
function addToCart(productName) {
  const product = products.find((item) => item.name === productName);
  if (!product) return;
  if (authConfig.enabled && authConfig.requireForPurchase && !authUser) {
    openAuth("purchase", productName);
    return;
  }
  const existing = cart.find((item) => item.product.name === productName);
  if (existing) existing.quantity += 1;
  else cart.push({ product, quantity: 1 });
  document.querySelector("[data-cart-drawer]").hidden = false;
  renderCart();
}
function setAuthMode(nextMode) {
  authMode = nextMode;
  const register = authMode === "register";
  const title = document.querySelector("[data-auth-title]");
  const submit = document.querySelector("[data-auth-submit]");
  const switchButton = document.querySelector("[data-auth-switch]");
  const nameField = document.querySelector("[data-name-field]");
  if (title) title.textContent = register ? "Criar conta" : authConfig.modalTitle || "Entrar em " + siteName;
  if (submit) submit.textContent = register ? "Cadastrar" : "Entrar";
  if (switchButton) switchButton.textContent = register ? "Ja tenho conta, entrar" : "Nao tenho conta, cadastrar";
  if (nameField) nameField.hidden = !register;
  setAuthStatus("");
}
function setupNavigation() {
  const nav = document.querySelector("[data-nav]");
  const toggle = document.querySelector("[data-nav-toggle]");
  if (!nav || !toggle) return;
  const closeMenu = () => {
    nav.classList.remove("is-open");
    toggle.classList.remove("is-active");
    toggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("nav-open");
  };
  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    toggle.classList.toggle("is-active", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
    document.body.classList.toggle("nav-open", isOpen);
  });
  nav.addEventListener("click", (event) => { if (event.target.closest("a")) closeMenu(); });
  window.addEventListener("keydown", (event) => { if (event.key === "Escape") closeMenu(); });
}
document.addEventListener("click", (event) => {
  const category = event.target.closest("[data-category]");
  if (category) { selectedCategory = category.dataset.category; renderCategories(); renderProducts(); return; }
  const add = event.target.closest("[data-add-cart]");
  if (add) { addToCart(add.dataset.addCart); return; }
  const inc = event.target.closest("[data-inc]");
  if (inc) { const item = cart.find((entry) => entry.product.name === inc.dataset.inc); if (item) item.quantity += 1; renderCart(); return; }
  const dec = event.target.closest("[data-dec]");
  if (dec) { cart = cart.map((item) => item.product.name === dec.dataset.dec ? { ...item, quantity: item.quantity - 1 } : item).filter((item) => item.quantity > 0); renderCart(); return; }
  if (event.target.closest("[data-open-cart]")) { document.querySelector("[data-cart-drawer]").hidden = false; renderCart(); return; }
  if (event.target.closest("[data-close-cart]")) { document.querySelector("[data-cart-drawer]").hidden = true; return; }
  const authTrigger = event.target.closest("[data-open-auth]");
  if (authTrigger) {
    if (authTrigger.dataset.logout === "true") {
      fallbackActiveUser = null;
      try {
        window.localStorage.removeItem(authActiveKey);
      } catch {
        // Sandbox previews can block localStorage.
      }
      authUser = null;
      updateAuthButton();
      return;
    }
    openAuth("header");
    return;
  }
  if (event.target.closest("[data-close-auth]")) { closeAuth(true); return; }
  if (event.target.closest("[data-auth-switch]")) { setAuthMode(authMode === "login" ? "register" : "login"); return; }
});
document.addEventListener("submit", (event) => {
  if (!event.target.matches("[data-auth-form]")) return;
  event.preventDefault();
  const form = new FormData(event.target);
  const payload = {
    email: String(form.get("email") || ""),
    password: String(form.get("password") || ""),
    name: String(form.get("name") || ""),
  };
  const result = authMode === "register" ? registerLocalUser(payload) : loginLocalUser(payload);
  if (!result.ok) {
    setAuthStatus(result.error);
    return;
  }
  setActiveUser(result.user);
  closeAuth(false);
  if (pendingProductName) {
    const productName = pendingProductName;
    pendingProductName = null;
    addToCart(productName);
  }
});
setupNavigation();
renderProducts();
renderCart();
updateAuthButton();`;
}

function buildPreviewHighlights(industry: string) {
  const normalized = normalize(industry);

  if (normalized.includes("barbearia")) {
    return [
      { title: "Agenda organizada", text: "Horários, serviços e contato direto para confirmar atendimentos." },
      { title: "Serviços claros", text: "Corte, barba, combos e tratamentos com descrição objetiva." },
      { title: "Experiência premium", text: "Visual forte, fotos do nicho e prova social para gerar confiança." },
      { title: "Gestão do negócio", text: "Base preparada para clientes, vendas, estoque e agendamentos." },
    ];
  }

  if (normalized.includes("padaria")) {
    return [
      { title: "Pães frescos", text: "Fornadas ao longo do dia para manter textura, aroma e sabor." },
      { title: "Produção artesanal", text: "Receitas próprias e ingredientes selecionados para a rotina da vizinhança." },
      { title: "Pedidos rápidos", text: "Contato direto para encomendas, retirada e entrega." },
      { title: "Controle completo", text: "Estrutura preparada para produtos, estoque, vendas e pedidos." },
    ];
  }

  if (normalized.includes("oficina") || normalized.includes("mecanica")) {
    return [
      { title: "Diagnóstico rápido", text: "Serviços automotivos organizados para orçamento e atendimento." },
      { title: "Agenda de revisões", text: "Horários para revisão, troca de óleo, freios e manutenção." },
      { title: "Estoque de peças", text: "Base pronta para controlar produtos, entradas e saídas." },
      { title: "Pedidos e vendas", text: "Fluxo preparado para orçamento, venda e acompanhamento." },
    ];
  }

  return [
    { title: "Área logada", text: "Base para login, cadastro, perfis e permissões." },
    { title: "Operação comercial", text: "Estrutura para pedidos, vendas e acompanhamento." },
    { title: "Agenda funcional", text: "Fluxo de horários, status e confirmação de atendimentos." },
    { title: "Gestão interna", text: "Painel preparado para produtos, clientes e relatórios." },
  ];
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

function extractSelectedElement(prompt: string) {
  const match = prompt.match(/Elemento selecionado no preview:\s*([^\n]+)/i);
  return match ? cleanSentence(match[1], 90) : "";
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

function estimateTokenCost(prompt: string, mode: BuilderAssistantResponse["mode"]) {
  const base = mode === "create" ? 44 : mode === "edit" ? 28 : 8;
  return Math.min(120, base + Math.ceil(prompt.length / 42));
}

function buildEffectivePrompt(message: string, generationContext: BuilderGenerationContext) {
  const blueprint = generationContext.blueprint;
  if (!blueprint?.professionalPrompt) return message;

  return [
    message,
    "",
    "Prompt profissional expandido pela IA externa:",
    blueprint.professionalPrompt,
    blueprint.features?.length ? `Recursos priorizados: ${blueprint.features.join(", ")}` : "",
    blueprint.pages?.length ? `Paginas: ${blueprint.pages.join(", ")}` : "",
    blueprint.components?.length ? `Componentes: ${blueprint.components.join(", ")}` : "",
    blueprint.apis?.length ? `APIs: ${blueprint.apis.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildExternalAiContext(generationContext: BuilderGenerationContext) {
  const blueprint = generationContext.blueprint;
  const engine = generationContext.aiEngine;

  if (!blueprint && !engine?.usedExternal) {
    return engine?.fallbackReason ? `Fallback local: ${engine.fallbackReason}` : "";
  }

  return [
    engine?.reason,
    blueprint?.professionalPrompt ? `Prompt expandido: ${blueprint.professionalPrompt}` : "",
    blueprint?.features?.length ? `Recursos: ${blueprint.features.join(", ")}` : "",
    blueprint?.architecture?.length ? `Arquitetura: ${blueprint.architecture.join(" | ")}` : "",
    blueprint?.design?.length ? `Design: ${blueprint.design.join(" | ")}` : "",
    blueprint?.code?.length ? `Codigo: ${blueprint.code.join(" | ")}` : "",
    blueprint?.qaChecks?.length ? `QA: ${blueprint.qaChecks.join(" | ")}` : "",
    blueprint?.seo?.length ? `SEO: ${blueprint.seo.join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildAiEngineStep(aiEngine?: AiEngineReport) {
  if (!aiEngine) return "";
  if (aiEngine.usedExternal) {
    const agents = aiEngine.agents.filter((agent) => agent.ok).map((agent) => agent.role);
    return `IA externa selecionou ${aiEngine.provider}/${aiEngine.model} no modo ${aiEngine.resolvedMode}${
      agents.length ? ` com agentes: ${agents.join(", ")}` : ""
    }.`;
  }

  return `Fallback local usado: ${aiEngine.fallbackReason ?? "provedor externo nao configurado"}.`;
}

function markdownList(items: string[] | undefined, fallback: string[]) {
  return (items?.length ? items : fallback).map((item) => `- ${item}`).join("\n");
}

function categorizeGeneratedComponent(component: string) {
  const lower = normalize(component);
  if (lower.includes("header") || lower.includes("cabecalho")) return "header";
  if (lower.includes("footer") || lower.includes("rodape")) return "footer";
  if (lower.includes("dashboard") || lower.includes("painel")) return "dashboard";
  if (lower.includes("form") || lower.includes("login") || lower.includes("cadastro")) return "formulario";
  if (lower.includes("table") || lower.includes("tabela")) return "tabela";
  if (lower.includes("modal")) return "modal";
  if (lower.includes("menu") || lower.includes("nav")) return "menu";
  if (lower.includes("card")) return "card";
  return "secao";
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

function hasWord(input: string, word: string) {
  return new RegExp(`\\b${word}\\b`, "i").test(input);
}
