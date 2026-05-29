import { promises as fs } from "node:fs";
import path from "node:path";
import type { AiEngineReport, AiGenerationBlueprint } from "./engine-types";
import type { BuilderProject } from "./generator";

type ProjectMemoryEvent = {
  id: string;
  projectId: string;
  projectName: string;
  mode: "chat" | "create" | "edit";
  message: string;
  summary: string;
  features: string[];
  components: string[];
  files: string[];
  preferences: string[];
  ai?: Pick<AiEngineReport, "usedExternal" | "provider" | "model" | "task" | "modelMode">;
  createdAt: string;
};

type ReusableComponentMemory = {
  name: string;
  sourceProjectId: string;
  sourceProjectName: string;
  category: string;
  path?: string;
  description: string;
  createdAt: string;
  usedCount: number;
};

type ProjectMemorySummary = {
  id: string;
  name: string;
  kind: BuilderProject["kind"];
  industry: string;
  summary: string;
  features: string[];
  updatedAt: string;
};

type MemoryStore = {
  version: 1;
  projects: ProjectMemorySummary[];
  events: ProjectMemoryEvent[];
  preferences: string[];
  reusableComponents: ReusableComponentMemory[];
};

const memoryFilePath = path.join(process.cwd(), ".zs", "builder-memory.json");
const maxEvents = 120;
const maxProjects = 40;
const maxPreferences = 80;
const maxComponents = 120;

const emptyStore = (): MemoryStore => ({
  version: 1,
  projects: [],
  events: [],
  preferences: [],
  reusableComponents: [],
});

