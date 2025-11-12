export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Responder a requisições OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Validar variáveis de ambiente
    const {BASE_ID, TABLE_NAME3, AIRTABLE_TOKEN } = process.env;
    
    if (!BASE_ID || !TABLE_NAME3 || !AIRTABLE_TOKEN) {
      throw new Error('Variáveis de ambiente não configuradas corretamente');
    }

    const baseUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME3)}`;

    // GET - Listar todos os agendamentos
    if (req.method === 'GET') {
      let allRecords = [];
      let offset = undefined;

      do {
        const url = offset ? `${baseUrl}?offset=${offset}` : baseUrl;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: { 
            'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
            'Content-Type': 'application/json'
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        allRecords = allRecords.concat(data.records || []);
        offset = data.offset;

      } while (offset);

      return res.status(200).json({ records: allRecords });
    }

    // POST - Criar novo agendamento
    if (req.method === 'POST') {
      const { responsavel, empresa, dataReuniao, ticketMedio, numeroLojas, numeroFuncionarios, segmento, localEvento } = req.body;

      if (!responsavel || !empresa || !dataReuniao) {
        return res.status(400).json({ 
          error: { message: 'Campos obrigatórios: responsavel, empresa, dataReuniao' }
        });
      }

      const dataCriacao = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

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
            'StatusAvanco': 'Pendente',
            'DataCriacao': dataCriacao 
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao criar registro: ${errorText}`);
      }

      const data = await response.json();
      return res.status(201).json(data);
    }

    // PATCH - Atualizar registro existente
    if (req.method === 'PATCH') {
      const { recordId, fields } = req.body;

      if (!recordId || !fields) {
        return res.status(400).json({ 
          error: { message: 'recordId e fields são obrigatórios' }
        });
      }

      const response = await fetch(`${baseUrl}/${recordId}`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao atualizar registro: ${errorText}`);
      }

      const data = await response.json();
      return res.status(200).json(data);
    }

    // DELETE - Deletar registro
    if (req.method === 'DELETE') {
      const { recordId } = req.body;

      if (!recordId) {
        return res.status(400).json({ 
          error: { message: 'recordId é obrigatório' }
        });
      }

      const response = await fetch(`${baseUrl}/${recordId}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao deletar registro: ${errorText}`);
      }

      return res.status(200).json({ deleted: true, id: recordId });
    }

    // Método não suportado
    return res.status(405).json({ 
      error: { message: 'Método não permitido' }
    });

  } catch (err) {
    console.error("Erro na API:", err.message);
    console.error("Stack trace:", err.stack);
    
    res.status(500).json({ 
      error: {
        message: err.message,
        type: "API_ERROR"
      }
    });
  }
}