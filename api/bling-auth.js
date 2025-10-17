// api/bling-auth.js

// URLs base da API do Bling
const BLING_OAUTH_URL = 'https://api.bling.com.br/oauth/token';
const BLING_API_BASE_URL = 'https://api.bling.com.br/Api/v3';

// Credenciais (Lidas das Variáveis de Ambiente do Vercel)
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

    console.log('Iniciando troca de código por tokens...');
    const body = new URLSearchParams();
    body.append('grant_type', 'authorization_code');
    body.append('code', code);
    body.append('client_id', CLIENT_ID);
    body.append('client_secret', CLIENT_SECRET);

    try {
        const response = await fetch(BLING_OAUTH_URL, {
            method: 'POST',
            headers: {
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
            console.log('TOKENS OBTIDOS COM SUCESSO!');
            console.log('ATENÇÃO: Você deve salvar os tokens ABAIXO nas Variaveis de Ambiente do Vercel:');
            console.log(`NOVO BLING_ACCESS_TOKEN: ${access_token}`);
            console.log(`NOVO BLING_REFRESH_TOKEN: ${refresh_token}`);
            console.log('E REMOVER a variável BLING_AUTH_CODE.');
            console.log('----------------------------------------------------');

            return true;
        } else {
            console.error('Erro na troca de código:', data);
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

    console.log('Renovando Access Token...');
    const body = new URLSearchParams();
    body.append('grant_type', 'refresh_token');
    body.append('refresh_token', refresh_token);
    body.append('client_id', CLIENT_ID);
    body.append('client_secret', CLIENT_SECRET);

    try {
        const response = await fetch(BLING_OAUTH_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: body
        });

        const data = await response.json();

        if (response.ok) {
            access_token = data.access_token;
            refresh_token = data.refresh_token; // O refresh token também pode ser renovado
            
            console.log('----------------------------------------------------');
            console.log('ACCESS TOKEN RENOVADO!');
            console.log(`NOVO BLING_ACCESS_TOKEN: ${access_token}`);
            console.log('O Refresh Token também pode ter sido atualizado. Verifique!');
            console.log('----------------------------------------------------');
            return true;
        } else {
             // Se falhar, pode ser que o Refresh Token tenha expirado (30 dias)
            console.error('Erro na renovação:', data);
            throw new Error(`Falha na renovação de token. Necessário re-autorizar no navegador.`);
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
 * @param {string} filter - Filtro da API do Bling (ex: 'dataEmissao[01/01/2025 TO 01/01/2025]')
 */
async function fetchNotasFiscais(filter) {
    // 1. Garante que os tokens foram lidos (do Vercel ENV)
    if (!access_token && !AUTH_CODE) {
        throw new Error("Autenticação Pendente: Access Token ou Auth Code não encontrado. Configure as variáveis!");
    }

    // 2. Se o Access Token estiver vazio, tenta renovar ou fazer a troca inicial
    if (!access_token) {
        if (AUTH_CODE) {
            await getNewTokens(AUTH_CODE); // Tenta a troca inicial
        } else {
            await refreshAccessToken(); // Tenta renovar o token
        }
    }

    // 3. Endpoint da API (NF-e)
    const url = `${BLING_API_BASE_URL}/nfes?filters=${encodeURIComponent(filter)}`;

    console.log(`Buscando dados em: ${url}`);

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
        // Trata erro de token expirado, forçando a renovação na próxima chamada
        if (data.error && data.error.type === 'invalid_token') {
             // Não podemos renovar aqui, senão entramos em loop. Deixamos o Access Token
             // vazio e a próxima chamada tentará a renovação.
             access_token = null; 
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
        // Define o filtro para buscar dados.
        // Mude isso para a lógica de filtro que você precisa (ex: notas do último dia).
        const filtro = 'dataEmissao[01/01/2025 TO 01/01/2025]'; 
        
        const result = await fetchNotasFiscais(filtro);
        
        if (result.status === 'success') {
            // **AQUI VOCÊ SALVARIA result.notas EM UM BANCO DE DADOS PERSISTENTE**
            // Como este é o endpoint de coleta, ele apenas retorna o status.
            return res.status(200).json({ 
                status: 'success', 
                message: `Coleta e Autenticação OK. ${result.totalNotas} notas processadas.`,
                // Para testes, retorne uma amostra
                dataSample: result.notas.slice(0, 5) 
            });
        } else {
            return res.status(500).json(result);
        }

    } catch (error) {
        console.error('Erro fatal no handler:', error);
        return res.status(500).json({ status: 'error', message: 'Erro interno do servidor.', detail: error.message });
    }
}