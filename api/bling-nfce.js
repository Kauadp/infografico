// api/bling-nfce.js
// API para buscar dados das NFC-e com detalhes completos

const BLING_API_BASE_URL = 'https://api.bling.com.br/Api/v3';
const CLIENT_ID = process.env.BLING_CLIENT_ID;
const CLIENT_SECRET = process.env.BLING_CLIENT_SECRET;

let access_token = process.env.BLING_ACCESS_TOKEN;
let refresh_token = process.env.BLING_REFRESH_TOKEN;

/**
 * Renova o Access Token
 */
async function refreshAccessToken() {
  if (!refresh_token) {
    throw new Error("REFRESH TOKEN ausente");
  }

  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refresh_token
  });

  const response = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body
  });

  const data = await response.json();

  if (response.ok) {
    access_token = data.access_token;
    refresh_token = data.refresh_token;
    console.log('✅ Token renovado');
    return true;
  } else {
    throw new Error(`Falha ao renovar: ${data.error?.description}`);
  }
}

/**
 * Busca lista de NFC-e
 */
async function fetchNFCe(filtro = null) {
  let url = `${BLING_API_BASE_URL}/nfce`;
  if (filtro) {
    url += `?filters=${encodeURIComponent(filtro)}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Accept': 'application/json'
    }
  });

  const data = await response.json();

  if (response.ok) {
    return data.data || [];
  }

  if (data.error?.type === 'invalid_token') {
    await refreshAccessToken();
    return await fetchNFCe(filtro);
  }

  throw new Error(`API Error: ${JSON.stringify(data)}`);
}

/**
 * Busca detalhes de uma NFC-e específica
 */
async function fetchNFCeDetalhes(id) {
  const url = `${BLING_API_BASE_URL}/nfce/${id}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Accept': 'application/json'
    }
  });

  const data = await response.json();

  if (response.ok) {
    return data.data;
  }

  if (data.error?.type === 'invalid_token') {
    await refreshAccessToken();
    return await fetchNFCeDetalhes(id);
  }

  throw new Error(`API Error: ${JSON.stringify(data)}`);
}

/**
 * Processa e agrega dados para o dashboard
 */
function processarDadosDashboard(notas, notasDetalhadas) {
  // Totalizadores
  let totalVendas = 0;
  let totalItens = 0;
  let vendasPorDia = {};
  let produtosMaisVendidos = {};
  let formasPagamento = {};

  notasDetalhadas.forEach(nota => {
    // Total de vendas
    const valor = parseFloat(nota.total || 0);
    totalVendas += valor;

    // Vendas por dia
    const data = nota.dataEmissao?.split(' ')[0];
    if (data) {
      vendasPorDia[data] = (vendasPorDia[data] || 0) + valor;
    }

    // Produtos vendidos
    if (nota.itens) {
      nota.itens.forEach(item => {
        totalItens += parseInt(item.quantidade || 0);
        const nomeProduto = item.descricao || 'Sem descrição';
        
        if (!produtosMaisVendidos[nomeProduto]) {
          produtosMaisVendidos[nomeProduto] = {
            nome: nomeProduto,
            quantidade: 0,
            valor: 0
          };
        }
        
        produtosMaisVendidos[nomeProduto].quantidade += parseInt(item.quantidade || 0);
        produtosMaisVendidos[nomeProduto].valor += parseFloat(item.valor || 0);
      });
    }

    // Formas de pagamento
    if (nota.transporte?.volumes) {
      nota.transporte.volumes.forEach(vol => {
        if (vol.transportadora?.nome) {
          formasPagamento[vol.transportadora.nome] = 
            (formasPagamento[vol.transportadora.nome] || 0) + 1;
        }
      });
    }
  });

  // Ordena produtos mais vendidos
  const topProdutos = Object.values(produtosMaisVendidos)
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 10);

  return {
    resumo: {
      totalVendas: totalVendas.toFixed(2),
      totalNotas: notas.length,
      totalItens,
      ticketMedio: (totalVendas / notas.length).toFixed(2)
    },
    vendasPorDia: Object.entries(vendasPorDia)
      .map(([data, valor]) => ({ data, valor: valor.toFixed(2) }))
      .sort((a, b) => a.data.localeCompare(b.data)),
    topProdutos,
    ultimasVendas: notasDetalhadas.slice(0, 10).map(n => ({
      numero: n.numero,
      data: n.dataEmissao,
      valor: parseFloat(n.total || 0).toFixed(2),
      cliente: n.contato?.nome || 'Consumidor Final'
    }))
  };
}

/**
 * Handler principal
 */
export default async function handler(req, res) {
  if (!access_token) {
    return res.status(401).json({
      erro: 'Não autorizado',
      mensagem: 'Faça a autorização em /api/bling-callback'
    });
  }

  try {
    const { dataInicio, dataFim, limit, detalhes } = req.query;

    // Define filtro de data
    let filtro = null;
    if (dataInicio && dataFim) {
      filtro = `dataEmissao[${dataInicio} TO ${dataFim}]`;
    } else {
      // Padrão: últimos 7 dias
      const hoje = new Date();
      const semanaPassada = new Date(hoje);
      semanaPassada.setDate(hoje.getDate() - 7);
      
      const dataFimStr = hoje.toISOString().split('T')[0];
      const dataInicioStr = semanaPassada.toISOString().split('T')[0];
      
      filtro = `dataEmissao[${dataInicioStr} TO ${dataFimStr}]`;
    }

    console.log('📅 Buscando NFC-e com filtro:', filtro);

    // Busca lista de notas
    const notas = await fetchNFCe(filtro);
    const notasLimitadas = notas.slice(0, parseInt(limit) || 50);

    // Se pediu detalhes completos, busca cada nota
    let notasDetalhadas = [];
    if (detalhes === 'true') {
      console.log(`📦 Buscando detalhes de ${notasLimitadas.length} notas...`);
      
      for (const nota of notasLimitadas) {
        try {
          const detalhe = await fetchNFCeDetalhes(nota.id);
          notasDetalhadas.push(detalhe);
          
          // Delay para não sobrecarregar a API
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Erro ao buscar nota ${nota.id}:`, error.message);
        }
      }
    }

    // Processa dados para dashboard
    const dadosDashboard = detalhes === 'true' 
      ? processarDadosDashboard(notas, notasDetalhadas)
      : null;

    return res.status(200).json({
      status: 'success',
      filtro,
      totalNotas: notas.length,
      notasRetornadas: notasLimitadas.length,
      dashboard: dadosDashboard,
      notas: detalhes === 'true' ? notasDetalhadas : notasLimitadas
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}