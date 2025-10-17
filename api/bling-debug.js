// api/bling-listar-lojas.js
// Endpoint para descobrir todos os IDs e nomes das lojas

const BLING_API_BASE_URL = 'https://api.bling.com.br/Api/v3';
const access_token = process.env.BLING_ACCESS_TOKEN;

export default async function handler(req, res) {
  if (!access_token) {
    return res.status(401).json({ erro: 'ACCESS_TOKEN não configurado' });
  }

  try {
    // Busca algumas notas para pegar IDs de lojas
    const responseNotas = await fetch(`${BLING_API_BASE_URL}/nfce`, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json'
      }
    });
    
    const dataNotas = await responseNotas.json();
    
    if (!responseNotas.ok) {
      return res.status(500).json({ erro: 'Erro ao buscar notas', detalhes: dataNotas });
    }

    // Busca detalhes de algumas notas para pegar IDs completos
    const idsLojas = new Set();
    const notasParaVerificar = dataNotas.data.slice(0, 50);

    console.log(`Verificando ${notasParaVerificar.length} notas...`);

    for (const nota of notasParaVerificar) {
      try {
        const responseDetalhe = await fetch(`${BLING_API_BASE_URL}/nfce/${nota.id}`, {
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Accept': 'application/json'
          }
        });
        
        const dataDetalhe = await responseDetalhe.json();
        
        if (responseDetalhe.ok && dataDetalhe.data?.loja?.id) {
          idsLojas.add(dataDetalhe.data.loja.id);
        }
        
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (error) {
        console.error(`Erro nota ${nota.id}:`, error.message);
      }
    }

    const lojasInfo = [];
    
    // Tenta buscar informações de cada loja
    for (const lojaId of idsLojas) {
      try {
        const responseDeposito = await fetch(`${BLING_API_BASE_URL}/depositos/${lojaId}`, {
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Accept': 'application/json'
          }
        });
        
        const dataDeposito = await responseDeposito.json();
        
        if (responseDeposito.ok && dataDeposito.data) {
          lojasInfo.push({
            id: lojaId,
            nome: dataDeposito.data.descricao || dataDeposito.data.nome,
            situacao: dataDeposito.data.situacao,
            dados: dataDeposito.data
          });
        } else {
          lojasInfo.push({
            id: lojaId,
            nome: null,
            erro: dataDeposito.error || 'Erro ao buscar',
            status: responseDeposito.status
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        lojasInfo.push({
          id: lojaId,
          nome: null,
          erro: error.message
        });
      }
    }

    // Gera código para copiar
    const mapeamento = {};
    lojasInfo.forEach(loja => {
      if (loja.nome) {
        mapeamento[loja.id] = loja.nome;
      } else {
        mapeamento[loja.id] = `Loja ${loja.id} (sem nome)`;
      }
    });

    const codigo = `
// Cole este código no início do arquivo api/bling-nfce.js:

const MAPEAMENTO_LOJAS = ${JSON.stringify(mapeamento, null, 2)};
    `.trim();

    return res.status(200).json({
      status: 'success',
      totalLojasEncontradas: lojasInfo.length,
      lojas: lojasInfo,
      mapeamento,
      codigoParaCopiar: codigo
    });

  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}