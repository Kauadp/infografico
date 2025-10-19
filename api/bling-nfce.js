// api/bling-nfce.js
// API para auditoria completa de NFC-e

const BLING_API_BASE_URL = 'https://api.bling.com.br/Api/v3';
const CLIENT_ID = process.env.BLING_CLIENT_ID;
const CLIENT_SECRET = process.env.BLING_CLIENT_SECRET;

let access_token = process.env.BLING_ACCESS_TOKEN;
let refresh_token = process.env.BLING_REFRESH_TOKEN;

// ⚠️ MAPEAMENTO MANUAL DE LOJAS (baseado nos depósitos do Bling)
const MAPEAMENTO_LOJAS = {
  205613392: 'Tapetes São Carlos PDV',
  204860835: 'Acostamento SP',
  205371255: 'Aramis SP',
  14888497580: 'Acostamento SP',
  14888497574: 'Aramis SP',
  0: 'Loja Principal',
  // IDs de lojas que aparecem nas notas:
  // 205613392 -> já mapeado
  // Adicione mais conforme aparecerem
};

// Cache de lojas
const cacheLojas = {};

async function refreshAccessToken() {
  if (!refresh_token) throw new Error("REFRESH TOKEN ausente");

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
    return true;
  }
  throw new Error(`Falha ao renovar: ${data.error?.description}`);
}

/**
 * Busca informações de uma loja pelo ID
 */
async function fetchLoja(lojaId) {
  if (!lojaId || lojaId === 0) return MAPEAMENTO_LOJAS[0] || 'Loja Principal';
  
  // Verifica mapeamento manual primeiro
  if (MAPEAMENTO_LOJAS[lojaId]) {
    cacheLojas[lojaId] = MAPEAMENTO_LOJAS[lojaId];
    return MAPEAMENTO_LOJAS[lojaId];
  }
  
  // Verifica cache
  if (cacheLojas[lojaId]) return cacheLojas[lojaId];

  try {
    const url = `${BLING_API_BASE_URL}/depositos/${lojaId}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();
    
    if (response.ok && data.data) {
      const nomeLoja = data.data.descricao || data.data.nome || `Loja ${lojaId}`;
      cacheLojas[lojaId] = nomeLoja;
      return nomeLoja;
    }
  } catch (error) {
    console.error(`Erro ao buscar loja ${lojaId}:`, error.message);
  }

  // Fallback
  const fallback = `Loja ID: ${lojaId}`;
  cacheLojas[lojaId] = fallback;
  return fallback;
}

async function fetchNFCe(filtro = null) {
  let url = `${BLING_API_BASE_URL}/nfce`;
  if (filtro) url += `?filters=${encodeURIComponent(filtro)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Accept': 'application/json'
    }
  });

  const data = await response.json();
  if (response.ok) return data.data || [];
  if (data.error?.type === 'invalid_token') {
    await refreshAccessToken();
    return await fetchNFCe(filtro);
  }
  throw new Error(`API Error: ${JSON.stringify(data)}`);
}

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
  if (response.ok) return data.data;
  if (data.error?.type === 'invalid_token') {
    await refreshAccessToken();
    return await fetchNFCeDetalhes(id);
  }
  throw new Error(`API Error: ${JSON.stringify(data)}`);
}

function getSituacaoTexto(situacao) {
  const situacoes = {
    0: 'Pendente', 1: 'Em processamento', 2: 'Processada',
    3: 'Rejeitada', 4: 'Autorizada', 5: 'Autorizada',
    6: 'Cancelada', 7: 'Inutilizada', 8: 'Denegada'
  };
  return situacoes[situacao] || 'Desconhecida';
}

