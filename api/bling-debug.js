// api/bling-debug.js
// Endpoint para debugar estrutura dos dados do Bling

const BLING_API_BASE_URL = 'https://api.bling.com.br/Api/v3';
const access_token = process.env.BLING_ACCESS_TOKEN;

export default async function handler(req, res) {
  if (!access_token) {
    return res.status(401).json({ erro: 'ACCESS_TOKEN não configurado' });
  }

  try {
    // Busca lista básica
    console.log('1. Buscando lista de NFC-e...');
    const responseList = await fetch(`${BLING_API_BASE_URL}/nfce`, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json'
      }
    });
    const dataList = await responseList.json();
    
    if (!responseList.ok) {
      return res.status(500).json({ erro: 'Erro ao buscar lista', detalhes: dataList });
    }

    const primeiroId = dataList.data[0]?.id;
    
    if (!primeiroId) {
      return res.status(404).json({ erro: 'Nenhuma nota encontrada' });
    }

    console.log(`2. Buscando detalhes da nota ID: ${primeiroId}...`);
    
    // Busca detalhes da primeira nota
    const responseDetail = await fetch(`${BLING_API_BASE_URL}/nfce/${primeiroId}`, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json'
      }
    });
    const dataDetail = await responseDetail.json();

    if (!responseDetail.ok) {
      return res.status(500).json({ erro: 'Erro ao buscar detalhes', detalhes: dataDetail });
    }

    const nota = dataDetail.data;

    // Retorna estrutura completa para análise
    return res.status(200).json({
      status: 'success',
      mensagem: 'Estrutura da nota para análise',
      analise: {
        id: nota.id,
        numero: nota.numero,
        
        loja: {
          estruturaCompleta: nota.loja,
          id: nota.loja?.id,
          nome: nota.loja?.nome,
          descricao: nota.loja?.descricao,
          tipo: typeof nota.loja
        },
        
        total: {
          valor: nota.total,
          tipo: typeof nota.total
        },
        
        itens: {
          quantidade: nota.itens?.length || 0,
          exemplo: nota.itens?.[0] ? {
            codigo: nota.itens[0].codigo,
            descricao: nota.itens[0].descricao,
            valor: nota.itens[0].valor,
            quantidade: nota.itens[0].quantidade,
            estruturaCompleta: nota.itens[0]
          } : null
        },

        todasChaves: Object.keys(nota),
        
        estruturaCompleta: nota
      }
    });

  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}