// api/bling-callback.js
// Endpoint que RECEBE o código de autorização do Bling

const CLIENT_ID = process.env.BLING_CLIENT_ID;
const CLIENT_SECRET = process.env.BLING_CLIENT_SECRET;
const REDIRECT_URI = process.env.BLING_REDIRECT_URI;

export default async function handler(req, res) {
  // Pega o código que o Bling enviou na URL
  const { code, error, error_description } = req.query;

  // Se o usuário negou a autorização
  if (error) {
    return res.status(400).send(`
      <html>
        <body style="font-family: Arial; padding: 40px; text-align: center;">
          <h1>❌ Erro na autorização</h1>
          <p><strong>${error}</strong></p>
          <p>${error_description}</p>
        </body>
      </html>
    `);
  }

  // Se não tem código, mostra instruções
  if (!code) {
    return res.status(400).send(`
      <html>
        <body style="font-family: Arial; padding: 40px;">
          <h1>🔐 Callback do Bling</h1>
          <p>Este é o endpoint de callback. Para autorizar:</p>
          <ol>
            <li>Acesse a URL de autorização do Bling</li>
            <li>Você será redirecionado para cá automaticamente</li>
          </ol>
          <a href="https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}" 
             style="display: inline-block; margin-top: 20px; padding: 15px 30px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">
            🚀 Autorizar no Bling
          </a>
        </body>
      </html>
    `);
  }

  // Troca o código pelos tokens
  console.log('🔄 Código recebido, trocando por tokens...');

  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: REDIRECT_URI
  });

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
      // SUCESSO! Mostra os tokens na tela
      return res.status(200).send(`
        <html>
          <head>
            <style>
              body {
                font-family: 'Courier New', monospace;
                padding: 40px;
                background: #1e1e1e;
                color: #d4d4d4;
              }
              .success {
                background: #0e4429;
                border: 2px solid #26a641;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 20px;
              }
              .token-box {
                background: #2d2d2d;
                border: 1px solid #444;
                padding: 15px;
                border-radius: 5px;
                margin: 10px 0;
                overflow-x: auto;
              }
              .token-label {
                color: #569cd6;
                font-weight: bold;
                margin-bottom: 5px;
              }
              .token-value {
                color: #ce9178;
                word-break: break-all;
              }
              button {
                background: #0e4429;
                border: 1px solid #26a641;
                color: #d4d4d4;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                margin-right: 10px;
              }
              button:hover {
                background: #26a641;
              }
            </style>
          </head>
          <body>
            <div class="success">
              <h1>✅ Tokens obtidos com sucesso!</h1>
              <p>Cole estes valores nas variáveis de ambiente do Vercel:</p>
            </div>

            <div class="token-box">
              <div class="token-label">BLING_ACCESS_TOKEN</div>
              <div class="token-value" id="access-token">${data.access_token}</div>
              <button onclick="copyToken('access-token')">📋 Copiar</button>
            </div>

            <div class="token-box">
              <div class="token-label">BLING_REFRESH_TOKEN</div>
              <div class="token-value" id="refresh-token">${data.refresh_token}</div>
              <button onclick="copyToken('refresh-token')">📋 Copiar</button>
            </div>

            <div style="margin-top: 30px; padding: 20px; background: #3a3a00; border: 1px solid #b8860b; border-radius: 5px;">
              <h3>⚠️ Próximos passos:</h3>
              <ol>
                <li>Copie os tokens acima</li>
                <li>Vá em: <strong>Vercel → Seu Projeto → Settings → Environment Variables</strong></li>
                <li>Atualize (ou adicione) as variáveis acima</li>
                <li>Faça um <strong>Redeploy</strong></li>
                <li><strong>REMOVA</strong> a variável <code>BLING_AUTH_CODE</code> (não é mais necessária)</li>
              </ol>
              <p><strong>⏱️ Access Token expira em:</strong> ${(data.expires_in / 3600).toFixed(1)} horas</p>
            </div>

            <script>
              function copyToken(id) {
                const text = document.getElementById(id).textContent;
                navigator.clipboard.writeText(text).then(() => {
                  alert('✅ Token copiado!');
                });
              }
            </script>
          </body>
        </html>
      `);

    } else {
      // Erro ao trocar tokens
      return res.status(500).send(`
        <html>
          <body style="font-family: Arial; padding: 40px;">
            <h1>❌ Erro ao obter tokens</h1>
            <pre style="background: #f5f5f5; padding: 20px; border-radius: 5px;">${JSON.stringify(data, null, 2)}</pre>
          </body>
        </html>
      `);
    }

  } catch (error) {
    return res.status(500).send(`
      <html>
        <body style="font-family: Arial; padding: 40px;">
          <h1>❌ Erro na requisição</h1>
          <p>${error.message}</p>
        </body>
      </html>
    `);
  }
}