function processarDadosAuditoria(notasDetalhadas) {
  // Filtra apenas notas AUTORIZADAS (situacao 4 ou 5)
  const notasAutorizadas = notasDetalhadas.filter(n => n.situacao === 4 || n.situacao === 5);

  const dados = {
    geral: {
      totalNotas: notasAutorizadas.length,
      totalVendas: 0,
      totalItens: 0,
      totalDescontos: 0
    },
    porLoja: {},
    porDia: {},
    porHora: {},
    produtos: {},
    formasPagamento: {}
  };

  notasAutorizadas.forEach(nota => {
    // CORRIGIDO: usar valorNota ao invés de total
    const valorNota = parseFloat(nota.valorNota || 0);
    const desconto = parseFloat(nota.desconto?.valor || 0);
    const nomeLoja = nota.nomeLoja || 'Não informado';
    
    // Extrai data e hora
    const [dataParte, horaParte] = (nota.dataEmissao || '').split(' ');
    const hora = horaParte?.split(':')[0] || '00';

    // Totais gerais
    dados.geral.totalVendas += valorNota;
    dados.geral.totalDescontos += desconto;

    // Por loja
    if (!dados.porLoja[nomeLoja]) {
      dados.porLoja[nomeLoja] = {
        nome: nomeLoja,
        quantidadeNotas: 0,
        valorTotal: 0,
        itensVendidos: 0,
        ticketMedio: 0
      };
    }
    dados.porLoja[nomeLoja].quantidadeNotas++;
    dados.porLoja[nomeLoja].valorTotal += valorNota;

    // Por dia
    if (!dados.porDia[dataParte]) {
      dados.porDia[dataParte] = {
        data: dataParte,
        quantidadeNotas: 0,
        valorTotal: 0,
        itensVendidos: 0
      };
    }
    dados.porDia[dataParte].quantidadeNotas++;
    dados.porDia[dataParte].valorTotal += valorNota;

    // Por hora
    const chaveHora = `${dataParte} ${hora}:00`;
    if (!dados.porHora[chaveHora]) {
      dados.porHora[chaveHora] = {
        hora: chaveHora,
        quantidadeNotas: 0,
        valorTotal: 0
      };
    }
    dados.porHora[chaveHora].quantidadeNotas++;
    dados.porHora[chaveHora].valorTotal += valorNota;

    // Produtos
    if (nota.itens && Array.isArray(nota.itens)) {
      nota.itens.forEach(item => {
        const qtd = parseFloat(item.quantidade || 0);
        const valor = parseFloat(item.valor || 0);
        const codigo = item.codigo || 'SEM_CODIGO';
        const descricao = item.descricao || 'Sem descrição';

        dados.geral.totalItens += qtd;
        dados.porLoja[nomeLoja].itensVendidos += qtd;
        dados.porDia[dataParte].itensVendidos += qtd;

        if (!dados.produtos[codigo]) {
          dados.produtos[codigo] = {
            codigo,
            descricao,
            quantidade: 0,
            valorTotal: 0
          };
        }
        dados.produtos[codigo].quantidade += qtd;
        dados.produtos[codigo].valorTotal += valor;
      });
    }

    // Formas de pagamento
    if (nota.pagamento?.formas) {
      nota.pagamento.formas.forEach(forma => {
        const tipo = forma.forma || forma.tipo || 'Não informado';
        const valor = parseFloat(forma.valor || 0);
        
        if (!dados.formasPagamento[tipo]) {
          dados.formasPagamento[tipo] = { forma: tipo, quantidade: 0, valor: 0 };
        }
        dados.formasPagamento[tipo].quantidade++;
        dados.formasPagamento[tipo].valor += valor;
      });
    }
  });

  // Calcula ticket médio por loja
  Object.values(dados.porLoja).forEach(loja => {
    loja.ticketMedio = loja.quantidadeNotas > 0 ? loja.valorTotal / loja.quantidadeNotas : 0;
  });

  // Calcula ticket médio geral
  dados.geral.ticketMedio = dados.geral.totalNotas > 0 
    ? dados.geral.totalVendas / dados.geral.totalNotas 
    : 0;

  // Ordena arrays
  dados.lojasArray = Object.values(dados.porLoja).sort((a, b) => b.valorTotal - a.valorTotal);
  dados.diasArray = Object.values(dados.porDia).sort((a, b) => a.data.localeCompare(b.data));
  dados.horasArray = Object.values(dados.porHora).sort((a, b) => a.hora.localeCompare(b.hora));
  dados.produtosTop = Object.values(dados.produtos)
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 20);
  dados.pagamentosArray = Object.values(dados.formasPagamento)
    .sort((a, b) => b.valor - a.valor);

  return dados;
}

function formatarNotasParaTabela(notasDetalhadas) {
  return notasDetalhadas.map(nota => {
    // CORRIGIDO: usar valorNota ao invés de total
    let valorTotalNota = parseFloat(nota.valorNota || 0);
    
    // Se valorNota for 0, soma os itens
    if (valorTotalNota === 0 && nota.itens && nota.itens.length > 0) {
      valorTotalNota = nota.itens.reduce((sum, item) => {
        return sum + parseFloat(item.valor || 0);
      }, 0);
    }

    return {
      id: nota.id,
      nome: nota.contato?.nome || 'Consumidor Final',
      dataEmissao: nota.dataEmissao,
      numero: nota.numero,
      situacao: getSituacaoTexto(nota.situacao),
      situacaoNum: nota.situacao,
      cnpjCpf: nota.contato?.numeroDocumento || '',
      uf: nota.contato?.endereco?.uf || '',
      serie: nota.serie || '1',
      tipoNota: nota.tipo === 0 ? 'NFC-e' : 'NF-e',
      loja: nota.nomeLoja || 'Não informado',
      lojaId: nota.loja?.id || 0,
      valorTotal: valorTotalNota,
      itens: (nota.itens || []).map(item => {
        const qtd = parseFloat(item.quantidade || 1);
        const valorItem = parseFloat(item.valor || 0);
        const valorUnit = qtd > 0 ? valorItem / qtd : 0;
        
        return {
          codigo: item.codigo || '',
          descricao: item.descricao || 'Sem descrição',
          unidade: item.unidade || 'UN',
          quantidade: qtd,
          valorUnitario: valorUnit,
          valorTotal: valorItem
        };
      })
    };
  });
}

