const checkoutPlans = {
  starter: { title: "ZS Starter", unit_price: 29, tokens: 1500 },
  pro: { title: "ZS Pro", unit_price: 79, tokens: 6500 },
  studio: { title: "ZS Studio", unit_price: 199, tokens: 22000 },
} as const;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    planId?: keyof typeof checkoutPlans;
    email?: string;
  };
  const planId = body.planId ?? "starter";
  const plan = checkoutPlans[planId];

  if (!plan) {
    return Response.json(
      { ok: false, error: "Plano invalido." },
      { status: 400 },
    );
  }

  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

  if (!accessToken) {
    return Response.json({
      ok: false,
      setupRequired: true,
      message:
        "Configure MERCADO_PAGO_ACCESS_TOKEN para criar preferencias reais do Mercado Pago.",
      payload: {
        items: [
          {
            title: plan.title,
            quantity: 1,
            currency_id: "BRL",
            unit_price: plan.unit_price,
          },
        ],
        payer: { email: body.email },
        metadata: { planId, tokens: plan.tokens },
      },
    });
  }

  return Response.json({
    ok: true,
    message:
      "Token encontrado. Substitua este retorno pela chamada de criacao de preferencia do Mercado Pago.",
    payload: {
      planId,
      tokens: plan.tokens,
    },
  });
}
