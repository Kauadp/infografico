// api/bling-nfce.js
// API para buscar dados detalhados das NFC-e (Visão de NFC-e do Bling)

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
 * Busca detalhes COMPLETOS de uma NFC-e específica
 * Inclui: itens, totais, CFOP, formas de pagamento, etc
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
 * Processa dados para a Visão de NFC-e (similar ao Bling)
 */
function processarVisaoNFCe(notasDetalhadas) {
  // Inicializa totalizadores
  let totalVendas = 0;
  let totalDescontos = 0;
  let totalFrete = 0;
  let totalOutrasDespesas = 0;
  let totalTributos = 0;
  let quantidadeNotas = notasDetalhadas.length;

  // Agrupa por CFOP
  const porCFOP = {};
  
  // Agrupa por forma de pagamento
  const formasPagamento = {};
  
  // Produtos vendidos
  const produtos = {};
  
  // Notas por dia
  const notasPorDia = {};

  notasDetalhadas.forEach(nota => {
    // Valores totais
    const valorNota = parseFloat(nota.total || 0);
    const desconto = parseFloat(nota.desconto?.valor || 0);
    const frete = parseFloat(nota.transporte?.frete || 0);
    const outrasDespesas = parseFloat(nota.informacoesAdicionais?.outrasDespesas || 0);
    
    totalVendas += valorNota;
    totalDescontos += desconto;
    totalFrete += frete;
    totalOutrasDespesas += outrasDespesas;

    // Data
    const dataEmissao = nota.dataEmissao?.split(' ')[0];
    if (dataEmissao) {
      notasPorDia[dataEmissao] = (notasPorDia[dataEmissao] || 0) + 1;
    }

    // Processa itens
    if (nota.itens && Array.isArray(nota.itens)) {
      nota.itens.forEach(item => {
        const cfop = item.codigo_cfop || item.cfop || 'Não informado';
        const valorItem = parseFloat(item.valor || 0);
        const quantidade = parseFloat(item.quantidade || 0);
        const valorUnitario = parseFloat(item.valorUnitario || 0);
        const descontoItem = parseFloat(item.desconto || 0);

        // Agrupa por CFOP
        if (!porCFOP[cfop]) {
          porCFOP[cfop] = {
            cfop: cfop,
            descricao: getCFOPDescricao(cfop),
            quantidade: 0,
            valorTotal: 0,
            valorMedio: 0,
            notas: 0
          };
        }
        
        porCFOP[cfop].quantidade += quantidade;
        porCFOP[cfop].valorTotal += valorItem;
        porCFOP[cfop].notas++;

        // Produtos vendidos
        const nomeProduto = item.descricao || item.produto?.nome || 'Sem descrição';
        if (!produtos[nomeProduto]) {
          produtos[nomeProduto] = {
            nome: nomeProduto,
            codigo: item.codigo || item.produto?.codigo || '',
            quantidade: 0,
            valorTotal: 0,
            cfop: cfop
          };
        }
        
        produtos[nomeProduto].quantidade += quantidade;
        produtos[nomeProduto].valorTotal += valorItem;

        // Tributos do item
        if (item.tributos) {
          totalTributos += parseFloat(item.tributos.valorTotal || 0);
        }
      });
    }

    // Formas de pagamento
    if (nota.pagamento?.formas && Array.isArray(nota.pagamento.formas)) {
      nota.pagamento.formas.forEach(forma => {
        const tipoMeio = forma.tipo_meio || forma.forma || 'Não informado';
        const valor = parseFloat(forma.valor || 0);
        
        if (!formasPagamento[tipoMeio]) {
          formasPagamento[tipoMeio] = {
            forma: tipoMeio,
            quantidade: 0,
            valorTotal: 0
          };
        }
        
        formasPagamento[tipoMeio].quantidade++;
        formasPagamento[tipoMeio].valorTotal += valor;
      });
    }
  });

  // Calcula valores médios para CFOPs
  Object.values(porCFOP).forEach(cfop => {
    cfop.valorMedio = cfop.notas > 0 ? cfop.valorTotal / cfop.notas : 0;
  });

  // Ordena dados
  const cfopsOrdenados = Object.values(porCFOP)
    .sort((a, b) => b.valorTotal - a.valorTotal);

  const produtosOrdenados = Object.values(produtos)
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 20);

  const formasPagamentoOrdenadas = Object.values(formasPagamento)
    .sort((a, b) => b.valorTotal - a.valorTotal);

  const diasOrdenados = Object.entries(notasPorDia)
    .map(([data, qtd]) => ({ data, quantidade: qtd }))
    .sort((a, b) => a.data.localeCompare(b.data));

  return {
    resumo: {
      totalVendas: totalVendas.toFixed(2),
      totalDescontos: totalDescontos.toFixed(2),
      totalFrete: totalFrete.toFixed(2),
      totalOutrasDespesas: totalOutrasDespesas.toFixed(2),
      totalTributos: totalTributos.toFixed(2),
      quantidadeNotas: quantidadeNotas,
      ticketMedio: (totalVendas / quantidadeNotas).toFixed(2),
      valorLiquido: (totalVendas - totalDescontos + totalFrete + totalOutrasDespesas).toFixed(2)
    },
    cfops: cfopsOrdenados,
    formasPagamento: formasPagamentoOrdenadas,
    produtos: produtosOrdenados,
    notasPorDia: diasOrdenados
  };
}

