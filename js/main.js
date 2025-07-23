// Palette: Energetic & Playful (Adjusted to Exagerado brand colors where applicable)
// Colors: #61BB46 (Primary Green), #5C3E8A (Secondary Purple), #004D7A (Dark Blue), #F47721 (Orange), #00BFB2 (Teal), #FDBB2D (Yellow), #E2E8F0 (Light Gray)

// Function to wrap long labels for Chart.js
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

// Chart.js Tooltip Configuration
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

// Outbound Benchmark Chart
const outboundBenchmarkCtx = document.getElementById('outboundBenchmarkChart').getContext('2d');
new Chart(outboundBenchmarkCtx, {
    type: 'bar',
    data: {
        labels: ['Ligações / Relevantes', 'Relevantes / Agendamentos', 'Ligações / Agendamentos'],
        datasets: [
            {
                label: 'Sua Empresa (B2B)',
                data: [5.7, 13.3, 0.8],
                backgroundColor: '#F47721', // Laranja de destaque
                borderRadius: 5
            },
            {
                label: 'Benchmark de Mercado (B2B)',
                data: [11.5, 9.25, 3.5],
                backgroundColor: '#004D7A', // Azul escuro
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

// Team Radar Chart
const teamRadarCtx = document.getElementById('teamRadarChart').getContext('2d');
new Chart(teamRadarCtx, {
    type: 'radar',
    data: {
        labels: ['Ligações / Relevantes', 'Relevantes / Agendamentos', 'Ligações / Agendamentos'],
        datasets: [
            {
                label: 'Bruna Azevedo',
                data: [5.3, 25.3, 1.3],
                backgroundColor: 'rgba(244, 119, 33, 0.4)', // Laranja com transparência
                borderColor: '#F47721',
                borderWidth: 2,
                pointBackgroundColor: '#F47721'
            },
            {
                label: 'Emilin',
                data: [7.3, 6.5, 0.5],
                backgroundColor: 'rgba(0, 77, 122, 0.4)', // Azul escuro com transparência
                borderColor: '#004D7A',
                borderWidth: 2,
                pointBackgroundColor: '#004D7A'
            },
             {
                label: 'Stela',
                data: [5.6, 14.2, 0.8],
                backgroundColor: 'rgba(0, 191, 178, 0.4)', // Teal com transparência
                borderColor: '#00BFB2',
                borderWidth: 2,
                pointBackgroundColor: '#00BFB2'
            }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            r: {
                angleLines: {
                    display: true
                },
                suggestedMin: 0,
                suggestedMax: 30,
                pointLabels: {
                    font: {
                        size: 12
                    }
                }
            }
        },
        ...chartTooltipConfig
    }
});

// Inbound Funnel Chart (Donut)
const inboundFunnelCtx = document.getElementById('inboundFunnelChart').getContext('2d');
new Chart(inboundFunnelCtx, {
    type: 'doughnut',
    data: {
        labels: ['MQLs (106)', 'SQLs (0)', 'Agendamentos (2)', 'Reuniões Realizadas (1)'],
        datasets: [{
            data: [106 - 0, 0, 2, 1],
            backgroundColor: ['#004D7A', '#F47721', '#FDBB2D', '#00BFB2'], // Azul, Laranja, Amarelo, Teal
            borderColor: '#FFFFFF',
            borderWidth: 2
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
            legend: {
                position: 'right',
                labels: {
                    boxWidth: 20,
                    padding: 15,
                    font: {
                        size: 12
                    }
                }
            },
            ...chartTooltipConfig.plugins
        }
    }
});

// Loss Reasons Chart (Bar Chart)
const lossReasonsCtx = document.getElementById('lossReasonsChart').getContext('2d');
new Chart(lossReasonsCtx, {
    type: 'bar',
    data: {
        labels: [
            wrapLabel('Empresa fora de perfil (Prospect)'),
            wrapLabel('Dados incorretos/correlatos (Leads)'),
            wrapLabel('No-Show (Oportunidade)'),
            wrapLabel('Não tem verba (Oportunidade)'),
            wrapLabel('Concorrente (Oportunidade)'),
            wrapLabel('Não tem interesse (Leads)'),
            wrapLabel('Não atende (Leads)')
        ],
        datasets: [
            {
                label: 'Número de Perdas',
                data: [25, 20, 15, 10, 8, 7, 5],
                backgroundColor: [
                    '#F47721', // Laranja
                    '#00BFB2', // Teal
                    '#FDBB2D', // Amarelo
                    '#004D7A', // Azul escuro
                    '#F47721',
                    '#00BFB2',
                    '#FDBB2D'
                ],
                borderRadius: 5
            }
        ]
    },
    options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Contagem de Perdas'
                }
            },
            y: {
                grid: {
                    display: false
                }
            }
        },
        ...chartTooltipConfig
    }
});

// Relevant Calls Simulation Chart (Line/Area Chart for density)
const relevantCallsSimulationCtx = document.getElementById('relevantCallsSimulationChart').getContext('2d');
new Chart(relevantCallsSimulationCtx, {
    type: 'line',
    data: {
        labels: Array.from({length: 81}, (_, i) => i),
        datasets: [
            {
                label: 'Distribuição Real',
                data: [
                    0.07, 0.11, 0.12, 0.11, 0.09, 0.07, 0.05, 0.035, 0.025, 0.015,
                    0.01, 0.007, 0.005, 0.003, 0.002, 0.001, 0.0005, 0.0002, 0.0001, 0.00005,
                    0.00002, 0.00001, 0.000005, 0.000002, 0.000001, 0.0000005, 0.0000002, 0.0000001, 0.00000005, 0.00000002,
                    0.00000001, 0.000000005, 0.000000002, 0.000000001, 0.0000000005, 0.0000000002, 0.0000000001, 0.00000000005, 0.00000000002, 0.00000000001,
                    0,0,0,0,0,0,0,0,0,0,
                    0,0,0,0,0,0,0,0,0,0,
                    0,0,0,0,0,0,0,0,0,0,
                    0,0,0,0,0,0,0,0,0,0,
                    0,0,0,0,0,0,0,0,0,0,
                    0,0,0,0,0,0,0,0,0,0
                ].slice(0,81),
                backgroundColor: 'rgba(244, 119, 33, 0.4)', // Laranja com transparência
                borderColor: '#F47721',
                fill: true,
                tension: 0.4
            },
            {
                label: 'Distribuição Simulada Quadruplicada',
                data: [
                    0.02, 0.025, 0.03, 0.035, 0.04, 0.045, 0.05, 0.055, 0.06, 0.065,
                    0.07, 0.075, 0.08, 0.085, 0.09, 0.095, 0.1, 0.105, 0.11, 0.115,
                    0.12, 0.115, 0.11, 0.105, 0.1, 0.095, 0.09, 0.085, 0.08, 0.075,
                    0.07, 0.065, 0.06, 0.055, 0.05, 0.045, 0.04, 0.035, 0.03, 0.025,
                    0.02, 0.018, 0.016, 0.014, 0.012, 0.01, 0.008, 0.006, 0.004, 0.002,
                    0.001, 0.0005, 0.0002, 0.0001, 0.00005, 0.00002, 0.00001, 0.000005, 0.000002, 0.000001,
                    0,0,0,0,0,0,0,0,0,0,
                    0,0,0,0,0,0,0,0,0,0
                ].slice(0,81),
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
                beginAtZero: true
            }
        },
        ...chartTooltipConfig
    }
});