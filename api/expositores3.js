// api/expositores3.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { BASE_ID, TABLE_NAME3, AIRTABLE_TOKEN } = process.env;
  if (!BASE_ID || !TABLE_NAME3 || !AIRTABLE_TOKEN) {
    return res.status(500).json({ error: 'Configuração do Airtable faltando' });
  }

  const baseUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME3)}`;

  try {
    // GET – lista tudo
    if (req.method === 'GET') {
      let records = [];
      let offset = null;
      do {
        const url = offset ? `${baseUrl}?offset=${offset}` : baseUrl;
        const resp = await fetch(url, {
          headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
        });
        const data = await resp.json();
        records = records.concat(data.records || []);
        offset = data.offset;
      } while (offset);
      return res.status(200).json({ records });
    }

    // POST – criar novo registro
    if (req.method === 'POST') {
      const {
        responsavel, empresa, dataReuniao, ticketMedio, numeroLojas,
        numeroFuncionarios, segmento, localEvento, statusNegociacao
      } = req.body;

      if (!responsavel || !empresa || !dataReuniao) {
        return res.status(400).json({ error: 'Campos obrigatórios faltando' });
      }

      const hoje = new Date().toISOString().split('T')[0];

      const fields = {
        Responsavel: responsavel,
        Empresa: empresa,
        DataReuniao: dataReuniao,
        TicketMedio: ticketMedio || null,
        NumeroLojas: numeroLojas || null,
        NumeroFuncionarios: numeroFuncionarios || null,
        Segmento: segmento || null,
        LocalEvento: localEvento || null,
        DataCriacao: hoje,
        statusNegociacao: statusNegociacao || 'Reunião Agendada',
        dataStatus: hoje,                                   // <-- NOVO: grava dataStatus na criação
        StatusAvanco: statusNegociacao === 'Contrato Assinado' ? 'Avançou' : 'Pendente'
      };

      const resp = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields })
      });

      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      return res.status(201).json(data);
    }

    // PATCH – atualizar registro (principalmente statusNegociacao)
    if (req.method === 'PATCH') {
      const { recordId, fields } = req.body;
      if (!recordId || !fields) {
        return res.status(400).json({ error: 'recordId e fields são obrigatórios' });
      }

      // SE O STATUS FOR ALTERADO → ATUALIZA dataStatus AUTOMATICAMENTE
      if (fields.statusNegociacao) {
        fields.dataStatus = new Date().toISOString().split('T')[0];
      }

      // Se chegar em Contrato Assinado → marca como Avançou
      if (fields.statusNegociacao === 'Contrato Assinado') {
        fields.StatusAvanco = 'Avançou';
      }

      const resp = await fetch(`${baseUrl}/${recordId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields })
      });

      if (!resp.ok) {
        const txt = await resp.text();
        console.error('Erro Airtable PATCH:', txt);
        throw new Error(txt);
      }

      const data = await resp.json();
      return res.status(200).json(data);
    }

    // DELETE
    if (req.method === 'DELETE') {
      const { recordId } = req.body;
      if (!recordId) return res.status(400).json({ error: 'recordId obrigatório' });

      const resp = await fetch(`${baseUrl}/${recordId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
      });

      if (!resp.ok) throw new Error(await resp.text());
      return res.status(200).json({ deleted: true });
    }

    res.status(405).json({ error: 'Método não permitido' });

  } catch (err) {
    console.error('Erro no backend:', err.message);
    res.status(500).json({ error: err.message });
  }
}