/**
 * Retorna descrição do CFOP
 */
function getCFOPDescricao(cfop) {
  const cfops = {
    '5102': 'Venda de mercadoria adquirida ou recebida de terceiros',
    '5405': 'Venda de mercadoria adquirida ou recebida de terceiros em operação com mercadoria sujeita ao regime de substituição tributária',
    '5656': 'Venda de combustível ou lubrificante adquirido ou recebido de terceiros',
    '5929': 'Lançamento efetuado em decorrência de emissão de documento fiscal relativo a operação ou prestação também registrada em equipamento Emissor de Cupom Fiscal - ECF',
    '5403': 'Venda de mercadoria adquirida ou recebida de terceiros em operação com mercadoria sujeita ao regime de substituição tributária, na condição de contribuinte substituído'
  };
  
  return cfops[cfop] || 'Operação de saída';
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
    const { dataInicio, dataFim, limit = 100 } = req.query;

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

    console.log('📅 Buscando NFC-e:', filtro);

    // Busca lista de notas
    const notas = await fetchNFCe(filtro);
    const notasLimitadas = notas.slice(0, parseInt(limit));

    console.log(`📦 Buscando detalhes de ${notasLimitadas.length} notas...`);
    
    // Busca detalhes de cada nota
    const notasDetalhadas = [];
    for (const nota of notasLimitadas) {
      try {
        const detalhe = await fetchNFCeDetalhes(nota.id);
        notasDetalhadas.push(detalhe);
        
        // Log de progresso
        if (notasDetalhadas.length % 10 === 0) {
          console.log(`   ✓ ${notasDetalhadas.length}/${notasLimitadas.length}`);
        }
        
        // Delay para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (error) {
        console.error(`Erro ao buscar nota ${nota.id}:`, error.message);
      }
    }

    console.log(`✅ ${notasDetalhadas.length} notas processadas com sucesso`);

    // Processa dados no formato "Visão de NFC-e"
    const visaoNFCe = processarVisaoNFCe(notasDetalhadas);

    return res.status(200).json({
      status: 'success',
      periodo: {
        dataInicio: dataInicio || filtro.match(/\[(.*?) TO/)?.[1],
        dataFim: dataFim || filtro.match(/TO (.*?)\]/)?.[1]
      },
      totalNotasEncontradas: notas.length,
      notasProcessadas: notasDetalhadas.length,
      visaoNFCe
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}