// api/bling-auth.js

// URLs base da API do Bling
const BLING_OAUTH_URL = 'https://api.bling.com.br/oauth/token';
const BLING_API_BASE_URL = 'https://api.bling.com.br/Api/v3';

// Credenciais (Lidas das Variáveis de Ambiente do Vercel)
// IMPORTANTE: Configure estas variáveis no painel do Vercel
const CLIENT_ID = process.env.BLING_CLIENT_ID;
const CLIENT_SECRET = process.env.BLING_CLIENT_SECRET;
const REDIRECT_URI = process.env.BLING_REDIRECT_URI;
const AUTH_CODE = process.env.BLING_AUTH_CODE; // Usado APENAS NA PRIMEIRA EXECUÇÃO

// Tokens Atuais (Lidos das Variáveis de Ambiente)
let access_token = process.env.BLING_ACCESS_TOKEN;
let refresh_token = process.env.BLING_REFRESH_TOKEN;


// -------------------------------------------------------------
// FUNÇÕES DE AUTENTICAÇÃO
// -------------------------------------------------------------

/**
 * Troca o Authorization Code pelo Access Token e Refresh Token.
 * ESTA FUNÇÃO SÓ DEVE SER CHAMADA UMA VEZ.
 * @param {string} code - O Authorization Code temporário.
 */
async function getNewTokens(code) {
  if (!code) {
    throw new Error("AUTH_CODE VAZIO: Configure a variável BLING_AUTH_CODE no Vercel.");
  }

  console.log(`Debug - Cliente ID lido: ${CLIENT_ID ? 'OK' : 'FALHOU!'}`);
  console.log(`Debug - Cliente Secret lido: ${CLIENT_SECRET ? 'OK' : 'FALHOU!'}`);
  console.log(`Debug - Redirect URI lido: ${REDIRECT_URI ? 'OK' : 'FALHOU!'}`);
  console.log('----------------------------------------------------');
  
  console.log('Iniciando troca de código por tokens...');

  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  const body = new URLSearchParams();
  body.append('grant_type', 'authorization_code');
  body.append('code', code);
  body.append('redirect_uri', REDIRECT_URI);

  try {
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

      console.log('----------------------------------------------------');
      console.log('TOKENS OBTIDOS COM SUCESSO! PASSO 2B CONCLUÍDO.');
      console.log(`NOVO BLING_ACCESS_TOKEN: ${access_token}`);
      console.log(`NOVO BLING_REFRESH_TOKEN: ${refresh_token}`);
      console.log('----------------------------------------------------');

      return true;
    } else {
      console.error('Erro na troca de código (Bling):', data);
      throw new Error(`Erro OAuth: ${data.error_description || JSON.stringify(data)}`);
    }
  } catch (error) {
    throw new Error(`Falha na requisição de troca de tokens: ${error.message}`);
  }
}


/**
 * Renova o Access Token usando o Refresh Token.
 * Usado quando o Access Token de 6h expira.
 */
async function refreshAccessToken() {
  if (!refresh_token) {
    throw new Error("REFRESH TOKEN AUSENTE: Por favor, execute a troca de código (getNewTokens) primeiro.");
  }

  console.log('Iniciando renovação do Access Token...');

  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'); // ✅ ADICIONE ESTA LINHA

  const body = new URLSearchParams();
  body.append('grant_type', 'refresh_token');
  body.append('refresh_token', refresh_token);

  try {
    const response = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`, // ✅ usa o auth aqui
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: body
    });

    const data = await response.json();

    if (response.ok) {
      access_token = data.access_token;
      refresh_token = data.refresh_token;

      console.log('----------------------------------------------------');
      console.log('ACCESS TOKEN RENOVADO!');
      console.log(`NOVO BLING_ACCESS_TOKEN: ${access_token}`);
      console.log(`NOVO BLING_REFRESH_TOKEN: ${refresh_token}`);
      console.log('----------------------------------------------------');

      return true;
    } else {
      console.error('Erro na renovação:', data);
      throw new Error(`Falha na renovação de token: ${data.error_description || JSON.stringify(data)}`);
    }
  } catch (error) {
    throw new Error(`Falha na requisição de renovação: ${error.message}`);
  }
}



// -------------------------------------------------------------
// FUNÇÃO DE BUSCA DE DADOS (O SEU OBJETIVO)
// -------------------------------------------------------------

/**
 * Busca as Notas Fiscais no Bling, garantindo que o token esteja pronto.
 */
async function fetchNotasFiscais(filter) {
    // 1. Garante que as credenciais base existem
    if (!CLIENT_ID || !CLIENT_SECRET) {
         throw new Error("Credenciais do APP ausentes. Verifique CLIENT_ID e CLIENT_SECRET no Vercel.");
    }

    // 2. Se o Access Token estiver vazio, tenta renovar ou fazer a troca inicial
    if (!access_token) {
        if (AUTH_CODE) {
            await getNewTokens(AUTH_CODE); // Tenta a troca inicial com o código de 1 minuto
        } else {
            // Tenta renovar, caso a primeira troca já tenha sido feita
            await refreshAccessToken(); 
        }
    }

    // 3. Endpoint da API (NF-e)
    const url = `${BLING_API_BASE_URL}/nfes?filters=${encodeURIComponent(filter)}`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${access_token}`,
            'Accept': 'application/json'
        }
    });

    const data = await response.json();
    
    if (response.ok) {
        return {
            status: 'success',
            totalNotas: data.data.length,
            notas: data.data
        };
    } else {
        // Trata erro de token expirado (requer renovação na próxima chamada)
        if (data.error && data.error.type === 'invalid_token') {
             access_token = null; // Zera para tentar renovar na próxima execução
             throw new Error("Access Token Expirado/Inválido. Próxima execução tentará renovação.");
        }
        
        console.error('Erro na API Bling:', data);
        throw new Error(`Erro ao buscar notas: ${data.error_description || JSON.stringify(data)}`);
    }
}


// -------------------------------------------------------------
// HANDLER DA SERVERLESS FUNCTION DO VERCEL
// -------------------------------------------------------------

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ status: 'error', message: 'Método não permitido.' });
    }

    try {
        // Mude o filtro de data para o que você precisa.
        const filtro = 'dataEmissao[01/01/2025 TO 01/01/2025]'; 
        
        const result = await fetchNotasFiscais(filtro);
        
        if (result.status === 'success') {
            // Este é o ponto onde a auditoria de dados está completa.
            return res.status(200).json({ 
                status: 'success', 
                message: `Coleta e Autenticação OK. ${result.totalNotas} notas processadas.`,
                dataSample: result.notas.slice(0, 5) // Amostra de dados para verificação
            });
        }

    } catch (error) {
        console.error('Erro fatal no handler:', error);
        return res.status(500).json({ 
            status: 'error', 
            message: 'Erro interno do servidor.', 
            detail: error.message 
        });
    }
}