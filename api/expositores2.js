export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  try {
    // Aqui usamos outra variável de ambiente
    const { BASE_ID, TABLE_NAME2, AIRTABLE_TOKEN } = process.env;

    if (!BASE_ID || !TABLE_NAME2 || !AIRTABLE_TOKEN) {
      throw new Error(
        "Variáveis de ambiente não configuradas: BASE_ID, TABLE_NAME2 ou AIRTABLE_TOKEN"
      );
    }

    console.log("Iniciando requisição para Airtable...");
    console.log("BASE_ID:", BASE_ID.substring(0, 8) + "...");
    console.log("TABLE_NAME2:", TABLE_NAME2);
    console.log("AIRTABLE_TOKEN:", AIRTABLE_TOKEN ? "Configurado" : "undefined");

    const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME2)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    console.log("Status da resposta:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro da API Airtable:", errorText);

      let errorDetails;
      try {
        errorDetails = JSON.parse(errorText);
      } catch (e) {
        errorDetails = { message: errorText };
      }

      throw new Error(
        `Erro HTTP ${response.status}: ${errorDetails.error?.message || errorText}`
      );
    }

    const data = await response.json();
    console.log("Dados recebidos:", data.records?.length || 0, "registros");

    res.status(200).json(data);
  } catch (err) {
    console.error("Erro na API:", err.message);
    res.status(500).json({
      error: {
        message: err.message,
        type: "API_ERROR",
      },
    });
  }
}
