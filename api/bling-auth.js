// api/bling-auth.js
// API para buscar notas fiscais do Bling

const BLING_API_BASE_URL = 'https://api.bling.com.br/Api/v3';

const CLIENT_ID = process.env.BLING_CLIENT_ID;
const CLIENT_SECRET = process.env.BLING_CLIENT_SECRET;

let access_token = process.env.BLING_ACCESS_TOKEN;
let refresh_token = process.env.BLING_REFRESH_TOKEN;

/**
 * Renova o Access Token usando o Refresh Token
 */
async function refreshAccessToken() {
  if (!refresh_token) {
    throw new Error("REFRESH TOKEN ausente. Faça a autorização inicial em /api/bling-callback");
  }

  console.log('🔄 Renovando Access Token...');

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

    console.log('✅ Token renovado! Atualize as variáveis:');
    console.log(`BLING_ACCESS_TOKEN=${access_token}`);
    console.log(`BLING_REFRESH_TOKEN=${refresh_token}`);

    return true;
  } else {
    throw new Error(`Falha ao renovar: ${data.error?.description || JSON.stringify(data)}`);
  }
}

/**
 * Busca Notas Fiscais no Bling
 */
async function fetchNotasFiscais(filter = null) {
  if (!access_token) {
    throw new Error("ACCESS TOKEN ausente. Faça a autorização inicial em /api/bling-callback");
  }

  // Monta URL com ou sem filtro
  let url = `${BLING_API_BASE_URL}/nfes`;
  if (filter) {
    url += `?filters=${encodeURIComponent(filter)}`;
  }
  
  console.log('🔗 URL chamada:', url);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Accept': 'application/json'
    }
  });

  const data = await response.json();
  
  console.log('📊 Status resposta:', response.status);
  console.log('📦 Dados recebidos:', JSON.stringify(data).substring(0, 200));

  if (response.ok) {
    return {
      status: 'success',
      totalNotas: data.data?.length || 0,
      notas: data.data || []
    };
  }

  // Token expirado? Tenta renovar
  if (data.error?.type === 'invalid_token') {
    console.log('⚠️ Token expirado, renovando...');
    await refreshAccessToken();
    
    // Retry com token renovado
    return await fetchNotasFiscais(filter);
  }

  throw new Error(`API Error: ${JSON.stringify(data)}`);
}

/**
 * Handler da Serverless Function
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Verifica se está configurado
  if (!access_token) {
    return res.status(401).json({
      status: 'error',
      message: 'Não autorizado. Faça a autorização primeiro.',
      authUrl: `${req.headers.host}/api/bling-callback`
    });
  }

  try {
    // Opções de teste:
    const { teste, dataInicio, dataFim } = req.query;
    
    let filtro = null;
    
    if (teste === 'sem-filtro') {
      // Testa SEM filtro (pega tudo, mas limitado a 100)
      filtro = null;
    } else if (dataInicio && dataFim) {
      // Com datas customizadas (formato YYYY-MM-DD)
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

    console.log('📅 Filtro usado:', filtro || 'SEM FILTRO');
    const result = await fetchNotasFiscais(filtro);

    return res.status(200).json({
      status: 'success',
      message: `${result.totalNotas} notas encontradas`,
      total: result.totalNotas,
      notas: result.notas.slice(0, 10) // Primeiras 10 notas
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}