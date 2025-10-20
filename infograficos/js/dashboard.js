// dashboard.js
import fs from 'fs';
import { parse } from 'csv-parse/sync';

const LOJAS = {
  'TAPETES SAO CARLOS LTDA.': 'TAPETES SÃO CARLOS',
  'ROJEMA IMPORTAÇÃO': 'ROJEMA IMPORTAÇÃO',
  'MEU EXAGERADO': 'MEU EXAGERADO',
  'ACOSTAMENTO SP': 'ACOSTAMENTO SP',
  'Loja Principal': 'Loja Principal'
};

function extrairMarca(descricao) {
  if (!descricao) return 'NÃO INFORMADO';
  const desc = descricao.toUpperCase();
  const marcas = ['NIKE', 'ADIDAS', 'PUMA', 'REEBOK', 'NEW BALANCE', 'TAPETE'];
  for (const marca of marcas) if (desc.includes(marca)) return marca;
  const primeira = descricao.split(/[\s\-]/)[0];
  return primeira && primeira.length > 2 ? primeira.toUpperCase() : 'GENÉRICO';
}

function processarDados(csvData) {
  const dados = {
    resumo: { totalVendas: 0, totalNotas: 0, totalItens: 0, ticketMedio: 0 },
    porLoja: {},
    porDia: {},
    topProdutos: {},
    porMarca: {}
  };

  csvData.forEach(row => {
    if (row['Situação'] !== 'Autorizada') return;

    const valorTotal = parseFloat(row['Valor total'].replace(',', '.')) || 0;
    const quantidade = parseFloat(row['Quantidade'].replace(',', '.')) || 0;
    const dataParte = row['Data de emissão']?.split(' ')[0] || '';
    let nomeLoja = LOJAS[row['Fornecedor']] || 'NÃO INFORMADO';

    dados.resumo.totalNotas++;
    dados.resumo.totalVendas += valorTotal;
    dados.resumo.totalItens += quantidade;

    if (!dados.porLoja[nomeLoja]) dados.porLoja[nomeLoja] = { vendas: 0, notas: 0, itens: 0 };
    dados.porLoja[nomeLoja].vendas += valorTotal;
    dados.porLoja[nomeLoja].notas++;
    dados.porLoja[nomeLoja].itens += quantidade;

    if (!dados.porDia[dataParte]) dados.porDia[dataParte] = { vendas: 0, notas: 0, itens: 0 };
    dados.porDia[dataParte].vendas += valorTotal;
    dados.porDia[dataParte].notas++;
    dados.porDia[dataParte].itens += quantidade;

    const codigo = row['Código'] || 'SEM_CODIGO';
    const descricao = row['Descrição'] || 'Sem descrição';
    const marca = extrairMarca(descricao);

    if (!dados.topProdutos[codigo]) {
      dados.topProdutos[codigo] = { codigo, descricao, marca, quantidade: 0, valorTotal: 0 };
    }
    dados.topProdutos[codigo].quantidade += quantidade;
    dados.topProdutos[codigo].valorTotal += valorTotal;

    if (!dados.porMarca[marca]) dados.porMarca[marca] = { vendas: 0, quantidade: 0, notas: 0 };
    dados.porMarca[marca].vendas += valorTotal;
    dados.porMarca[marca].quantidade += quantidade;
  });

  dados.resumo.ticketMedio = dados.resumo.totalNotas > 0 ? dados.resumo.totalVendas / dados.resumo.totalNotas : 0;

  return {
    resumo: dados.resumo,
    lojasArray: Object.entries(dados.porLoja).map(([nome, info]) => ({ nome, ...info })).sort((a, b) => b.vendas - a.vendas),
    diasArray: Object.entries(dados.porDia).map(([data, info]) => ({ data, ...info })).sort((a, b) => a.data.localeCompare(b.data)),
    produtosTop: Object.values(dados.topProdutos).sort((a, b) => b.quantidade - a.quantidade).slice(0, 10),
    marcasArray: Object.entries(dados.porMarca).map(([marca, info]) => ({ marca, ...info })).sort((a, b) => b.vendas - a.vendas)
  };
}

function gerarHTML(dados) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard de Vendas - Bling</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    .resumo { font-weight: bold; margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>Dashboard de Vendas - Bling</h1>
  <div class="resumo">
    Total de Vendas: R$ ${dados.resumo.totalVendas.toFixed(2)} | 
    Total de Notas: ${dados.resumo.totalNotas} | 
    Total de Itens: ${dados.resumo.totalItens} | 
    Ticket Médio: R$ ${dados.resumo.ticketMedio.toFixed(2)}
  </div>

  <h2>Vendas por Loja</h2>
  <table>
    <tr><th>Loja</th><th>Vendas (R$)</th><th>Notas</th><th>Itens</th></tr>
    ${dados.lojasArray.map(l => `
      <tr>
        <td>${l.nome}</td>
        <td>${l.vendas.toFixed(2)}</td>
        <td>${l.notas}</td>
        <td>${l.itens}</td>
      </tr>
    `).join('')}
  </table>

  <h2>Vendas por Dia</h2>
  <table>
    <tr><th>Data</th><th>Vendas (R$)</th><th>Notas</th><th>Itens</th></tr>
    ${dados.diasArray.map(d => `
      <tr>
        <td>${d.data}</td>
        <td>${d.vendas.toFixed(2)}</td>
        <td>${d.notas}</td>
        <td>${d.itens}</td>
      </tr>
    `).join('')}
  </table>

  <h2>Top 10 Produtos</h2>
  <table>
    <tr><th>Código</th><th>Descrição</th><th>Marca</th><th>Quantidade</th><th>Valor Total (R$)</th></tr>
    ${dados.produtosTop.map(p => `
      <tr>
        <td>${p.codigo}</td>
        <td>${p.descricao}</td>
        <td>${p.marca}</td>
        <td>${p.quantidade}</td>
        <td>${p.valorTotal.toFixed(2)}</td>
      </tr>
    `).join('')}
  </table>

  <h2>Vendas por Marca</h2>
  <table>
    <tr><th>Marca</th><th>Vendas (R$)</th><th>Quantidade</th><th>Notas</th></tr>
    ${dados.marcasArray.map(m => `
      <tr>
        <td>${m.marca}</td>
        <td>${m.vendas.toFixed(2)}</td>
        <td>${m.quantidade}</td>
        <td>${m.notas}</td>
      </tr>
    `).join('')}
  </table>
</body>
</html>
`;
}

function main() {
  const csvFilePath = '../data/bling_export.csv'; // Ajuste do caminho
  if (!fs.existsSync(csvFilePath)) {
    console.error('Arquivo CSV não encontrado em:', csvFilePath);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(csvFilePath, { encoding: 'utf-8' });
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter: ',',
    relax_column_count_less: true
  });

  const dados = processarDados(records);
  const htmlOutput = gerarHTML(dados);

  fs.writeFileSync('./dashboard.html', htmlOutput); // Salva na pasta atual (infograficos/js/)
  console.log('Dashboard gerado com sucesso em dashboard.html');
}

main();