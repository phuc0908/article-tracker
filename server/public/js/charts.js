/**
 * ARTICLE TRACKER - CHART.JS VISUALIZATION MANAGER (LIGHT MODE)
 */

const ChartManager = {
    domainChart: null,
    trendChart: null,
    scrollChart: null,
    hourlyChart: null,

    chartColors: {
        indigo: '#4f46e5',
        purple: '#7c3aed',
        cyan: '#0891b2',
        emerald: '#059669',
        amber: '#d97706',
        rose: '#e11d48',
        blue: '#2563eb',
        palette: [
            '#4f46e5',
            '#0891b2',
            '#059669',
            '#d97706',
            '#db2777',
            '#7c3aed',
            '#2563eb',
            '#0d9488'
        ]
    },

    init() {
        // Global defaults for Chart.js in Light Mode
        Chart.defaults.color = '#475569';
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.95)';
        Chart.defaults.plugins.tooltip.borderColor = '#e2e8f0';
        Chart.defaults.plugins.tooltip.borderWidth = 1;
        Chart.defaults.plugins.tooltip.padding = 10;
        Chart.defaults.plugins.tooltip.cornerRadius = 6;
    },

    /**
     * Update or Initialize Domain Doughnut Chart
     */
    renderDomainChart(topDomains) {
        const ctx = document.getElementById('domainChart');
        if (!ctx) return;

        const labels = (topDomains && topDomains.length > 0)
            ? topDomains.map(d => d.domain)
            : ['Chưa có dữ liệu'];
        const data = (topDomains && topDomains.length > 0)
            ? topDomains.map(d => Math.round((d.total_reading_time || 0) / 60))
            : [1];

        if (this.domainChart) {
            this.domainChart.data.labels = labels;
            this.domainChart.data.datasets[0].data = data;
            this.domainChart.update();
            return;
        }

        this.domainChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: this.chartColors.palette,
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 12,
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label(context) {
                                return ` ${context.label}: ${context.raw} phút`;
                            }
                        }
                    }
                }
            }
        });
    },

    /**
     * Update or Initialize Reading Trends Line/Area Chart
     */
    renderTrendChart(articles) {
        const ctx = document.getElementById('trendChart');
        if (!ctx) return;

        // Group articles by date / last seen
        const dateMap = {};
        const recentArticles = [...(articles || [])].slice(0, 15).reverse();

        recentArticles.forEach(art => {
            const dateStr = art.last_seen ? new Date(art.last_seen).toLocaleDateString('vi-VN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Chưa rõ';
            const readingMin = Math.round((art.total_reading_time_sec || 0) / 60 * 10) / 10;
            dateMap[dateStr] = (dateMap[dateStr] || 0) + readingMin;
        });

        const labels = Object.keys(dateMap).length > 0 ? Object.keys(dateMap) : ['Hôm nay'];
        const values = Object.keys(dateMap).length > 0 ? Object.values(dateMap) : [0];

        if (this.trendChart) {
            this.trendChart.data.labels = labels;
            this.trendChart.data.datasets[0].data = values;
            this.trendChart.update();
            return;
        }

        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 240);
        gradient.addColorStop(0, 'rgba(79, 70, 229, 0.25)');
        gradient.addColorStop(1, 'rgba(79, 70, 229, 0.0)');

        this.trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Thời gian đọc (phút)',
                    data: values,
                    borderColor: '#4f46e5',
                    borderWidth: 2.5,
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: '#4f46e5',
                    pointBorderColor: '#ffffff',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#f1f5f9' },
                        ticks: {
                            callback: value => value + 'm'
                        }
                    },
                    x: {
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    },

    /**
     * Update or Initialize Scroll Depth Distribution Bar Chart
     */
    renderScrollChart(articles) {
        const ctx = document.getElementById('scrollChart');
        if (!ctx) return;

        let b0_25 = 0, b25_50 = 0, b50_75 = 0, b75_100 = 0;

        (articles || []).forEach(a => {
            const s = a.max_scroll_percent || 0;
            if (s <= 25) b0_25++;
            else if (s <= 50) b25_50++;
            else if (s <= 75) b50_75++;
            else b75_100++;
        });

        const labels = ['0-25%', '26-50%', '51-75%', '76-100%'];
        const data = [b0_25, b25_50, b50_75, b75_100];

        if (this.scrollChart) {
            this.scrollChart.data.datasets[0].data = data;
            this.scrollChart.update();
            return;
        }

        this.scrollChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Số bài báo',
                    data: data,
                    backgroundColor: ['#3b82f6', '#06b6d4', '#10b981', '#7c3aed'],
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 },
                        grid: { color: '#f1f5f9' }
                    },
                    x: {
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label(context) {
                                return ` ${context.raw} bài báo`;
                            }
                        }
                    }
                }
            }
        });
    },

    /**
     * Update or Initialize Hourly Heatmap / Distribution Bar Chart
     */
    renderHourlyChart(hourlyData) {
        const ctx = document.getElementById('hourlyChart');
        if (!ctx) return;

        const hourMap = {};
        for (let i = 0; i < 24; i++) {
            const h = String(i).padStart(2, '0');
            hourMap[h] = 0;
        }

        (hourlyData || []).forEach(item => {
            if (item.hour && hourMap[item.hour] !== undefined) {
                hourMap[item.hour] = item.event_count;
            }
        });

        const labels = Object.keys(hourMap).map(h => `${h}h`);
        const values = Object.values(hourMap);

        if (this.hourlyChart) {
            this.hourlyChart.data.datasets[0].data = values;
            this.hourlyChart.update();
            return;
        }

        this.hourlyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Hoạt động đọc',
                    data: values,
                    backgroundColor: 'rgba(8, 145, 178, 0.75)',
                    hoverBackgroundColor: '#0891b2',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 },
                        grid: { color: '#f1f5f9' }
                    },
                    x: {
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
};
