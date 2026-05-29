type EditDoneReplyInput = {
  userName?: string;
  projectName: string;
  summary: string;
  target?: string;
  isRemoval: boolean;
};

const openers = [
  "Pronto",
  "Feito",
  "Resolvido",
  "Atualizei",
  "Ja deixei pronto",
  "Ajustei",
  "Pode ver agora",
  "Concluido",
  "Certo",
  "Aplicado",
  "Terminei",
  "Esta pronto",
];

const removalVerbs = [
  "removi",
  "retirei",
  "apaguei",
  "tirei",
  "eliminei",
  "ocultei",
  "limpei",
  "desativei",
  "removi do preview",
  "retirei da pagina",
  "apaguei da interface",
  "desliguei no projeto",
];

const updateVerbs = [
  "ajustei",
  "atualizei",
  "mudei",
  "apliquei",
  "refiz",
  "organizei",
  "corrigi",
  "regenerei",
  "melhorei",
  "adaptei",
  "salvei",
  "montei",
];

const targetFallbacks = [
  "o item pedido",
  "essa parte do site",
  "a secao indicada",
  "o bloco solicitado",
  "o componente do preview",
  "a area que voce pediu",
  "o trecho indicado",
  "a interface solicitada",
];

const continuations = [
  "O preview ja foi atualizado.",
  "Os arquivos sugeridos tambem foram regenerados.",
  "Mantive o restante do layout funcionando.",
  "A mudanca ficou aplicada no projeto atual.",
  "O site continua navegavel sem bloquear o visitante.",
  "A estrutura do projeto foi preservada.",
  "A alteracao entrou sem mexer nas outras secoes.",
  "Tambem atualizei o resumo do projeto.",
];

export const responseVariationCount =
  openers.length * removalVerbs.length * updateVerbs.length * targetFallbacks.length * continuations.length;

export function buildEditDoneReply(input: EditDoneReplyInput) {
  const user = cleanUserName(input.userName);
  const seed = `${input.projectName}:${input.summary}:${input.target ?? ""}:${input.isRemoval ? "remove" : "update"}`;
  const opener = pick(openers, seed, 0);
  const verb = input.isRemoval ? pick(removalVerbs, seed, 1) : pick(updateVerbs, seed, 2);
  const target = input.target || pick(targetFallbacks, seed, 3);
  const continuation = pick(continuations, seed, 4);

  return [
    `${opener}, ${user}. ${capitalize(verb)} ${target} que voce pediu.`,
    input.summary,
    continuation,
  ].join("\n\n");
}

function cleanUserName(userName?: string) {
  const clean = userName?.trim().replace(/\s+/g, " ").slice(0, 42);
  return clean || "zs";
}

function pick(items: string[], seed: string, offset: number) {
  return items[(hash(seed) + offset * 997) % items.length];
}

function hash(input: string) {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function capitalize(input: string) {
  return input.charAt(0).toUpperCase() + input.slice(1);
}
