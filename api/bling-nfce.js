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
};

// Caches
const cacheLojas = {};
const cacheContatos = {};
const cacheProdutos = {};

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
  
  if (MAPEAMENTO_LOJAS[lojaId]) {
    cacheLojas[lojaId] = MAPEAMENTO_LOJAS[lojaId];
    return MAPEAMENTO_LOJAS[lojaId];
  }
  
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

  const fallback = `Loja ID: ${lojaId}`;
  cacheLojas[lojaId] = fallback;
  return fallback;
}

/**
 * Busca informações de um contato pelo ID
 */
async function fetchContato(contatoId) {
  if (!contatoId) return null;
  if (cacheContatos[contatoId]) return cacheContatos[contatoId];

  const url = `${BLING_API_BASE_URL}/contatos/${contatoId}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Accept': 'application/json'
    }
  });
  const data = await response.json();
  if (response.ok && data.data) {
    cacheContatos[contatoId] = data.data;
    return data.data;
  }
  return null;
}

/**
 * Busca informações de um produto pelo ID
 */
async function fetchProduto(produtoId) {
  if (!produtoId) return null;
  if (cacheProdutos[produtoId]) return cacheProdutos[produtoId];

  const url = `${BLING_API_BASE_URL}/produtos/${produtoId}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Accept': 'application/json'
    }
  });
  const data = await response.json();
  if (response.ok && data.data) {
    cacheProdutos[produtoId] = data.data;
    return data.data;
  }
  return null;
}

