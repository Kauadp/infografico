import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    // debug rápido
    console.log("BASE_ID:", process.env.BASE_ID);
    console.log("TABLE_NAME:", process.env.TABLE_NAME);
    console.log("AIRTABLE_TOKEN:", process.env.AIRTABLE_TOKEN ? "OK" : "undefined");

    const response = await fetch(
      `https://api.airtable.com/v0/${process.env.BASE_ID}/${process.env.TABLE_NAME}`,
      {
        headers: { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}` },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Erro HTTP ${response.status}: ${text}`);
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
