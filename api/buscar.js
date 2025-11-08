export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { nicho, estado } = req.body;
  if (!nicho || !estado) {
    return res.status(400).json({ error: "Nicho ou estado requerido" });
  }

  // MOCK: dados falsos para teste
  const results = [
    {
      name: `${nicho} Exemplo 1`,
      address: `${estado}, Rua Falsa, 123`,
      phone: "11999999999",
      photo: null,
      whatsapp: "https://wa.me/5511999999999"
    },
    {
      name: `${nicho} Exemplo 2`,
      address: `${estado}, Avenida Teste, 456`,
      phone: "11988888888",
      photo: null,
      whatsapp: "https://wa.me/5511988888888"
    }
  ];

  res.status(200).json(results);
}
