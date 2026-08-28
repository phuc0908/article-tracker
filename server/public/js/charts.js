/**
 * ARTICLE TRACKER - CHART.JS VISUALIZATION MANAGER
 */

const ChartManager = {
    domainChart: null,
    trendChart: null,
    scrollChart: null,
    hourlyChart: null,

    chartColors: {
        indigo: '#6366f1',
        purple: '#a855f7',
        cyan: '#06b6d4',
        emerald: '#10b981',
        amber: '#f59e0b',
        rose: '#f43f5e',
        blue: '#3b82f6',
        palette: [
            '#6366f1',
            '#06b6d4',
            '#10b981',
            '#f59e0b',
            '#ec4899',
            '#8b5cf6',
            '#3b82f6',
            '#14b8a6'
        ]
    },

    init() {
        // Global defaults for Chart.js
        Chart.defaults.color = '#94a3b8';
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.9)';
        Chart.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.1)';
        Chart.defaults.plugins.tooltip.borderWidth = 1;
        Chart.defaults.plugins.tooltip.padding = 10;
        Chart.defaults.plugins.tooltip.cornerRadius = 8;
    },

    /**
     * Update or Initialize Domain Doughnut Chart
     */
    renderDomainChart(topDomains) {
        const ctx = document.getElementById('domainChart');
        if (!ctx) return;

        const labels = (topDomains && topDomains.length > 0)
            ? topDomains.map(d => d.domain)
            : ['No data'];
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
                    borderColor: '#121a2d',
                    borderWidth: 3,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '72%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 14,
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
            const dateStr = art.last_seen ? new Date(art.last_seen).toLocaleDateString('vi-VN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown';
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
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.45)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

        this.trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Thời gian đọc (phút)',
                    data: values,
                    borderColor: '#6366f1',
                    borderWidth: 3,
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#6366f1',
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
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
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
                    backgroundColor: ['#3b82f6', '#06b6d4', '#10b981', '#a855f7'],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
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
                    backgroundColor: 'rgba(6, 182, 212, 0.7)',
                    hoverBackgroundColor: '#06b6d4',
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
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
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
