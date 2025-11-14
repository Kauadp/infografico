// api/expositores3.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { BASE_ID, TABLE_NAME3, AIRTABLE_TOKEN } = process.env;
    if (!BASE_ID || !TABLE_NAME3 || !AIRTABLE_TOKEN) {
      throw new Error('Variáveis de ambiente não configuradas');
    }

    const baseUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME3)}`;

    // GET - Listar todos
    if (req.method === 'GET') {
      let allRecords = [];
      let offset = undefined;

      do {
        const url = offset ? `${baseUrl}?offset=${offset}` : baseUrl;
        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
        });

        if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);

        const data = await response.json();
        allRecords = allRecords.concat(data.records || []);
        offset = data.offset;
      } while (offset);

      return res.status(200).json({ records: allRecords });
    }

    // POST - Criar novo
    if (req.method === 'POST') {
      const {
        responsavel, empresa, dataReuniao, ticketMedio, numeroLojas,
        numeroFuncionarios, segmento, localEvento, statusNegociacao
      } = req.body;

      if (!responsavel || !empresa || !dataReuniao) {
        return res.status(400).json({ error: { message: 'Campos obrigatórios faltando' } });
      }

      const dataCriacao = new Date().toISOString().split('T')[0];
      const statusNeg = statusNegociacao || 'Reunião Agendada';
      const statusAvanco = statusNeg === 'Contrato Assinado' ? 'Avançou' : 'Pendente';

      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: {
            'Responsavel': responsavel,
            'Empresa': empresa,
            'DataReuniao': dataReuniao,
            'TicketMedio': ticketMedio || null,
            'NumeroLojas': numeroLojas || null,
            'NumeroFuncionarios': numeroFuncionarios || null,
            'Segmento': segmento || null,
            'LocalEvento': localEvento || null,
            'DataCriacao': dataCriacao,
            'Status Negociação': statusNeg,
            'StatusAvanco': statusAvanco
          }
        })
      });

      if (!response.ok) throw new Error(`Erro ao criar: ${await response.text()}`);
      const data = await response.json();
      return res.status(201).json(data);
    }

    // PATCH - Atualizar
    if (req.method === 'PATCH') {
      const { recordId, fields } = req.body;
      if (!recordId || !fields) {
        return res.status(400).json({ error: { message: 'recordId e fields obrigatórios' } });
      }

      const response = await fetch(`${baseUrl}/${recordId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields })
      });

      if (!response.ok) throw new Error(`Erro ao atualizar: ${await response.text()}`);
      const data = await response.json();
      return res.status(200).json(data);
    }

    // DELETE
    if (req.method === 'DELETE') {
      const { recordId } = req.body;
      if (!recordId) return res.status(400).json({ error: { message: 'recordId obrigatório' } });

      const response = await fetch(`${baseUrl}/${recordId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
      });

      if (!response.ok) throw new Error(`Erro ao deletar: ${await response.text()}`);
      return res.status(200).json({ deleted: true, id: recordId });
    }

    return res.status(405).json({ error: { message: 'Método não permitido' } });

  } catch (err) {
    console.error('Erro na API:', err);
    res.status(500).json({ error: { message: err.message } });
  }
}