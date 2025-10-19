// api/bling-nfce.js
// API OTIMIZADA - Foco: Loja, Produto, Data, Valor

const BLING_API_BASE_URL = 'https://api.bling.com.br/Api/v3';
const CLIENT_ID = process.env.BLING_CLIENT_ID;
const CLIENT_SECRET = process.env.BLING_CLIENT_SECRET;

let access_token = process.env.BLING_ACCESS_TOKEN;
let refresh_token = process.env.BLING_REFRESH_TOKEN;

const MAPEAMENTO_LOJAS = {
  205613392: 'TAPETES SÃO CARLOS',
  205613394: 'ROJEMA IMPORTAÇÃO',
  205613399: 'MEU EXAGERADO', 
  205613401: 'ACOSTAMENTO SP',
  0: 'Loja Principal',
};

async function refreshAccessToken() {
  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const response = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token })
  });
  const data = await response.json();
  if (response.ok) {
    access_token = data.access_token;
    refresh_token = data.refresh_token;
    return true;
  }
  throw new Error(`Falha ao renovar`);
}

async function fetchNFCe(filtro, limit = 100) {
  let url = `${BLING_API_BASE_URL}/nfce?limite=${limit}`;
  if (filtro) url += `&filters=${encodeURIComponent(filtro)}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${access_token}`, 'Accept': 'application/json' }
  });
  const data = await response.json();
  if (response.ok) return data.data || [];
  if (data.error?.type === 'invalid_token') {
    await refreshAccessToken();
    return await fetchNFCe(filtro, limit);
  }
  throw new Error(`API Error: ${JSON.stringify(data)}`);
}

async function fetchNFCeDetalhes(id) {
  const response = await fetch(`${BLING_API_BASE_URL}/nfce/${id}`, {
    headers: { 'Authorization': `Bearer ${access_token}`, 'Accept': 'application/json' }
  });
  const data = await response.json();
  if (response.ok) return data.data;
  if (data.error?.type === 'invalid_token') {
    await refreshAccessToken();
    return await fetchNFCeDetalhes(id);
  }
  return null;
}

async function fetchContato(contatoId) {
  if (!contatoId || contatoId === 16408306243) return null; // Consumidor Final
  try {
    const response = await fetch(`${BLING_API_BASE_URL}/contatos/${contatoId}`, {
      headers: { 'Authorization': `Bearer ${access_token}`, 'Accept': 'application/json' }
    });
    const data = await response.json();
    return response.ok ? data.data : null;
  } catch { return null; }
}

function extrairMarca(descricao) {
  if (!descricao) return 'Não informado';
  const desc = descricao.toUpperCase();
  
  // Marcas conhecidas
  const marcas = ['NIKE', 'ADIDAS', 'ARAMIS', 'ACOSTAMENTO', 'POLO', 'CALVIN KLEIN', 
                  'LACOSTE', 'TOMMY', 'ZARA', 'H&M', 'PUMA', 'OAKLEY'];
  
  for (const marca of marcas) {
    if (desc.includes(marca)) return marca;
  }
  
  // Tenta extrair primeira palavra (geralmente é a marca)
  const primeiraPalavra = descricao.split(' ')[0];
  if (primeiraPalavra.length > 2) return primeiraPalavra.toUpperCase();
  
  return 'GENÉRICO';
}

function calcularIdade(dataNascimento) {
  if (!dataNascimento) return null;
  const hoje = new Date();
  const nascimento = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const m = hoje.getMonth() - nascimento.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) idade--;
  return idade;
}

function getFaixaEtaria(idade) {
  if (!idade) return 'Não informado';
  if (idade < 18) return '0-17';
  if (idade < 25) return '18-24';
  if (idade < 35) return '25-34';
  if (idade < 45) return '35-44';
  if (idade < 55) return '45-54';
  return '55+';
}

