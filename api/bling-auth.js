// api/bling-auth.js

import fetch from 'node-fetch';

// 1. URLs base da API do Bling
const BLING_OAUTH_URL = 'https://api.bling.com.br/oauth/token';
const BLING_API_BASE_URL = 'https://api.bling.com.br/Api/v3';

// 2. Credenciais obtidas das Variáveis de Ambiente
// Importante: Estes valores devem ser configurados no painel do Vercel
const CLIENT_ID = process.env.BLING_CLIENT_ID;
const CLIENT_SECRET = process.env.BLING_CLIENT_SECRET;
const REDIRECT_URI = process.env.BLING_REDIRECT_URI;

// Variáveis de Token (serão lidas/salvas de onde você as guarda)
// Por enquanto, usaremos variáveis de ambiente como um placeholder simples.
let access_token = process.env.BLING_ACCESS_TOKEN;
let refresh_token = process.env.BLING_REFRESH_TOKEN;


/**
 * Função para trocar o Código de Autorização pelo Access Token e Refresh Token.
 * ESTE PASSO É EXECUTADO APENAS UMA VEZ!
 * @param {string} code - O código de autorização obtido no navegador (Passo 2A).
 */
async function getNewTokens(code) {
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
            // **IMPORTANTE:**
            // Você deve SALVAR data.access_token e data.refresh_token
            // em um local SEGURO e persistente (ex: um banco de dados).
            // Aqui, apenas atualizamos as variáveis locais como exemplo.
            access_token = data.access_token;
            refresh_token = data.refresh_token;

            console.log('Tokens obtidos com sucesso!');
            console.log('ATENÇÃO: ATUALIZE as variáveis BLING_ACCESS_TOKEN e BLING_REFRESH_TOKEN no Vercel.');
            return data;
        } else {
            console.error('Erro na troca de código:', data);
            throw new Error(`Erro ao obter tokens: ${data.error_description || data.error}`);
        }
    } catch (error) {
        console.error('Erro de requisição:', error);
        throw error;
    }
}


/**
 * Função para renovar o Access Token usando o Refresh Token.
 * O Access Token expira em 6 horas, e o Refresh Token dura 30 dias.
 */
async function refreshAccessToken() {
    if (!refresh_token) {
        throw new Error("Refresh Token não encontrado. Execute o getNewTokens primeiro.");
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
            // **IMPORTANTE:**
            // Você deve SALVAR o novo data.access_token e data.refresh_token
            // em seu armazenamento persistente.
            access_token = data.access_token;
            refresh_token = data.refresh_token;

            console.log('Access Token renovado com sucesso!');
            // Na sua aplicação real, você deve atualizar o armazenamento persistente aqui.
            return access_token;
        } else {
            console.error('Erro na renovação do token:', data);
            throw new Error(`Erro ao renovar token: ${data.error_description || data.error}`);
        }
    } catch (error) {
        console.error('Erro de requisição:', error);
        throw error;
    }
}


/**
 * Endpoint principal para buscar as Notas Fiscais.
 * Esta é a função que será chamada pelo seu script agendado.
 * @param {string} filter - Filtro da API do Bling (ex: 'dataEmissao[01/01/2025 TO 01/01/2025]')
 */
async function fetchNotasFiscais(filter = '') {
    // 1. Garante que temos um token válido (na vida real, cheque a expiração e renove se necessário)
    if (!access_token) {
        // Para a primeira execução, use o código de autorização (se presente)
        const authCode = process.env.BLING_AUTH_CODE;
        if (authCode) {
            await getNewTokens(authCode);
            // APÓS A PRIMEIRA EXECUÇÃO DE SUCESSO, REMOVA A VARIÁVEL BLING_AUTH_CODE DO VERCEL!
            // E SALVE OS NOVOS TOKENS LÁ!
        } else {
            // Tenta renovar, caso a variável tenha sido configurada manualmente
            await refreshAccessToken();
        }
    }
    
    // 2. Endpoint da API (NF-e)
    const url = `${BLING_API_BASE_URL}/nfes?filters=${encodeURIComponent(filter)}`;

    console.log(`Buscando dados com o filtro: ${filter}`);

    try {
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
                totalNotas: data.data.length, // ou o total retornado pelo Bling
                notas: data.data // O array de notas fiscais
            };
        } else {
            console.error('Erro na API Bling:', data);
            // Se o token expirou, você pode tentar renovar e re-chamar (lógica mais avançada)
            return {
                status: 'error',
                message: `Erro ao buscar notas: ${data.error_description || data.error || JSON.stringify(data)}`
            };
        }

    } catch (error) {
        console.error('Erro de rede/execução:', error);
        return { status: 'error', message: `Erro de execução: ${error.message}` };
    }
}


// Função handler do Vercel
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ status: 'error', message: 'Método não permitido.' });
    }

    try {
        // Exemplo: Buscar notas fiscais de 01/01/2025 (ajuste este filtro para o seu uso real)
        const filtro = 'dataEmissao[01/01/2025 TO 01/01/2025]'; 
        
        const result = await fetchNotasFiscais(filtro);
        
        if (result.status === 'success') {
            // **Aqui você SALVARIA as 'result.notas' no seu banco de dados no Vercel**
            // E retornaria um JSON para o cliente frontend (ou para o agendador)

            return res.status(200).json({ 
                status: 'success', 
                message: `Coletadas ${result.totalNotas} notas. (Dados prontos para salvar/visualizar)`,
                data: result.notas
            });
        } else {
            return res.status(500).json(result);
        }

    } catch (error) {
        console.error('Erro fatal no handler:', error);
        return res.status(500).json({ status: 'error', message: 'Erro interno do servidor.', detail: error.message });
    }
}