async function fetchNFCe(filtro = null) {
  let page = 1;
  let allNotas = [];
  let hasMore = true;

  while (hasMore) {
    let url = `${BLING_API_BASE_URL}/nfce?page=${page}&limite=100`;
    if (filtro) url += `&filters=${encodeURIComponent(filtro)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();
    if (!response.ok) {
      if (data.error?.type === 'invalid_token') {
        await refreshAccessToken();
        return await fetchNFCe(filtro);
      }
      throw new Error(`API Error: ${JSON.stringify(data)}`);
    }

    const notasPage = data.data || [];
    allNotas = [...allNotas, ...notasPage];
    hasMore = notasPage.length === 100;
    page++;
  }

  return allNotas;
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

function calculateAge(dataNascimento) {
  const birth = new Date(dataNascimento);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function getGrupoIdade(idade) {
  if (idade <= 18) return '0-18';
  if (idade <= 30) return '19-30';
  if (idade <= 50) return '31-50';
  return '51+';
}

function extractMarcaFromDescricao(descricao) {
  if (!descricao) return 'Não informado';
  const regex = /^(Nike|Adidas|Aramis|Acostamento)\b/i;
  const match = descricao.match(regex);
  return match ? match[1] : 'Não informado';
}

function processarDadosAuditoria(notasDetalhadas) {
  const notasAutorizadas = notasDetalhadas.filter(n => n.situacao === 4 || n.situacao === 5);

  const dados = {
    geral: {
      totalNotas: notasAutorizadas.length,
      totalVendas: 0,
      totalItens: 0,
      totalDescontos: 0,
      ticketMedio: 0
    },
    porLoja: {},
    porDia: {},
    porHora: {},
    produtos: {},
    formasPagamento: {},
    porMarca: {},
    clientes: {
      porGenero: { M: 0, F: 0, Outros: 0 },
      porIdadeGrupo: { '0-18': 0, '19-30': 0, '31-50': 0, '51+': 0 },
      porMarcaGenero: {},
      porMarcaIdadeGrupo: {}
    }
  };

  notasAutorizadas.forEach(nota => {
    const valorNota = parseFloat(nota.valorNota || 0);
    const desconto = parseFloat(nota.desconto?.valor || 0);
    const nomeLoja = nota.nomeLoja || 'Não informado';
    
    const [dataParte, horaParte] = (nota.dataEmissao || '').split(' ');
    const hora = horaParte?.split(':')[0] || '00';

    dados.geral.totalVendas += valorNota;
    dados.geral.totalDescontos += desconto;

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

    if (nota.itens && Array.isArray(nota.itens)) {
      nota.itens.forEach(item => {
        const qtd = parseFloat(item.quantidade || 0);
        const valor = parseFloat(item.valor || 0);
        const codigo = item.codigo || 'SEM_CODIGO';
        const descricao = item.descricao || 'Sem descrição';
        const marca = item.marca || extractMarcaFromDescricao(descricao);

        dados.geral.totalItens += qtd;
        dados.porLoja[nomeLoja].itensVendidos += qtd;
        dados.porDia[dataParte].itensVendidos += qtd;

        if (!dados.produtos[codigo]) {
          dados.produtos[codigo] = {
            codigo,
            descricao,
            quantidade: 0,
            valorTotal: 0,
            marca
          };
        }
        dados.produtos[codigo].quantidade += qtd;
        dados.produtos[codigo].valorTotal += valor;

        if (!dados.porMarca[marca]) {
          dados.porMarca[marca] = { valorTotal: 0, quantidade: 0 };
        }
        dados.porMarca[marca].valorTotal += valor;
        dados.porMarca[marca].quantidade += qtd;
      });
    }

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

    if (nota.contatoDetalhes) {
      const genero = nota.contatoDetalhes.sexo || 'Outros';
      const idade = nota.contatoDetalhes.idade;
      const grupoIdade = idade ? getGrupoIdade(idade) : null;

      dados.clientes.porGenero[genero] = (dados.clientes.porGenero[genero] || 0) + 1;
      if (grupoIdade) dados.clientes.porIdadeGrupo[grupoIdade] = (dados.clientes.porIdadeGrupo[grupoIdade] || 0) + 1;

      nota.itens.forEach(item => {
        const marca = item.marca || extractMarcaFromDescricao(item.descricao);
        if (marca) {
          if (!dados.clientes.porMarcaGenero[marca]) dados.clientes.porMarcaGenero[marca] = { M: 0, F: 0, Outros: 0 };
          dados.clientes.porMarcaGenero[marca][genero] += 1;

          if (grupoIdade) {
            if (!dados.clientes.porMarcaIdadeGrupo[marca]) dados.clientes.porMarcaIdadeGrupo[marca] = { '0-18': 0, '19-30': 0, '31-50': 0, '51+': 0 };
            dados.clientes.porMarcaIdadeGrupo[marca][grupoIdade] += 1;
          }
        }
      });
    }
  });

  Object.values(dados.porLoja).forEach(loja => {
    loja.ticketMedio = loja.quantidadeNotas > 0 ? loja.valorTotal / loja.quantidadeNotas : 0;
  });

  dados.geral.ticketMedio = dados.geral.totalNotas > 0 
    ? dados.geral.totalVendas / dados.geral.totalNotas 
    : 0;

  dados.lojasArray = Object.values(dados.porLoja).sort((a, b) => b.valorTotal - a.valorTotal);
  dados.diasArray = Object.values(dados.porDia).sort((a, b) => a.data.localeCompare(b.data));
  dados.horasArray = Object.values(dados.porHora).sort((a, b) => a.hora.localeCompare(b.hora));
  dados.produtosTop = Object.values(dados.produtos)
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 20);
  dados.pagamentosArray = Object.values(dados.formasPagamento)
    .sort((a, b) => b.valor - a.valor);
  dados.marcasArray = Object.entries(dados.porMarca)
    .map(([marca, info]) => ({ marca, ...info }))
    .sort((a, b) => b.valorTotal - a.valorTotal);
  dados.clientesGeneroArray = Object.entries(dados.clientes.porGenero)
    .map(([genero, count]) => ({ genero, count }));
  dados.clientesIdadeArray = Object.entries(dados.clientes.porIdadeGrupo)
    .map(([grupo, count]) => ({ grupo, count }));
  dados.clientesMarcaGeneroArray = Object.entries(dados.clientes.porMarcaGenero)
    .map(([marca, generos]) => ({ marca, ...generos }));
  dados.clientesMarcaIdadeArray = Object.entries(dados.clientes.porMarcaIdadeGrupo)
    .map(([marca, grupos]) => ({ marca, ...grupos }));

  return dados;
}

function formatarNotasParaTabela(notasDetalhadas) {
  return notasDetalhadas.map(nota => {
    let valorTotalNota = parseFloat(nota.valorNota || 0);
    
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
      genero: nota.contatoDetalhes?.sexo || 'Não informado',
      idade: nota.contatoDetalhes?.idade || null,
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
          valorTotal: valorItem,
          marca: item.marca || extractMarcaFromDescricao(item.descricao)
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
    const startTime = Date.now();
    const timeoutLimit = 280000; // 280s to avoid 300s timeout

    const { dataInicio, dataFim } = req.query;

    let dataInicioFormatada, dataFimFormatada;
    
    if (dataInicio && dataFim) {
      dataInicioFormatada = dataInicio;
      dataFimFormatada = dataFim;
    } else {
      const hoje = new Date();
      const semanaPassada = new Date(hoje);
      semanaPassada.setDate(hoje.getDate() - 7);
      dataInicioFormatada = semanaPassada.toISOString().split('T')[0];
      dataFimFormatada = hoje.toISOString().split('T')[0];
    }

    const filtro = `dataEmissao[${dataInicioFormatada} 00:00:00 TO ${dataFimFormatada} 23:59:59]`;
    
    console.log('📅 Filtro aplicado:', filtro);
    console.log('📅 Datas:', { inicio: dataInicioFormatada, fim: dataFimFormatada });

    const notas = await fetchNFCe(filtro);
    console.log(`📦 ${notas.length} notas encontradas no período`);

    if (Date.now() - startTime > timeoutLimit) {
      throw new Error('Processamento interrompido: risco de timeout');
    }
    
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
          pagamentosArray: [],
          marcasArray: [],
          clientes: {
            porGenero: { M: 0, F: 0, Outros: 0 },
            porIdadeGrupo: { '0-18': 0, '19-30': 0, '31-50': 0, '51+': 0 },
            porMarcaGenero: {},
            porMarcaIdadeGrupo: {}
          }
        },
        notas: []
      });
    }

    console.log(`🔄 Buscando detalhes...`);
    
    const notasDetalhadas = [];
    const batchSize = 20;
    
    for (let i = 0; i < notas.length; i += batchSize) {
      if (Date.now() - startTime > timeoutLimit) {
        throw new Error('Processamento interrompido: risco de timeout');
      }
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
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`✅ ${notasDetalhadas.length} notas processadas`);

    // Enriquecer com contatos
    for (let nota of notasDetalhadas) {
      if (Date.now() - startTime > timeoutLimit) {
        throw new Error('Processamento interrompido: risco de timeout');
      }
      if (nota.contato?.id) {
        const contato = await fetchContato(nota.contato.id);
        if (contato) {
          nota.contatoDetalhes = {
            sexo: contato.sexo || 'Não informado',
            dataNascimento: contato.dataNascimento || null,
            idade: contato.dataNascimento ? calculateAge(contato.dataNascimento) : null
          };
        }
      }
      if (nota.itens) {
        for (let item of nota.itens) {
          // Descomente se fetchProduto for necessário
          /*
          if (item.produto?.id) {
            const produto = await fetchProduto(item.produto.id);
            if (produto) {
              item.marca = produto.marca || extractMarcaFromDescricao(item.descricao);
            }
          } else {
            item.marca = extractMarcaFromDescricao(item.descricao);
          }
          */
          item.marca = extractMarcaFromDescricao(item.descricao);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const lojasIds = [...new Set(notasDetalhadas.map(n => n.loja?.id).filter(id => id))];
    console.log(`🏪 ${lojasIds.length} lojas únicas encontradas:`, lojasIds);
    
    for (const lojaId of lojasIds) {
      if (Date.now() - startTime > timeoutLimit) {
        throw new Error('Processamento interrompido: risco de timeout');
      }
      const nomeLoja = await fetchLoja(lojaId);
      console.log(`   Loja ${lojaId}: ${nomeLoja}`);
      await new Promise(resolve => setTimeout(resolve, 50));
    }

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
