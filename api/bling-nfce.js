// api/bling-nfce.js
// API para buscar dados das NFC-e no formato da listagem do Bling

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
 * Busca detalhes COMPLETOS de uma NFC-e
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
 * Converte situação numérica para texto
 */
function getSituacaoTexto(situacao) {
  const situacoes = {
    0: 'Pendente',
    1: 'Em processamento',
    2: 'Processada com avisos',
    3: 'Rejeitada',
    4: 'Autorizada',
    5: 'Autorizada',
    6: 'Cancelada',
    7: 'Inutilizada',
    8: 'Denegada'
  };
  return situacoes[situacao] || 'Desconhecida';
}

/**
 * Converte tipo numérico para texto
 */
function getTipoTexto(tipo) {
  const tipos = {
    0: 'NFC-e',
    1: 'NF-e'
  };
  return tipos[tipo] || 'Não definido';
}

/**
 * Formata os dados no estilo da listagem do Bling
 */
function formatarDadosListagem(notasDetalhadas) {
  return notasDetalhadas.map(nota => {
    // Monta objeto com todos os campos da listagem
    const notaFormatada = {
      // Dados principais
      id: nota.id,
      nome: nota.contato?.nome || 'Consumidor Final',
      dataEmissao: nota.dataEmissao,
      numero: nota.numero,
      situacao: getSituacaoTexto(nota.situacao),
      cnpjCpf: nota.contato?.numeroDocumento || '',
      uf: nota.contato?.endereco?.uf || '',
      natureza: nota.naturezaOperacao?.naturezaOperacao || 'Venda de mercadoria a não contribuinte Cupom Fiscal',
      serie: nota.serie || '1',
      finalidade: 'NF-e normal',
      tipoNota: getTipoTexto(nota.tipo),
      ambiente: 'Produção',
      chaveAcesso: nota.chaveAcesso || '',
      
      // Dados do vendedor
      vendedor: {
        codigo: nota.vendedor?.id || '-',
        nome: nota.vendedor?.nome || '-',
        email: nota.vendedor?.email || '-'
      },
      
      // Dados da loja
      loja: {
        id: nota.loja?.id || 0,
        nome: nota.loja?.nome || 'Não informado'
      },
      
      // Totais
      valorTotal: parseFloat(nota.total || 0),
      desconto: parseFloat(nota.desconto?.valor || 0),
      
      // Itens (produtos)
      itens: (nota.itens || []).map(item => ({
        codigo: item.codigo || item.produto?.codigo || '',
        descricao: item.descricao || item.produto?.nome || 'Sem descrição',
        unidade: item.unidade || 'UN',
        quantidade: parseFloat(item.quantidade || 0),
        valorUnitario: parseFloat(item.valorUnitario || item.valor || 0),
        valorTotal: parseFloat(item.valor || 0)
      }))
    };
    
    return notaFormatada;
  });
}

/**
 * Gera estatísticas agregadas
 */
function gerarEstatisticas(notasFormatadas) {
  const stats = {
    totalNotas: notasFormatadas.length,
    totalVendas: 0,
    totalItens: 0,
    porSituacao: {},
    porLoja: {},
    produtosMaisVendidos: {}
  };
  
  notasFormatadas.forEach(nota => {
    // Total de vendas
    stats.totalVendas += nota.valorTotal;
    
    // Por situação
    stats.porSituacao[nota.situacao] = (stats.porSituacao[nota.situacao] || 0) + 1;
    
    // Por loja
    const nomeLoja = nota.loja.nome || 'Não informado';
    if (!stats.porLoja[nomeLoja]) {
      stats.porLoja[nomeLoja] = { quantidade: 0, valor: 0 };
    }
    stats.porLoja[nomeLoja].quantidade++;
    stats.porLoja[nomeLoja].valor += nota.valorTotal;
    
    // Produtos
    nota.itens.forEach(item => {
      stats.totalItens += item.quantidade;
      
      if (!stats.produtosMaisVendidos[item.codigo]) {
        stats.produtosMaisVendidos[item.codigo] = {
          codigo: item.codigo,
          descricao: item.descricao,
          quantidade: 0,
          valor: 0
        };
      }
      
      stats.produtosMaisVendidos[item.codigo].quantidade += item.quantidade;
      stats.produtosMaisVendidos[item.codigo].valor += item.valorTotal;
    });
  });
  
  // Ordena produtos
  stats.topProdutos = Object.values(stats.produtosMaisVendidos)
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 20);
  
  delete stats.produtosMaisVendidos;
  
  return stats;
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
    const { dataInicio, dataFim, limit = 50, formato = 'completo' } = req.query;

    // Define filtro de data
    let filtro = null;
    if (dataInicio && dataFim) {
      filtro = `dataEmissao[${dataInicio} TO ${dataFim}]`;
    } else {
      // Padrão: últimos 30 dias
      const hoje = new Date();
      const mesPassado = new Date(hoje);
      mesPassado.setDate(hoje.getDate() - 30);
      
      const dataFimStr = hoje.toISOString().split('T')[0];
      const dataInicioStr = mesPassado.toISOString().split('T')[0];
      
      filtro = `dataEmissao[${dataInicioStr} TO ${dataFimStr}]`;
    }

    console.log('📅 Buscando NFC-e:', filtro);

    // Busca lista de notas
    const notas = await fetchNFCe(filtro);
    const notasLimitadas = notas.slice(0, parseInt(limit));

    // Se formato='simples', retorna só a lista básica
    if (formato === 'simples') {
      return res.status(200).json({
        status: 'success',
        totalEncontrado: notas.length,
        totalRetornado: notasLimitadas.length,
        notas: notasLimitadas
      });
    }

    // Se formato='completo', busca detalhes de cada nota
    console.log(`📦 Buscando detalhes de ${notasLimitadas.length} notas...`);
    
    const notasDetalhadas = [];
    for (let i = 0; i < notasLimitadas.length; i++) {
      try {
        const detalhe = await fetchNFCeDetalhes(notasLimitadas[i].id);
        notasDetalhadas.push(detalhe);
        
        // Log de progresso a cada 10 notas
        if ((i + 1) % 10 === 0) {
          console.log(`   ✓ ${i + 1}/${notasLimitadas.length}`);
        }
        
        // Delay para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Erro ao buscar nota ${notasLimitadas[i].id}:`, error.message);
      }
    }

    console.log(`✅ ${notasDetalhadas.length} notas processadas`);

    // Formata dados no estilo da listagem
    const notasFormatadas = formatarDadosListagem(notasDetalhadas);
    
    // Gera estatísticas
    const estatisticas = gerarEstatisticas(notasFormatadas);

    return res.status(200).json({
      status: 'success',
      periodo: {
        dataInicio: dataInicio || filtro.match(/\[(.*?) TO/)?.[1],
        dataFim: dataFim || filtro.match(/TO (.*?)\]/)?.[1]
      },
      totalEncontrado: notas.length,
      totalProcessado: notasDetalhadas.length,
      estatisticas,
      notas: notasFormatadas
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}