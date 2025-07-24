// Palette: Energetic & Playful (Adjusted to Exagerado brand colors where applicable)
// Colors: #61BB46 (Primary Green), #5C3E8A (Secondary Purple), #004D7A (Dark Blue), #F47721 (Orange), #00BFB2 (Teal), #FDBB2D (Yellow), #E2E8F0 (Light Gray)

// Funções auxiliares (estas podem ser compartilhadas por todos os gráficos)
function wrapLabel(label) {
    if (typeof label !== 'string' || label.length <= 16) {
        return label;
    }
    const words = label.split(' ');
    let lines = [];
    let currentLine = '';
    words.forEach(word => {
        if ((currentLine + word).length > 16 && currentLine !== '') {
            lines.push(currentLine.trim());
            currentLine = word + ' ';
        } else {
            currentLine += word + ' ';
        }
    });
    if (currentLine !== '') {
        lines.push(currentLine.trim());
    }
    return lines;
}

const chartTooltipConfig = {
    plugins: {
        tooltip: {
            callbacks: {
                title: function(tooltipItems) {
                    const item = tooltipItems[0];
                    let label = item.chart.data.labels[item.dataIndex];
                    if (Array.isArray(label)) {
                        return label.join(' ');
                    } else {
                        return label;
                    }
                }
            }
        }
    }
};

// --- FUNÇÕES REUTILIZÁVEIS PARA CADA GRÁFICO ---

// Função para criar/atualizar o Outbound Benchmark Chart
function createOutboundBenchmarkChart(elementId, yourCompanyData, benchmarkData) {
    const ctx = document.getElementById(elementId).getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Ligações / Relevantes', 'Relevantes / Agendamentos', 'Ligações / Agendamentos'],
            datasets: [
                {
                    label: 'Exagerado (B2B)',
                    data: yourCompanyData, // Dados passados como parâmetro
                    backgroundColor: '#F47721',
                    borderRadius: 5
                },
                {
                    label: 'Benchmark de Mercado (B2B)',
                    data: benchmarkData, // Dados passados como parâmetro (pode ser fixo ou variável)
                    backgroundColor: '#004D7A',
                    borderRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Taxa de Conversão (%)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            ...chartTooltipConfig
        }
    });
}

// Função para criar/atualizar o Team Radar Chart
function createTeamRadarChart(elementId, teamPerformanceData) {
    const ctx = document.getElementById(elementId).getContext('2d');
    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Ligações / Relevantes', 'Relevantes / Agendamentos', 'Ligações / Agendamentos'],
            datasets: teamPerformanceData.map(member => ({ // Dados passados como parâmetro
                label: member.label,
                data: member.data,
                backgroundColor: member.backgroundColor,
                borderColor: member.borderColor,
                borderWidth: 2,
                pointBackgroundColor: member.pointBackgroundColor
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { display: true },
                    suggestedMin: 0,
                    suggestedMax: 30,
                    pointLabels: { font: { size: 12 } }
                }
            },
            ...chartTooltipConfig
        }
    });
}

// Função para criar/atualizar o Inbound Funnel Chart
function createInboundFunnelChart(elementId, funnelLabels, funnelData) {
    const ctx = document.getElementById(elementId).getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: funnelLabels, // Rótulos passados como parâmetro
            datasets: [{
                data: funnelData, // Dados passados como parâmetro
                backgroundColor: ['#004D7A', '#F47721', '#FDBB2D', '#E2E8F0', '#00BFB2'],
                borderColor: '#FFFFFF',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 20, padding: 15, font: { size: 12 } } },
                ...chartTooltipConfig.plugins
            }
        }
    });
}

// Função para criar/atualizar o Loss Reasons Chart
function createLossReasonsChart(elementId, lossReasonsLabels, lossReasonsData, backgroundColors) {
    const ctx = document.getElementById(elementId).getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: lossReasonsLabels.map(wrapLabel), // Rótulos passados como parâmetro, com wrapLabel
            datasets: [
                {
                    label: 'Número de Perdas',
                    data: lossReasonsData, // Dados passados como parâmetro
                    backgroundColor: backgroundColors, // Cores passadas como parâmetro
                    borderRadius: 5
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { beginAtZero: true, title: { display: true, text: 'Contagem de Perdas' } },
                y: { grid: { display: false } }
            },
            ...chartTooltipConfig
        }
    });
}

// Função para criar/atualizar o Relevant Calls Simulation Chart
function createRelevantCallsSimulationChart(elementId, labels, realData, simulatedData) {
    const ctx = document.getElementById(elementId).getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Distribuição Real',
                    data: realData,
                    backgroundColor: 'rgba(244, 119, 33, 0.4)', // Laranja com transparência
                    borderColor: '#F47721',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Distribuição Simulada Quadruplicada',
                    data: simulatedData,
                    backgroundColor: 'rgba(0, 191, 178, 0.4)', // Teal com transparência
                    borderColor: '#00BFB2',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Valores'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Densidade'
                    },
                    beginAtZero: true,
                    // Deixamos sem suggestedMax para auto-ajustar a densidade,
                    // ou você pode adicionar um valor máximo se seus dados forem escalados.
                }
            },
            ...chartTooltipConfig
        }
    });
}

// Nova função para criar/atualizar o gráfico de Agendamentos Totais por Mês
function createMonthlyAppointmentsChart(elementId, labels, data) {
    const ctx = document.getElementById(elementId).getContext('2d');
    new Chart(ctx, {
        type: 'line', // Gráfico de linha
        data: {
            labels: labels, // Nomes dos meses (eixo X)
            datasets: [{
                label: 'Agendamentos Totais',
                data: data, // Total de agendamentos por mês (eixo Y)
                borderColor: '#004D7A', // Azul escuro da marca
                backgroundColor: 'rgba(0, 77, 122, 0.2)', // Azul escuro com transparência para a área
                fill: true, // Preenche a área abaixo da linha
                tension: 0.4, // Suaviza a linha
                pointBackgroundColor: '#004D7A', // Cor dos pontos
                pointRadius: 5, // Tamanho dos pontos
                pointHoverRadius: 7 // Tamanho dos pontos ao passar o mouse
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                },
                tooltip: chartTooltipConfig.plugins.tooltip // Reutiliza a configuração do tooltip
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Mês'
                    },
                    grid: {
                        display: false // Remove as linhas de grade verticais
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Agendamentos'
                    },
                    beginAtZero: true,
                    ticks: {
                        precision: 0 // Garante que os valores do eixo Y sejam inteiros
                    }
                }
            }
        }
    });
}