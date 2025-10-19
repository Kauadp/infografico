// api/bling-debug.js
// Endpoint para debugar estrutura dos dados do Bling

const BLING_API_BASE_URL = 'https://api.bling.com.br/Api/v3';
const access_token = process.env.BLING_ACCESS_TOKEN;

export default async function handler(req, res) {
  if (!access_token) {
    return res.status(401).json({ erro: 'ACCESS_TOKEN não configurado' });
  }

  try {
    const { dataInicio, dataFim } = req.query;
    
    const testes = [];
    
    if (dataInicio && dataFim) {
      // Formato 1: YYYY-MM-DD com horários (recomendado)
      const filtro1 = `dataEmissao[${dataInicio} 00:00:00 TO ${dataFim} 23:59:59]`;
      const url1 = `${BLING_API_BASE_URL}/nfce?filters=${encodeURIComponent(filtro1)}&limite=100`;
      
      console.log('Testando filtro 1:', filtro1);
      console.log('URL:', url1);
      
      const response1 = await fetch(url1, {
        headers: { 'Authorization': `Bearer ${access_token}`, 'Accept': 'application/json' }
      });
      const data1 = await response1.json();
      
      testes.push({
        formato: 'YYYY-MM-DD HH:MM:SS com TO',
        filtro: filtro1,
        url: url1,
        status: response1.status,
        sucesso: response1.ok,
        totalNotas: data1.data?.length || 0,
        primeiraData: data1.data?.[0]?.dataEmissao,
        ultimaData: data1.data?.[data1.data.length - 1]?.dataEmissao,
        amostra: data1.data?.slice(0, 2),
        erro: !response1.ok ? data1 : null
      });

      // Formato 2: YYYY-MM-DD sem horários (original)
      const filtro2 = `dataEmissao[${dataInicio} TO ${dataFim}]`;
      const url2 = `${BLING_API_BASE_URL}/nfce?filters=${encodeURIComponent(filtro2)}&limite=100`;
      
      console.log('Testando filtro 2:', filtro2);
      console.log('URL:', url2);
      
      const response2 = await fetch(url2, {
        headers: { 'Authorization': `Bearer ${access_token}`, 'Accept': 'application/json' }
      });
      const data2 = await response2.json();
      
      testes.push({
        formato: 'YYYY-MM-DD com TO',
        filtro: filtro2,
        url: url2,
        status: response2.status,
        sucesso: response2.ok,
        totalNotas: data2.data?.length || 0,
        primeiraData: data2.data?.[0]?.dataEmissao,
        ultimaData: data2.data?.[data2.data.length - 1]?.dataEmissao,
        amostra: data2.data?.slice(0, 2),
        erro: !response2.ok ? data2 : null
      });
    }

    return res.status(200).json({
      status: 'success',
      periodo: { dataInicio, dataFim },
      testes,
      recomendacao: testes.find(t => t.sucesso && t.totalNotas > 0)?.formato || 'Nenhum formato funcionou'
    });

  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}
