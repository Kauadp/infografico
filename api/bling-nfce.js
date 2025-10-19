// api/bling-nfce.js (updated)
const BLING_API_BASE = 'https://api.bling.com.br/Api/v3';

// Configuração via variáveis de ambiente
let accessToken = process.env.BLING_ACCESS_TOKEN;
let refreshToken = process.env.BLING_REFRESH_TOKEN;
const clientId = process.env.BLING_CLIENT_ID;
const clientSecret = process.env.BLING_CLIENT_SECRET;

// Mapeamento de lojas
const LOJAS = {
  205613392: 'TAPETES SÃO CARLOS',
  205613394: 'ROJEMA IMPORTAÇÃO',
  205613399: 'MEU EXAGERADO',
  205613401: 'ACOSTAMENTO SP',
  0: 'Loja Principal',
};

// ==================== AUTENTICAÇÃO ====================

async function renovarToken() {
  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Falha na renovação: ${res.status} - ${error}`);
    }

    const data = await res.json();
    accessToken = data.access_token;
    refreshToken = data.refresh_token;
    console.log('✅ Token renovado com sucesso');
    return true;
  } catch (error) {
    console.error('❌ Erro ao renovar token:', error.message);
    throw error;
  }
}

async function fazerRequisicao(url, maxRetries = 3, retryDelay = 1000) {
  for (let tentativa = 1; tentativa <= maxRetries; tentativa++) {
    try {
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });

      if (res.status === 401 && tentativa === 1) {
        console.log('🔄 Token expirado, renovando...');
        await renovarToken();
        return fazerRequisicao(url, maxRetries, retryDelay);
      }

      if (res.status === 429) {
        const error = await res.json();
        const waitTime = retryDelay * Math.pow(2, tentativa - 1);
        console.log(`⚠️ 429 - Limite atingido. Aguardando ${waitTime}ms antes de retry ${tentativa}/${maxRetries}`);
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }

      if (!res.ok) {
        const error = await res.text();
        throw new Error(`API Error ${res.status}: ${error}`);
      }

      return await res.json();
    } catch (error) {
      if (tentativa === maxRetries) {
        console.error(`❌ Erro na requisição (tentativa ${tentativa}):`, error.message);
        throw error;
      }
      const waitTime = retryDelay * Math.pow(2, tentativa - 1);
      console.log(`⚠️ Retry ${tentativa}/${maxRetries} após ${waitTime}ms`);
      await new Promise(r => setTimeout(r, waitTime));
    }
  }
}

// ==================== BUSCAR DADOS ====================

async function buscarNotas(dataInicio, dataFim, limite = 100) {
  const filtro = `dataEmissao[${dataInicio} TO ${dataFim}];situacao[5]`; // Apenas notas autorizadas
  let page = 1;
  let allNotas = [];
  let hasMore = true;

  console.log(`📡 Buscando notas: ${dataInicio} a ${dataFim}`);

  while (hasMore) {
    const url = `${BLING_API_BASE}/nfce?page=${page}&limite=${limite}&filters=${encodeURIComponent(filtro)}`;
    const data = await fazerRequisicao(url);
    const notasPage = data.data || [];
    allNotas = [...allNotas, ...notasPage];
    hasMore = notasPage.length === limite;
    page++;
    if (page > 10) break; // Safety limit
  }

  return allNotas;
}

async function buscarDetalhesNota(idNotaFiscalConsumidor) {
  try {
    const url = `${BLING_API_BASE}/nfce/${idNotaFiscalConsumidor}`; // Alinhado com idNotaFiscalConsumidor
    const data = await fazerRequisicao(url);
    return data.data;
  } catch (error) {
    console.error(`⚠️ Erro ao buscar nota ${idNotaFiscalConsumidor}:`, error.message);
    return null;
  }
}

async function buscarContato(contatoId) {
  if (!contatoId || contatoId === 16408306243) return null;
  try {
    const url = `${BLING_API_BASE}/contatos/${contatoId}`;
    const data = await fazerRequisicao(url);
    return data.data;
  } catch (error) {
    console.error(`⚠️ Erro ao buscar contato ${contatoId}`);
    return null;
  }
}

// ==================== PROCESSAMENTO ====================

function extrairMarca(descricao) {
  if (!descricao) return 'NÃO INFORMADO';
  const desc = descricao.toUpperCase();
  const marcas = [
    'NIKE', 'ADIDAS', 'PUMA', 'REEBOK', 'NEW BALANCE',
    'ARAMIS', 'ACOSTAMENTO', 'POLO', 'CALVIN KLEIN', 'LACOSTE',
    'TOMMY', 'ZARA', 'H&M', 'OAKLEY', 'RAY-BAN',
    'MIZUNO', 'ASICS', 'FILA', 'VANS', 'CONVERSE'
  ];
  for (const marca of marcas) {
    if (desc.includes(marca)) return marca;
  }
  const primeira = descricao.split(/[\s\-]/)[0];
  if (primeira && primeira.length > 2) return primeira.toUpperCase();
  return 'GENÉRICO';
}

function calcularIdade(dataNascimento) {
  if (!dataNascimento) return null;
  const hoje = new Date();
  const nasc = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade > 0 ? idade : null;
}

function getFaixaEtaria(idade) {
  if (!idade || idade < 0) return 'NÃO INFORMADO';
  if (idade < 18) return '0-17';
  if (idade < 25) return '18-24';
  if (idade < 35) return '25-34';
  if (idade < 45) return '35-44';
  if (idade < 55) return '45-54';
  return '55+';
}

function processarDados(notas, incluirClientes = false) {
  const dados = {
    resumo: { totalVendas: 0, totalNotas: 0, totalItens: 0, ticketMedio: 0 },
    vendas: [],
    porLoja: {},
    porDia: {},
    porHora: {},
    porMarca: {},
    topProdutos: {},
    clientes: incluirClientes ? {
      porGenero: { Masculino: 0, Feminino: 0, 'Não informado': 0 },
      porIdade: {},
      porMarcaGenero: {},
      porMarcaIdade: {}
    } : null
  };

  notas.forEach(nota => {
    if (!nota || nota.situacao !== 5) return; // Apenas notas autorizadas
    const valorNota = parseFloat(nota.valorNota || 0);
    const nomeLoja = LOJAS[nota.loja?.id] || 'NÃO INFORMADO';
    const dataHora = nota.dataEmissao || '';
    const [data, horaCompleta] = dataHora.split(' ');
    const hora = horaCompleta ? horaCompleta.substring(0, 2) + ':00' : '00:00';

    dados.resumo.totalNotas++;
    dados.resumo.totalVendas += valorNota;

    if (!dados.porLoja[nomeLoja]) dados.porLoja[nomeLoja] = { vendas: 0, notas: 0, itens: 0 };
    dados.porLoja[nomeLoja].vendas += valorNota;
    dados.porLoja[nomeLoja].notas++;

    if (!dados.porDia[data]) dados.porDia[data] = { vendas: 0, notas: 0 };
    dados.porDia[data].vendas += valorNota;
    dados.porDia[data].notas++;

    if (!dados.porHora[hora]) dados.porHora[hora] = { vendas: 0, notas: 0 };
    dados.porHora[hora].vendas += valorNota;
    dados.porHora[hora].notas++;

    let clienteInfo = null;
    if (incluirClientes && nota.contato) {
      const contatoId = nota.contato.id;
      if (contatoId && contatosCache[contatoId]) {
        const c = contatosCache[contatoId];
        const idade = calcularIdade(c.dataNascimento);
        clienteInfo = {
          genero: c.sexo === 'M' ? 'Masculino' : c.sexo === 'F' ? 'Feminino' : 'Não informado',
          idade,
          faixaEtaria: getFaixaEtaria(idade)
        };
      }
    }

    if (nota.itens && Array.isArray(nota.itens)) {
      nota.itens.forEach(item => {
        const qtd = parseFloat(item.quantidade || 0);
        const valor = parseFloat(item.valor || 0);
        const codigo = item.codigo || 'SEM_CODIGO';
        const descricao = item.descricao || 'Sem descrição';
        const marca = extrairMarca(descricao);

        dados.resumo.totalItens += qtd;
        dados.porLoja[nomeLoja].itens += qtd;

        dados.vendas.push({ data, hora, loja: nomeLoja, produto: descricao, marca, quantidade: qtd, valor, numeroNota: nota.numero });

        if (!dados.topProdutos[codigo]) {
          dados.topProdutos[codigo] = { codigo, descricao, marca, quantidade: 0, valorTotal: 0 };
        }
        dados.topProdutos[codigo].quantidade += qtd;
        dados.topProdutos[codigo].valorTotal += valor;

        if (!dados.porMarca[marca]) dados.porMarca[marca] = { vendas: 0, quantidade: 0, notas: 0 };
        dados.porMarca[marca].vendas += valor;
        dados.porMarca[marca].quantidade += qtd;

        if (incluirClientes && clienteInfo) {
          const genero = clienteInfo.genero;
          const faixa = clienteInfo.faixaEtaria;
          if (!dados.clientes.porMarcaGenero[marca]) dados.clientes.porMarcaGenero[marca] = { Masculino: 0, Feminino: 0, 'Não informado': 0 };
          dados.clientes.porMarcaGenero[marca][genero]++;
          if (!dados.clientes.porMarcaIdade[marca]) dados.clientes.porMarcaIdade[marca] = {};
          dados.clientes.porMarcaIdade[marca][faixa] = (dados.clientes.porMarcaIdade[marca][faixa] || 0) + 1;
          dados.clientes.porGenero[genero]++;
          dados.clientes.porIdade[faixa] = (dados.clientes.porIdade[faixa] || 0) + 1;
        }
      });
    }
  });

  dados.resumo.ticketMedio = dados.resumo.totalNotas > 0 ? dados.resumo.totalVendas / dados.resumo.totalNotas : 0;

  return {
    resumo: dados.resumo,
    vendas: dados.vendas.slice(-100),
    lojasArray: Object.entries(dados.porLoja).map(([nome, info]) => ({ nome, ...info })).sort((a, b) => b.vendas - a.vendas),
    diasArray: Object.entries(dados.porDia).map(([data, info]) => ({ data, ...info })).sort((a, b) => a.data.localeCompare(b.data)),
    horasArray: Object.entries(dados.porHora).map(([hora, info]) => ({ hora, ...info })).sort((a, b) => a.hora.localeCompare(b.hora)),
    marcasArray: Object.entries(dados.porMarca).map(([marca, info]) => ({ marca, ...info })).sort((a, b) => b.vendas - a.vendas),
    produtosTop: Object.values(dados.topProdutos).sort((a, b) => b.quantidade - a.quantidade).slice(0, 20),
    vendasRealTime: dados.vendas.slice(-50).reverse(),
    clientes: incluirClientes ? {
      generoArray: Object.entries(dados.clientes.porGenero).map(([genero, count]) => ({ genero, count })),
      idadeArray: Object.entries(dados.clientes.porIdade).map(([faixa, count]) => ({ faixa, count })).sort((a, b) => a.faixa.localeCompare(b.faixa)),
      porMarcaGenero: dados.clientes.porMarcaGenero,
      porMarcaIdade: dados.clientes.porMarcaIdade
    } : null
  };
}

// ==================== HANDLER PRINCIPAL ====================

export default async function handler(req, res) {
  const inicio = Date.now();

  if (!accessToken || !clientId || !clientSecret) {
    return res.status(401).json({
      status: 'error',
      message: 'Credenciais não configuradas. Configure BLING_ACCESS_TOKEN, BLING_CLIENT_ID e BLING_CLIENT_SECRET'
    });
  }

  try {
    const { dataInicio, dataFim, limit = '100', detalhado = 'false' } = req.query;
    const maxLimit = Math.min(parseInt(limit) || 100, 100);
    const incluirClientes = detalhado === 'true';

    const hoje = new Date().toISOString().split('T')[0];
    const dataInicioFmt = dataInicio || hoje;
    const dataFimFmt = dataFim || hoje;

    console.log(`\n🚀 Iniciando busca: ${dataInicioFmt} a ${dataFimFmt} | Limite: ${maxLimit} | Clientes: ${incluirClientes}`);

    const notas = await buscarNotas(dataInicioFmt, dataFimFmt, maxLimit);
    console.log(`📦 ${notas.length} notas encontradas`);

    if (notas.length === 0) {
      return res.status(200).json({
        status: 'success',
        message: 'Nenhuma nota encontrada no período',
        periodo: { dataInicio: dataInicioFmt, dataFim: dataFimFmt },
        dados: processarDados([])
      });
    }

    const notasDetalhadas = [];
    const batchSize = 3; // Limit to 3 concurrent requests per second
    const delayBetweenBatches = 1000; // 1 second delay to respect 3 req/s limit

    for (let i = 0; i < notas.length; i += batchSize) {
      const batch = notas.slice(i, i + batchSize);
      const promises = batch.map(n => buscarDetalhesNota(n.id));
      const results = await Promise.all(promises);
      notasDetalhadas.push(...results.filter(r => r !== null));
      if (i + batchSize < notas.length) {
        await new Promise(r => setTimeout(r, delayBetweenBatches));
      }
    }

    console.log(`✅ ${notasDetalhadas.length} notas detalhadas`);

    if (incluirClientes) {
      console.log('👥 Buscando dados de clientes...');
      const contatosUnicos = [...new Set(notasDetalhadas.map(n => n.contato?.id).filter(id => id && id !== 16408306243))];
      const contatosCache = {};
      const contatosLimite = contatosUnicos.slice(0, 30);

      for (let i = 0; i < contatosLimite.length; i += 5) {
        const batch = contatosLimite.slice(i, i + 5);
        const promises = batch.map(id => buscarContato(id).then(c => c ? (contatosCache[id] = c) : null));
        await Promise.all(promises);
        if (i + 5 < contatosLimite.length) await new Promise(r => setTimeout(r, 300));
      }

      notasDetalhadas.forEach(nota => {
        const contatoId = nota.contato?.id;
        if (contatoId && contatosCache[contatoId]) {
          const c = contatosCache[contatoId];
          const idade = calcularIdade(c.dataNascimento);
          nota.clienteInfo = {
            genero: c.sexo === 'M' ? 'Masculino' : c.sexo === 'F' ? 'Feminino' : 'Não informado',
            idade,
            faixaEtaria: getFaixaEtaria(idade)
          };
        }
      });
      console.log(`✅ ${Object.keys(contatosCache).length} clientes processados`);
    }

    const dados = processarDados(notasDetalhadas, incluirClientes);
    const tempoTotal = ((Date.now() - inicio) / 1000).toFixed(2);
    console.log(`⏱️ Processamento concluído em ${tempoTotal}s\n`);

    return res.status(200).json({
      status: 'success',
      periodo: { dataInicio: dataInicioFmt, dataFim: dataFimFmt },
      totalProcessado: notasDetalhadas.length,
      tempoProcessamento: `${tempoTotal}s`,
      dados
    });
  } catch (error) {
    console.error('❌ ERRO:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}