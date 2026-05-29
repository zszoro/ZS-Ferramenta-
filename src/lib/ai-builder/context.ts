import { buildAgentPlan } from "./agents";
import { buildRagContext } from "./rag";

export const platformSystemPrompt = `
Voce e a IA desenvolvedora da ZS Ferramenta.
Atue como senior full stack engineer, UI/UX designer, DevOps engineer e product engineer.
Antes de criar qualquer coisa, procure padroes, templates e componentes reutilizaveis.
Entenda pedidos simples e complexos: alterar titulo, cor, descricao, imagem, secao, layout, API, banco, autenticacao e deploy.
Nunca exponha tokens ou secrets no frontend.
Todo preview deve ser gerado automaticamente e ficar isolado em iframe sandbox.
Quando houver informacoes do projeto, incorpore nome, nicho, telefone, email, cor principal e objetivo no prompt final.
`;

export const bakerySitePrompt = `
Crie um site de padaria completo e pronto para Vercel.
Estrutura obrigatoria: cabecalho fixo com logo, menu Inicio/Sobre/Produtos/Cardapio/Depoimentos/Contato e CTA de pedido; hero com titulo grande, subtitulo, CTA principal, CTA secundario e imagem de paes; secao sobre com diferenciais; grid de produtos com imagem, nome, descricao e preco; categorias Paes, Bolos, Doces, Salgados e Bebidas; destaque de Combo do cafe da manha; depoimentos; contato com endereco, horario, WhatsApp e mapa; rodape com links e redes sociais.
Design: moderno, limpo, responsivo, tons quentes de padaria, cards arredondados, sombras suaves, hover em botoes e animacoes leves ao rolar.
Use textos e imagens ficticias ou gratuitas. Nao copie marca, texto ou imagem de referencia.
`;

export type ReadyTemplateFile = {
  path: string;
  language: string;
  description: string;
  content: string;
};

export function buildAugmentedPrompt(input: {
  message: string;
  industry: string;
  projectName?: string;
  brief?: {
    companyName: string;
    phoneWhatsapp?: string;
    email?: string;
    niche: string;
    primaryColor: string;
  } | null;
}) {
  const rag = buildRagContext(`${input.industry} ${input.message}`);
  const agentPlan = buildAgentPlan(input.message, input.industry);
  const brief = input.brief
    ? [
        `Empresa: ${input.brief.companyName}`,
        `Nicho: ${input.brief.niche}`,
        `Cor principal: ${input.brief.primaryColor}`,
        input.brief.phoneWhatsapp ? `WhatsApp: ${input.brief.phoneWhatsapp}` : "",
        input.brief.email ? `Email: ${input.brief.email}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "Sem briefing estruturado.";

  return [
    platformSystemPrompt.trim(),
    normalize(input.industry).includes("padaria") ? bakerySitePrompt.trim() : "",
    "Contexto do projeto:",
    brief,
    input.projectName ? `Projeto atual: ${input.projectName}` : "",
    "Recuperacao RAG local:",
    rag.context || "Nenhum documento local relevante encontrado.",
    "Plano multiagente:",
    agentPlan.map((item) => `- ${item}`).join("\n"),
    "Pedido do usuario:",
    input.message,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function getReusableTemplateFiles(slug: string): ReadyTemplateFile[] {
  return [
    {
      path: `src/components/generated/${slug}/login-register-modal.tsx`,
      language: "tsx",
      description: "Atalho para o modal completo de login local gerado.",
      content: `export { LoginRegisterModal } from "./LoginRegisterModal";
export type { LocalAuthUser } from "@/lib/generated/${slug}-local-auth";
`,
    },
    {
      path: `src/components/generated/${slug}/pricing-modal.tsx`,
      language: "tsx",
      description: "Modal de planos com tokens e ponto de integracao Mercado Pago.",
      content: `const plans = [
  { name: "Starter", price: "R$ 29/semana", tokens: 1500 },
  { name: "Pro", price: "R$ 79/semana", tokens: 6500 },
  { name: "Scale", price: "R$ 199/semana", tokens: 22000 },
];

export function PricingModal(props: { onClose: () => void; onChoose: (plan: string) => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur">
      <section className="grid w-full max-w-4xl gap-4 rounded-2xl bg-white p-6 shadow-2xl md:grid-cols-3">
        {plans.map((plan) => (
          <article className="rounded-xl border p-5" key={plan.name}>
            <h3 className="text-xl font-black">{plan.name}</h3>
            <p className="mt-2 text-3xl font-black">{plan.price}</p>
            <p className="mt-2 text-sm text-zinc-600">{plan.tokens} tokens por semana</p>
            <button className="mt-5 w-full rounded-xl bg-black p-3 font-bold text-white" onClick={() => props.onChoose(plan.name)} type="button">
              Escolher
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}`,
    },
    {
      path: `src/components/generated/${slug}/bakery-products.tsx`,
      language: "tsx",
      description: "Grid reutilizavel para produtos de padaria.",
      content: `const products = [
  { category: "Paes", name: "Pao frances", price: "R$ 0,90" },
  { category: "Bolos", name: "Bolo caseiro", price: "R$ 24,90" },
  { category: "Doces", name: "Sonho de creme", price: "R$ 7,90" },
  { category: "Salgados", name: "Pao de queijo", price: "R$ 5,90" },
  { category: "Bebidas", name: "Cafe coado", price: "R$ 6,90" },
];

export function BakeryProducts() {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      {products.map((product) => (
        <article className="rounded-2xl bg-white p-5 shadow" key={product.name}>
          <p className="text-xs font-bold uppercase text-amber-700">{product.category}</p>
          <h3 className="mt-2 text-xl font-black">{product.name}</h3>
          <p className="mt-3 font-bold">{product.price}</p>
        </article>
      ))}
    </section>
  );
}`,
    },
  ];
}

function normalize(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