function processarDados(notasDetalhadas) {
  const autorizadas = notasDetalhadas.filter(n => n.situacao === 4 || n.situacao === 5);
  
  const dados = {
    resumo: {
      totalVendas: 0,
      totalNotas: autorizadas.length,
      totalItens: 0,
      ticketMedio: 0
    },
    porLoja: {},
    porDia: {},
    porHora: {},
    porMarca: {},
    produtos: {},
    clientes: {
      porGenero: { Masculino: 0, Feminino: 0, 'Não informado': 0 },
      porFaixaEtaria: {},
      porMarcaGenero: {},
      porMarcaIdade: {}
    },
    vendasRealTime: [] // Para dashboard em tempo real
  };

  autorizadas.forEach(nota => {
    const valorNota = parseFloat(nota.valorNota || 0);
    const nomeLoja = MAPEAMENTO_LOJAS[nota.loja?.id] || 'Não informado';
    const [data, hora] = (nota.dataEmissao || '').split(' ');
    const horaFormatada = hora?.substring(0, 5) || '00:00';
    
    // Resumo
    dados.resumo.totalVendas += valorNota;

    // Por Loja
    if (!dados.porLoja[nomeLoja]) {
      dados.porLoja[nomeLoja] = { vendas: 0, notas: 0, itens: 0 };
    }
    dados.porLoja[nomeLoja].vendas += valorNota;
    dados.porLoja[nomeLoja].notas++;

    // Por Dia
    if (!dados.porDia[data]) {
      dados.porDia[data] = { vendas: 0, notas: 0 };
    }
    dados.porDia[data].vendas += valorNota;
    dados.porDia[data].notas++;

    // Por Hora
    const chaveHora = `${data} ${hora?.split(':')[0] || '00'}:00`;
    if (!dados.porHora[chaveHora]) {
      dados.porHora[chaveHora] = { vendas: 0, notas: 0 };
    }
    dados.porHora[chaveHora].vendas += valorNota;
    dados.porHora[chaveHora].notas++;

    // Produtos e Marcas
    if (nota.itens) {
      nota.itens.forEach(item => {
        const qtd = parseFloat(item.quantidade || 0);
        const valor = parseFloat(item.valor || 0);
        const codigo = item.codigo || 'SEM_CODIGO';
        const descricao = item.descricao || 'Sem descrição';
        const marca = extrairMarca(descricao);

        dados.resumo.totalItens += qtd;
        dados.porLoja[nomeLoja].itens += qtd;

        // Produtos
        if (!dados.produtos[codigo]) {
          dados.produtos[codigo] = {
            codigo,
            descricao,
            marca,
            quantidade: 0,
            valorTotal: 0
          };
        }
        dados.produtos[codigo].quantidade += qtd;
        dados.produtos[codigo].valorTotal += valor;

        // Marcas
        if (!dados.porMarca[marca]) {
          dados.porMarca[marca] = {
            vendas: 0,
            quantidade: 0,
            notas: 0
          };
        }
        dados.porMarca[marca].vendas += valor;
        dados.porMarca[marca].quantidade += qtd;
        
        // Clientes por Marca
        if (nota.clienteInfo) {
          const genero = nota.clienteInfo.genero || 'Não informado';
          const faixa = nota.clienteInfo.faixaEtaria || 'Não informado';

          if (!dados.clientes.porMarcaGenero[marca]) {
            dados.clientes.porMarcaGenero[marca] = { Masculino: 0, Feminino: 0, 'Não informado': 0 };
          }
          dados.clientes.porMarcaGenero[marca][genero]++;

          if (!dados.clientes.porMarcaIdade[marca]) {
            dados.clientes.porMarcaIdade[marca] = {};
          }
          dados.clientes.porMarcaIdade[marca][faixa] = (dados.clientes.porMarcaIdade[marca][faixa] || 0) + 1;
        }
      });
      
      dados.porMarca[marca].notas++; // Conta nota uma vez por marca
    }

    // Clientes Geral
    if (nota.clienteInfo) {
      const genero = nota.clienteInfo.genero || 'Não informado';
      const faixa = nota.clienteInfo.faixaEtaria || 'Não informado';
      
      dados.clientes.porGenero[genero]++;
      dados.clientes.porFaixaEtaria[faixa] = (dados.clientes.porFaixaEtaria[faixa] || 0) + 1;
    }

    // Vendas em Tempo Real
    dados.vendasRealTime.push({
      hora: `${data} ${horaFormatada}`,
      loja: nomeLoja,
      valor: valorNota,
      numero: nota.numero
    });
  });

  dados.resumo.ticketMedio = dados.resumo.totalNotas > 0 
    ? dados.resumo.totalVendas / dados.resumo.totalNotas 
    : 0;

  // Ordena e formata arrays
  return {
    ...dados,
    lojasArray: Object.entries(dados.porLoja).map(([nome, info]) => ({ nome, ...info }))
      .sort((a, b) => b.vendas - a.vendas),
    diasArray: Object.entries(dados.porDia).map(([data, info]) => ({ data, ...info }))
      .sort((a, b) => a.data.localeCompare(b.data)),
    horasArray: Object.entries(dados.porHora).map(([hora, info]) => ({ hora, ...info }))
      .sort((a, b) => a.hora.localeCompare(b.hora)),
    marcasArray: Object.entries(dados.porMarca).map(([marca, info]) => ({ marca, ...info }))
      .sort((a, b) => b.vendas - a.vendas),
    produtosTop: Object.values(dados.produtos)
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 20),
    clientesGeneroArray: Object.entries(dados.clientes.porGenero)
      .map(([genero, count]) => ({ genero, count })),
    clientesFaixaArray: Object.entries(dados.clientes.porFaixaEtaria)
      .map(([faixa, count]) => ({ faixa, count }))
      .sort((a, b) => a.faixa.localeCompare(b.faixa)),
    vendasRealTime: dados.vendasRealTime.slice(-50).reverse() // Últimas 50
  };
}

