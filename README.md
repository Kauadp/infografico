# Infográfico de Análise de Desempenho

[![Deploy](https://img.shields.io/badge/Ver%20online-dashboardexagerado.vercel.app-blue?style=flat-square)](https://dashboardexagerado.vercel.app)

## Descrição

Este repositório apresenta um infográfico interativo para Análise de Desempenho, desenvolvido durante meu estágio em uma empresa de consultoria. O projeto vai além de uma interface web, integrando ciência de dados, modelagem estatística, engenharia de dados e automação de relatórios para gerar insights de negócios.

## Principais Destaques

- **Machine Learning (ML):**  
  - O arquivo principal (`index.html`) exibe resultados oriundos de um modelo de _Random Forest_, treinado em dados obtidos via _webscraping_ e do CRM da empresa.
  - O modelo, construído em R, atinge **90% de acurácia em treino** e **80% em teste**.
  - APIs para predição e automação foram desenvolvidas e _deployadas_ com [R Plumber](https://www.rplumber.io/).

- **Análise de Séries Temporais:**  
  - O documento HTML “Estudo de Tendência SP” traz ajustes de modelos de séries temporais para **43 empresas distintas**, permitindo análise detalhada de tendências mensais e sazonais.

- **Relatórios Mensais:**  
  - O infográfico compila e apresenta relatórios de desempenho mensal, proporcionando uma visão clara da evolução ao longo do tempo.

- **Engenharia de Dados e Automação:**  
  - Dados de diferentes fontes (incluindo Excel) foram transferidos para um banco de dados online (Airtable), utilizando queries customizadas e automações.
  - O KANBAN de atividades também foi migrado e automatizado para facilitar o acompanhamento das demandas.

- **Web e Visualização:**  
  - Interface responsiva em HTML, CSS e JS.
  - Visualização interativa dos principais indicadores e insights extraídos dos modelos.

## Tecnologias Utilizadas

- **R**: Modelagem estatística, machine learning, APIs com Plumber
- **HTML/CSS/JS**: Front-end do infográfico
- **Airtable**: Banco de dados online para integração dos dados
- **Webscraping**: Coleta automatizada de dados externos
- **APIs**: Conexão entre modelos, dados e visualizações

## Instalação

1. Clone este repositório:
   ```bash
   git clone https://github.com/Kauadp/infografico.git
   ```
2. Navegue até a pasta do projeto:
   ```bash
   cd infografico
   ```
3. Abra o arquivo principal (`index.html`) no seu navegador.

## Como usar

- Acesse a versão online para visualizar o infográfico: [dashboardexagerado.vercel.app](https://dashboardexagerado.vercel.app)
- Para replicar as análises e modelos, confira os scripts em R (caso estejam disponíveis) e as integrações com API/Airtable.

## Estrutura do Projeto

- `index.html` — Página principal (visualização de dados, resultados de ML)
- `Estudo de Tendencia SP.html` — Análise de séries temporais por empresa
- Scripts de integração e automação (em R, API Plumber, queries para Airtable)
- Arquivos auxiliares (CSS, JS, imagens)

## Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou enviar pull requests para sugerir melhorias ou correções.

## Sobre

Este projeto foi desenvolvido como parte do meu estágio, integrando habilidades em ciência de dados, modelagem estatística, engenharia de dados e desenvolvimento web.  
Sou estudante de Estatística buscando consolidar minha carreira como Cientista de Dados. Este repositório é o meu principal portfólio, demonstrando experiência prática em modelagem, API, automação, banco de dados e geração de insights.

## Licença

Este projeto não possui licença definida explicitamente. Consulte o autor para mais informações.

---

Desenvolvido por [@Kauadp](https://github.com/Kauadp)