export default async function handler(req, res) {
  if (!access_token) {
    return res.status(401).json({
      erro: 'Não autorizado',
      mensagem: 'Faça a autorização em /api/bling-callback'
    });
  }

  try {
    const { dataInicio, dataFim } = req.query;

    // Valida e formata datas
    let dataInicioFormatada, dataFimFormatada;
    
    if (dataInicio && dataFim) {
      // Formato esperado: YYYY-MM-DD
      // Converte para o formato do Bling se necessário
      dataInicioFormatada = dataInicio;
      dataFimFormatada = dataFim;
    } else {
      // Padrão: últimos 7 dias
      const hoje = new Date();
      const semanaPassada = new Date(hoje);
      semanaPassada.setDate(hoje.getDate() - 7);
      dataInicioFormatada = semanaPassada.toISOString().split('T')[0];
      dataFimFormatada = hoje.toISOString().split('T')[0];
    }

    const filtro = `dataEmissao[${dataInicioFormatada} TO ${dataFimFormatada}]`;
    
    console.log('📅 Filtro aplicado:', filtro);
    console.log('📅 Datas:', { inicio: dataInicioFormatada, fim: dataFimFormatada });

    console.log('📅 Filtro aplicado:', filtro);
    console.log('📅 Datas:', { inicio: dataInicioFormatada, fim: dataFimFormatada });

    const notas = await fetchNFCe(filtro);
    console.log(`📦 ${notas.length} notas encontradas no período`);
    
    if (notas.length === 0) {
      return res.status(200).json({
        status: 'success',
        mensagem: 'Nenhuma nota encontrada no período selecionado',
        periodo: { dataInicio: dataInicioFormatada, dataFim: dataFimFormatada },
        totalEncontrado: 0,
        auditoria: {
          geral: { totalNotas: 0, totalVendas: 0, totalItens: 0, ticketMedio: 0 },
          lojasArray: [],
          diasArray: [],
          horasArray: [],
          produtosTop: [],
          pagamentosArray: []
        },
        notas: []
      });
    }

    console.log(`🔄 Buscando detalhes...`);
    
    const notasDetalhadas = [];
    const batchSize = 10;
    
    // Busca detalhes das notas
    for (let i = 0; i < notas.length; i += batchSize) {
      const batch = notas.slice(i, i + batchSize);
      const promises = batch.map(nota => 
        fetchNFCeDetalhes(nota.id).catch(err => {
          console.error(`Erro nota ${nota.id}:`, err.message);
          return null;
        })
      );
      
      const results = await Promise.all(promises);
      notasDetalhadas.push(...results.filter(r => r !== null));
      
      console.log(`   ✓ ${notasDetalhadas.length}/${notas.length}`);
      
      if (i + batchSize < notas.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`✅ ${notasDetalhadas.length} notas processadas`);

    // Busca nomes das lojas únicas
    const lojasIds = [...new Set(notasDetalhadas.map(n => n.loja?.id).filter(id => id))];
    console.log(`🏪 ${lojasIds.length} lojas únicas encontradas:`, lojasIds);
    
    // Carrega nomes das lojas
    for (const lojaId of lojasIds) {
      const nomeLoja = await fetchLoja(lojaId);
      console.log(`   Loja ${lojaId}: ${nomeLoja}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Adiciona nome da loja em cada nota
    notasDetalhadas.forEach(nota => {
      if (nota.loja?.id) {
        nota.nomeLoja = cacheLojas[nota.loja.id] || MAPEAMENTO_LOJAS[nota.loja.id] || `Loja ID: ${nota.loja.id}`;
      } else {
        nota.nomeLoja = MAPEAMENTO_LOJAS[0] || 'Loja Principal';
      }
    });

    console.log('✅ Processamento concluído');

    const auditoria = processarDadosAuditoria(notasDetalhadas);
    const notasTabela = formatarNotasParaTabela(notasDetalhadas);

    return res.status(200).json({
      status: 'success',
      periodo: {
        dataInicio: dataInicioFormatada,
        dataFim: dataFimFormatada
      },
      totalEncontrado: notas.length,
      totalProcessado: notasDetalhadas.length,
      auditoria,
      notas: notasTabela
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}