export default async function handler(req, res) {
  if (!access_token) {
    return res.status(401).json({ erro: 'Não autorizado' });
  }

  try {
    const { dataInicio, dataFim, limit = '100', detalhado = 'false' } = req.query;
    const maxLimit = Math.min(parseInt(limit) || 100, 100);

    let dataInicioFormatada = dataInicio || new Date(Date.now() - 86400000).toISOString().split('T')[0];
    let dataFimFormatada = dataFim || new Date().toISOString().split('T')[0];

    const filtro = `dataEmissao[${dataInicioFormatada} TO ${dataFimFormatada}]`;
    console.log('📅 Filtro:', filtro, '| Limite:', maxLimit);

    const notas = await fetchNFCe(filtro, maxLimit);
    console.log(`📦 ${notas.length} notas encontradas`);

    if (notas.length === 0) {
      return res.status(200).json({
        status: 'success',
        mensagem: 'Nenhuma nota encontrada',
        periodo: { dataInicio: dataInicioFormatada, dataFim: dataFimFormatada },
        dados: {
          resumo: { totalVendas: 0, totalNotas: 0, totalItens: 0, ticketMedio: 0 },
          lojasArray: [], diasArray: [], horasArray: [], marcasArray: [], produtosTop: []
        }
      });
    }

    // Busca detalhes em paralelo (10 por vez)
    const notasDetalhadas = [];
    const batchSize = 10;
    
    for (let i = 0; i < notas.length; i += batchSize) {
      const batch = notas.slice(i, i + batchSize);
      const promises = batch.map(nota => fetchNFCeDetalhes(nota.id));
      const results = await Promise.all(promises);
      notasDetalhadas.push(...results.filter(r => r !== null));
      
      if (i + batchSize < notas.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Enriquece com dados de cliente (se detalhado = true)
    if (detalhado === 'true') {
      console.log('🔍 Buscando dados de clientes...');
      const contatosUnicos = [...new Set(notasDetalhadas.map(n => n.contato?.id).filter(id => id && id !== 16408306243))];
      const contatosCache = {};
      
      // Busca em paralelo
      const contatosPromises = contatosUnicos.slice(0, 20).map(id => // Limite 20 para não demorar
        fetchContato(id).then(c => c ? (contatosCache[id] = c) : null)
      );
      await Promise.all(contatosPromises);

      // Adiciona info de cliente nas notas
      notasDetalhadas.forEach(nota => {
        const contatoId = nota.contato?.id;
        if (contatoId && contatosCache[contatoId]) {
          const contato = contatosCache[contatoId];
          nota.clienteInfo = {
            genero: contato.sexo === 'M' ? 'Masculino' : contato.sexo === 'F' ? 'Feminino' : 'Não informado',
            idade: calcularIdade(contato.dataNascimento),
            faixaEtaria: getFaixaEtaria(calcularIdade(contato.dataNascimento))
          };
        }
      });
    }

    console.log(`✅ ${notasDetalhadas.length} notas processadas`);

    const dados = processarDados(notasDetalhadas);

    return res.status(200).json({
      status: 'success',
      periodo: { dataInicio: dataInicioFormatada, dataFim: dataFimFormatada },
      totalProcessado: notasDetalhadas.length,
      dados
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
}