export async function buildProjectMemoryContext(query: string) {
  const store = await readMemoryStore();
  const words = vectorize(query);
  const projects = rankByQuery(store.projects, words, (project) =>
    `${project.name} ${project.kind} ${project.industry} ${project.summary} ${project.features.join(" ")}`,
  ).slice(0, 4);
  const events = rankByQuery(store.events, words, (event) =>
    `${event.projectName} ${event.message} ${event.summary} ${event.features.join(" ")} ${event.preferences.join(" ")}`,
  ).slice(0, 5);
  const components = rankByQuery(store.reusableComponents, words, (component) =>
    `${component.name} ${component.category} ${component.description} ${component.sourceProjectName}`,
  ).slice(0, 8);
  const preferences = store.preferences.slice(-10);

  if (!projects.length && !events.length && !components.length && !preferences.length) {
    return "Sem memoria persistida relevante ainda.";
  }

  return [
    projects.length
      ? `Projetos lembrados:\n${projects
          .map(
            (project) =>
              `- ${project.name} (${project.kind}, ${project.industry}): ${project.summary} Recursos: ${project.features.join(", ")}`,
          )
          .join("\n")}`
      : "",
    events.length
      ? `Alteracoes recentes:\n${events
          .map((event) => `- ${event.projectName}: ${event.summary} Pedido: ${event.message.slice(0, 180)}`)
          .join("\n")}`
      : "",
    components.length
      ? `Componentes reutilizaveis:\n${components
          .map((component) => `- ${component.name} (${component.category}): ${component.description}`)
          .join("\n")}`
      : "",
    preferences.length ? `Preferencias do usuario:\n${preferences.map((preference) => `- ${preference}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function rememberProjectEvent(input: {
  mode: "chat" | "create" | "edit";
  message: string;
  project?: BuilderProject;
  blueprint?: AiGenerationBlueprint | null;
  aiEngine?: AiEngineReport;
}) {
  if (!input.project && input.mode === "chat") return;

  const store = await readMemoryStore();
  const now = new Date().toISOString();
  const project = input.project;
  const preferences = extractPreferences(input.message);
  const components = project ? extractReusableComponents(project, input.blueprint, now) : [];

  if (project) {
    const summary: ProjectMemorySummary = {
      id: project.id,
      name: project.name,
      kind: project.kind,
      industry: project.industry,
      summary: project.summary,
      features: project.features.slice(0, 12),
      updatedAt: project.updatedAt,
    };
    store.projects = [summary, ...store.projects.filter((item) => item.id !== project.id)].slice(0, maxProjects);

    store.events = [
      {
        id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        projectId: project.id,
        projectName: project.name,
        mode: input.mode,
        message: input.message.slice(0, 800),
        summary: project.summary.slice(0, 500),
        features: project.features.slice(0, 12),
        components: components.map((component) => component.name),
        files: project.files.map((file) => file.path).slice(0, 40),
        preferences,
        ai: input.aiEngine
          ? {
              usedExternal: input.aiEngine.usedExternal,
              provider: input.aiEngine.provider,
              model: input.aiEngine.model,
              task: input.aiEngine.task,
              modelMode: input.aiEngine.modelMode,
            }
          : undefined,
        createdAt: now,
      },
      ...store.events,
    ].slice(0, maxEvents);
  }

  store.preferences = unique([...store.preferences, ...preferences]).slice(-maxPreferences);
  store.reusableComponents = mergeComponents(store.reusableComponents, components).slice(0, maxComponents);

  await writeMemoryStore(store);
}

async function readMemoryStore(): Promise<MemoryStore> {
  try {
    const raw = await fs.readFile(memoryFilePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<MemoryStore>;

    return {
      version: 1,
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      preferences: Array.isArray(parsed.preferences) ? parsed.preferences : [],
      reusableComponents: Array.isArray(parsed.reusableComponents) ? parsed.reusableComponents : [],
    };
  } catch {
    return emptyStore();
  }
}

async function writeMemoryStore(store: MemoryStore) {
  try {
    await fs.mkdir(path.dirname(memoryFilePath), { recursive: true });
    await fs.writeFile(memoryFilePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  } catch {
    // Memoria em arquivo e conveniencia local; a geracao nao deve falhar por I/O.
  }
}

function extractReusableComponents(
  project: BuilderProject,
  blueprint: AiGenerationBlueprint | null | undefined,
  createdAt: string,
) {
  const fromFiles = project.files
    .filter((file) => normalize(file.path).includes("component") || normalize(file.path).includes("modal"))
    .slice(0, 20)
    .map((file): ReusableComponentMemory => {
      const name = readableName(file.path);
      return {
        name,
        sourceProjectId: project.id,
        sourceProjectName: project.name,
        category: categorizeComponent(`${file.path} ${file.description}`),
        path: file.path,
        description: file.description,
        createdAt,
        usedCount: 1,
      };
    });

  const fromBlueprint = (blueprint?.componentLibrary ?? blueprint?.components ?? [])
    .slice(0, 20)
    .map((component): ReusableComponentMemory => ({
      name: titleCase(component),
      sourceProjectId: project.id,
      sourceProjectName: project.name,
      category: categorizeComponent(component),
      description: `Componente sugerido pela IA externa para ${project.industry}.`,
      createdAt,
      usedCount: 1,
    }));

  return mergeComponents([], [...fromFiles, ...fromBlueprint]);
}

function mergeComponents(current: ReusableComponentMemory[], next: ReusableComponentMemory[]) {
  const merged = new Map<string, ReusableComponentMemory>();

  for (const component of [...current, ...next]) {
    const key = `${normalize(component.name)}:${normalize(component.category)}`;
    const existing = merged.get(key);
    merged.set(
      key,
      existing
        ? {
            ...existing,
            description: component.description || existing.description,
            usedCount: existing.usedCount + component.usedCount,
          }
        : component,
    );
  }

  return Array.from(merged.values()).sort((left, right) => right.usedCount - left.usedCount);
}

function extractPreferences(message: string) {
  const lower = normalize(message);
  const preferences: string[] = [];
  const color = message.match(/#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/i)?.[0];

  if (color) preferences.push(`Cor preferida mencionada: ${color}`);
  if (lower.includes("verde neon")) preferences.push("Prefere destaque verde neon quando pedir visual premium.");
  if (lower.includes("whatsapp")) preferences.push("Valoriza CTA direto para WhatsApp.");
  if (lower.includes("admin") || lower.includes("painel")) preferences.push("Costuma pedir painel/admin junto do site.");
  if (lower.includes("nao quero") || lower.includes("sem ")) preferences.push(`Restricao declarada: ${message.slice(0, 180)}`);
  if (lower.includes("sempre") || lower.includes("prefiro") || lower.includes("gosto")) {
    preferences.push(`Preferencia declarada: ${message.slice(0, 180)}`);
  }

  return unique(preferences);
}

function rankByQuery<T>(items: T[], queryWords: Set<string>, buildText: (item: T) => string) {
  if (!queryWords.size) return items;

  return items
    .map((item) => ({
      item,
      score: scoreText(buildText(item), queryWords),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((item) => item.item);
}

function scoreText(text: string, queryWords: Set<string>) {
  const words = vectorize(text);
  let score = 0;
  for (const word of queryWords) {
    if (words.has(word)) score += 1;
  }
  return score;
}

function vectorize(input: string) {
  return new Set(
    normalize(input)
      .split(/[^a-z0-9]+/g)
      .filter((word) => word.length > 2 && !stopWords.has(word)),
  );
}

function categorizeComponent(input: string) {
  const lower = normalize(input);
  if (lower.includes("header") || lower.includes("cabecalho")) return "header";
  if (lower.includes("footer") || lower.includes("rodape")) return "footer";
  if (lower.includes("card")) return "card";
  if (lower.includes("dashboard") || lower.includes("metric")) return "dashboard";
  if (lower.includes("form") || lower.includes("login") || lower.includes("cadastro")) return "formulario";
  if (lower.includes("table") || lower.includes("tabela")) return "tabela";
  if (lower.includes("modal")) return "modal";
  if (lower.includes("menu") || lower.includes("nav")) return "menu";
  return "secao";
}

function readableName(filePath: string) {
  return titleCase(
    path
      .basename(filePath)
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]+/g, " "),
  );
}

function titleCase(input: string) {
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
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

const stopWords = new Set(["para", "com", "uma", "que", "por", "dos", "das", "site", "criar", "mude"]);
