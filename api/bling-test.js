// api/bling-test.js
// Testa diferentes endpoints do Bling para ver o que funciona

const BLING_API_BASE_URL = 'https://api.bling.com.br/Api/v3';
const access_token = process.env.BLING_ACCESS_TOKEN;

/**
 * Testa um endpoint específico
 */
async function testarEndpoint(endpoint, nome) {
  const url = `${BLING_API_BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();
    
    return {
      endpoint: nome,
      url,
      status: response.status,
      sucesso: response.ok,
      dados: response.ok ? data : null,
      erro: !response.ok ? data : null
    };
  } catch (error) {
    return {
      endpoint: nome,
      url,
      status: 'ERRO',
      sucesso: false,
      erro: error.message
    };
  }
}

/**
 * Handler principal
 */
export default async function handler(req, res) {
  if (!access_token) {
    return res.status(401).json({
      erro: 'ACCESS_TOKEN não configurado',
      instrucoes: 'Configure BLING_ACCESS_TOKEN nas variáveis de ambiente'
    });
  }

  console.log('🧪 Iniciando testes de endpoints...\n');

  // Lista de endpoints para testar
  const endpoints = [
    { path: '/situacoes/modulos', nome: 'Módulos disponíveis' },
    { path: '/produtos', nome: 'Produtos' },
    { path: '/contatos', nome: 'Contatos/Clientes' },
    { path: '/pedidos/vendas', nome: 'Pedidos de Venda' },
    { path: '/nfe', nome: 'Notas Fiscais (nfe)' },
    { path: '/nfce', nome: 'Notas Fiscais Consumidor (nfce)' },
    { path: '/nfse', nome: 'Notas Fiscais Serviço (nfse)' },
    { path: '/vendas', nome: 'Vendas' },
    { path: '/contas/receber', nome: 'Contas a Receber' },
    { path: '/contas/pagar', nome: 'Contas a Pagar' },
    { path: '/estoques', nome: 'Estoques' },
    { path: '/depositos', nome: 'Depósitos' },
    { path: '/categorias/receitas', nome: 'Categorias de Receitas' },
  ];

  // Testa todos os endpoints
  const resultados = [];
  
  for (const endpoint of endpoints) {
    console.log(`Testando: ${endpoint.nome}...`);
    const resultado = await testarEndpoint(endpoint.path, endpoint.nome);
    resultados.push(resultado);
    
    // Pequeno delay para não sobrecarregar a API
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Separa sucessos e erros
  const sucessos = resultados.filter(r => r.sucesso);
  const erros = resultados.filter(r => !r.sucesso);

  console.log('\n✅ Testes concluídos!');
  console.log(`${sucessos.length} endpoints funcionando`);
  console.log(`${erros.length} endpoints com erro\n`);

  // Retorna resultado formatado
  return res.status(200).json({
    resumo: {
      total: resultados.length,
      sucessos: sucessos.length,
      erros: erros.length,
      timestamp: new Date().toISOString()
    },
    endpointsDisponiveis: sucessos.map(s => ({
      nome: s.endpoint,
      url: s.url,
      status: s.status,
      totalRegistros: s.dados?.data?.length || 0,
      amostra: s.dados?.data?.slice(0, 2) || null
    })),
    endpointsComErro: erros.map(e => ({
      nome: e.endpoint,
      url: e.url,
      status: e.status,
      erro: e.erro?.error?.type || e.erro
    })),
    proximosPassos: sucessos.length > 0 
      ? `Use um dos endpoints que funcionaram acima! Exemplo: ${sucessos[0].url}`
      : 'Nenhum endpoint disponível. Verifique as permissões do seu app no Bling.'
  });
}