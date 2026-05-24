// Ensure the DOM is fully loaded before initializing the pie chart
document.addEventListener('DOMContentLoaded', () => {
    const chart5 = document.getElementById('chart5');
    const ticketCanvas = document.getElementById('ticketBarChart');
    const messageCanvas = document.getElementById('messageBarChart');
    const ctx5 = chart5 ? chart5.getContext('2d') : null;
    const barCtx = ticketCanvas ? ticketCanvas.getContext('2d') : null;
    const messageCtx = messageCanvas ? messageCanvas.getContext('2d') : null;
    const gaugeRespCtx = document.getElementById('gaugeResponse') ? document.getElementById('gaugeResponse').getContext('2d') : null;
    const gaugeResRateCtx = document.getElementById('gaugeResolution') ? document.getElementById('gaugeResolution').getContext('2d') : null;
    const outwardChartContainer = document.getElementById('outwardMessagesChart');
    let gaugeRespChart = null;
    let gaugeResRateChart = null;
    let ticketChart = null;
    let messageChart = null;
    let outwardMessagesChart = null;
    let analyticsChart = null;
    // Controls and KPI elements
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const branchSelect = document.getElementById('branchSelect');
    const applyFiltersBtn = document.getElementById('applyFilters');
    const exportCsvBtn = document.getElementById('exportCsv');
    const kpiTotalTickets = document.getElementById('kpi-totalTickets');
    const kpiAvgResponse = document.getElementById('kpi-analyticsAvgResponse');
    const kpiResolutionTime = document.getElementById('kpi-resolutionTime');
    const kpiActiveChats = document.getElementById('kpi-analyticsActiveChats');
    const kpiAIFeedbackAvg = document.getElementById('kpi-analyticsAIFeedbackAvg');
    const kpiAIFeedbackCount = document.getElementById('kpi-aiFeedbackCount');

    // Keep last fetched datasets for export
    let lastAnalyticsData = null;
    let lastTicketsData = null;
    let lastMessagesData = null;

    // Function to create bar chart for tickets by period
    function createTicketBarChart(ctx, data) {
        const gradient = ctx.createLinearGradient(0, 0, 0, 340);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.95)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.7)');

        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Day', 'Week', 'Month'],
                datasets: [{
                    label: 'Tickets Created',
                    data: [data.daily, data.weekly, data.monthly],
                    backgroundColor: gradient,
                    hoverBackgroundColor: 'rgba(37, 99, 235, 0.95)',
                    borderColor: 'rgba(37, 99, 235, 0.9)',
                    borderWidth: 0,
                    borderRadius: 24,
                    borderSkipped: false,
                    barPercentage: 0.65,
                    categoryPercentage: 0.7,
                    maxBarThickness: 84
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: context => {
                                const value = context.raw || 0;
                                return ` ${context.dataset.label}: ${value}`;
                            }
                        },
                        backgroundColor: 'rgba(15, 23, 42, 0.92)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderRadius: 14,
                        padding: 12
                    }
                },
                scales: {
                    x: {
                        grid: { display: false, drawBorder: false },
                        ticks: { color: '#334155', font: { size: 14, weight: 600 } }
                    },
                    y: {
                        beginAtZero: true,
                        min: 0,
                        max: 20,
                        grid: { color: 'rgba(148,163,184,0.18)', drawBorder: false },
                        ticks: {
                            color: '#64748b',
                            font: { size: 13 },
                            autoSkip: false,
                            values: [0, 1, 5, 7, 9, 10, 20],
                            callback: value => value.toString()
                        }
                    }
                }
            }
        });
    }

    function updateTicketBarChart(chart, data) {
        if (!chart || !data) return;
        chart.data.datasets[0].data = [data.daily, data.weekly, data.monthly];
        chart.update();
    }

    async function refreshTicketCountChart() {
        try {
            const data = await fetchTicketsByPeriod();
            lastTicketsData = data;
            updateTicketBarChart(ticketChart, data);
            return data;
        } catch (error) {
            console.error('tickets-by-period fetch error:', error);
            updateTicketBarChart(ticketChart, { daily: 0, weekly: 0, monthly: 0 });
            return { daily: 0, weekly: 0, monthly: 0 };
        }
    }

    function msUntilNextMidnight() {
        const now = new Date();
        const next = new Date(now);
        next.setHours(24, 0, 0, 0);
        return next - now;
    }

    function msUntilNextWeekStart() {
        const now = new Date();
        const day = now.getDay();
        const diff = ((8 - day) % 7) || 7; // Next Monday
        const next = new Date(now);
        next.setDate(now.getDate() + diff);
        next.setHours(0, 0, 0, 0);
        return next - now;
    }

    function msUntilNextMonthStart() {
        const now = new Date();
        const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        next.setHours(0, 0, 0, 0);
        return next - now;
    }

    function scheduleDailyTicketRefresh() {
        setTimeout(async () => {
            await refreshTicketCountChart();
            scheduleDailyTicketRefresh();
        }, msUntilNextMidnight());
    }

    function scheduleWeeklyTicketRefresh() {
        setTimeout(async () => {
            await refreshTicketCountChart();
            scheduleWeeklyTicketRefresh();
        }, msUntilNextWeekStart());
    }

    function scheduleMonthlyTicketRefresh() {
        setTimeout(async () => {
            await refreshTicketCountChart();
            scheduleMonthlyTicketRefresh();
        }, msUntilNextMonthStart());
    }

    // Fetch data for bar chart
    function buildQueryParams() {
        const params = new URLSearchParams();
        if (startDateInput && startDateInput.value) params.set('start', startDateInput.value);
        if (endDateInput && endDateInput.value) params.set('end', endDateInput.value);
        const branch = branchSelect ? branchSelect.value : 'all';
        if (branch && branch !== 'all') params.set('branch', branch);
        return params.toString() ? `?${params.toString()}` : '';
    }

    function handleAuthRedirect(res) {
        if (res.status === 401) {
            console.warn('Session expired or not logged in. Redirecting to login.');
            window.location.href = '/login.html';
            return res;
        }
        return res;
    }

    function fetchTicketsByPeriod() {
        const qp = buildQueryParams();
        return fetch('/api/tickets-by-period' + qp, { credentials: 'same-origin' })
            .then(handleAuthRedirect)
            .then(res => {
                if (!res.ok) return res.text().then(t => { throw new Error(t || 'tickets fetch failed'); });
                return res.json();
            });
    }

    // Fetch counts from server and render bar chart (fetchTicketsByPeriod already returns parsed JSON)
    if (barCtx) {
        ticketChart = createTicketBarChart(barCtx, { daily: 0, weekly: 0, monthly: 0 });
        refreshTicketCountChart();
        scheduleDailyTicketRefresh();
        scheduleWeeklyTicketRefresh();
        scheduleMonthlyTicketRefresh();
    } else {
        console.warn('Ticket bar chart canvas not found.');
    }
    messageChart = null; // created later after the function definition
    const aiStaffCtx = document.getElementById('aiStaffMonthlyChart') ? document.getElementById('aiStaffMonthlyChart').getContext('2d') : null;
    let aiStaffChart = null;

    let socket = null;
    try {
        if (typeof io !== 'undefined') {
            socket = io();
        }
    } catch (e) {
        socket = null;
    }

    // Fetch live data and render the 3D pie chart
    function create3DPieChart(ctx, data) {
        const colors = [
            ctx.createRadialGradient(200, 200, 50, 200, 200, 200),
            ctx.createRadialGradient(200, 200, 50, 200, 200, 200),
            ctx.createRadialGradient(200, 200, 50, 200, 200, 200),
            ctx.createRadialGradient(200, 200, 50, 200, 200, 200),
            ctx.createRadialGradient(200, 200, 50, 200, 200, 200),
            ctx.createRadialGradient(200, 200, 50, 200, 200, 200),
            ctx.createRadialGradient(200, 200, 50, 200, 200, 200)
        ];
        colors[0].addColorStop(0, '#00bcd4'); colors[0].addColorStop(1, '#006064');
        colors[1].addColorStop(0, '#ffeb3b'); colors[1].addColorStop(1, '#f57c00');
        colors[2].addColorStop(0, '#2196f3'); colors[2].addColorStop(1, '#0d47a1');
        colors[3].addColorStop(0, '#f44336'); colors[3].addColorStop(1, '#b71c1c');
        colors[4].addColorStop(0, '#9c27b0'); colors[4].addColorStop(1, '#4a148c');
        colors[5].addColorStop(0, '#5ce460'); colors[5].addColorStop(1, '#1b5e20');
        colors[6].addColorStop(0, '#ff9800'); colors[6].addColorStop(1, '#e65100');

        return new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Chats', 'Escalated Chats', 'Tickets', 'Escalated Tickets', 'Receipts', 'Resolved Chats'],
                datasets: [{
                    label: 'Overview',
                    data: [
                        data.numChats,
                        data.numEscalatedChats,
                        data.numTickets,
                        data.numEscalatedTickets,
                        data.numReceipts,
                        data.numResolvedChats
                    ],
                    backgroundColor: colors,
                    borderColor: [
                        '#0097a7', '#ff9800', '#1976d2', '#d32f2f', '#7b1fa2', '#5CE460', '#ef6c00'
                    ],
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#2c2c2c',
                            font: {
                                size: 14,
                                weight: 'bold'
                            },
                            padding: 20
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw;
                                return `${label}: ${value}`;
                            }
                        }
                    }
                },
                animation: {
                    animateScale: true,
                    animateRotate: true
                }
            },
            plugins: [{
                id: 'shadow',
                beforeDraw: chart => {
                    const ctx = chart.ctx;
                    ctx.save();
                    ctx.shadowColor = 'rgba(0,0,0,0.4)';
                    ctx.shadowBlur = 24;
                    ctx.shadowOffsetX = 10;
                    ctx.shadowOffsetY = 10;
                },
                afterDraw: chart => {
                    chart.ctx.restore();
                }
            }]
        });
    }

    // Small Chart.js plugin to draw center text inside semi-circle gauges
    const centerTextPlugin = {
        id: 'centerText',
        beforeDraw: chart => {
            const txt = chart.config.options && chart.config.options.plugins && chart.config.options.plugins.centerText && chart.config.options.plugins.centerText.text;
            if (!txt) return;
            const ctx = chart.ctx;
            const width = chart.width;
            const height = chart.height;
            ctx.save();
            ctx.font = '600 18px Arial';
            ctx.fillStyle = '#222';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(txt, width / 2, height * 0.62);
            ctx.restore();
        }
    };

    // Needle plugin draws a needle over the semi-circle doughnut
    const needlePlugin = {
        id: 'needle',
        afterDraw: chart => {
            try {
                const meta = chart.getDatasetMeta(0);
                if (!meta || !meta.data || !meta.data[0]) return;
                const ctx = chart.ctx;
                const cfg = (chart.options && chart.options.plugins && chart.options.plugins.needle) || {};
                const centerX = chart.width / 2;
                const centerY = meta.data[0].y;
                const outerRadius = meta.data[0].outerRadius || Math.min(chart.width, chart.height) / 2;
                const dataset = chart.data.datasets[0];
                const value = Number(dataset.data[0] || 0);
                const max = Number((dataset.data[0] || 0) + (dataset.data[1] || 0)) || 1;
                const rotation = chart.options.rotation || -Math.PI;
                const circumference = chart.options.circumference || Math.PI;
                const angle = rotation + (value / Math.max(1, max)) * circumference;

                // needle length and drawing
                const len = outerRadius * 0.92;
                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.moveTo(0, -6);
                ctx.lineTo(len, 0);
                ctx.lineTo(0, 6);
                ctx.closePath();
                ctx.fillStyle = cfg.color || '#222';
                ctx.fill();
                ctx.restore();

                // draw center cap
                ctx.beginPath();
                ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
                ctx.fillStyle = cfg.centerColor || (cfg.color || '#222');
                ctx.fill();
            } catch (e) {
                // fail silently
            }
        }
    };

    function createGaugeChart(ctx, initialValue, maxValue, color, labelText, needleOpts) {
        if (!ctx || typeof Chart === 'undefined') return null;
        try { Chart.register && Chart.register(centerTextPlugin); } catch (e) {}
        try { Chart.register && Chart.register(needlePlugin); } catch (e) {}
        const val = Math.max(0, Math.min(initialValue, maxValue));
        return new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [val, Math.max(0, maxValue - val)],
                    backgroundColor: [color, '#e9ecef'],
                    borderWidth: 0
                }]
            },
            options: {
                rotation: -Math.PI,
                circumference: Math.PI,
                cutout: '70%',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false },
                    centerText: { text: labelText },
                    needle: Object.assign({ color: '#222', centerColor: '#222' }, needleOpts || {})
                }
            },
            plugins: [centerTextPlugin, needlePlugin]
        });
    }

    function updateGauge(chart, value, maxValue, displayText) {
        if (!chart) return;
        const v = Math.max(0, Math.min(value, maxValue));
        chart.data.datasets[0].data[0] = v;
        chart.data.datasets[0].data[1] = Math.max(0, maxValue - v);
        if (!chart.options.plugins) chart.options.plugins = {};
        chart.options.plugins.centerText = { text: displayText };
        chart.update();
    }

    // Fetch metrics for the logged-in user and update gauges
    async function refreshMyMetrics() {
        try {
            const res = await fetch('/api/my-metrics', { credentials: 'same-origin' });
            let data = null;

            if (res.ok) {
                data = await res.json();
            } else if (res.status === 404) {
                const fallback = await fetch('/api/analytics', { credentials: 'same-origin' });
                if (!fallback.ok) return;
                const analyticsData = await fallback.json();
                data = {
                    avgResponseSeconds: 0,
                    resolutionRate: analyticsData.numTickets ? analyticsData.numResolvedChats / analyticsData.numTickets : 0
                };
            } else {
                return;
            }

            const maxResp = 600;
            if (!gaugeRespChart && gaugeRespCtx) {
                gaugeRespChart = createGaugeChart(gaugeRespCtx, 0, maxResp, '#1e88e5', '—s', { color: '#1e88e5', centerColor: '#1e88e5' });
            }
            const avg = (data && typeof data.avgResponseSeconds === 'number') ? data.avgResponseSeconds : 0;
            const display = avg ? `${Math.round(avg)}s` : '—s';
            updateGauge(gaugeRespChart, avg || 0, maxResp, display);

            if (!gaugeResRateChart && gaugeResRateCtx) {
                gaugeResRateChart = createGaugeChart(gaugeResRateCtx, 0, 1, '#4caf50', '—%', { color: '#4caf50', centerColor: '#4caf50' });
            }
            const rate = (data && typeof data.resolutionRate === 'number') ? data.resolutionRate : 0;
            const rateDisplay = isFinite(rate) && rate !== null ? `${Math.round(rate * 100)}%` : '—%';
            updateGauge(gaugeResRateChart, rate || 0, 1, rateDisplay);
        } catch (e) {
            // ignore
        }
    }

    function updateAnalyticsChart(chart, data) {
        if (!chart) return;
        chart.data.datasets[0].data = [
            data.numChats,
            data.numEscalatedChats,
            data.numTickets,
            data.numEscalatedTickets,
            data.numReceipts,
            data.numResolvedChats
        ];
        chart.update();
    }

    function refreshAnalyticsChart() {
        if (!ctx5) {
            loadKPIs();
            return Promise.resolve();
        }

        const qp = buildQueryParams();
        return fetch('/api/analytics' + qp, { credentials: 'same-origin' })
            .then(handleAuthRedirect)
            .then(res => {
                if (!res.ok) return res.text().then(t => { throw new Error(t || 'analytics fetch failed'); });
                return res.json();
            })
            .then(data => {
                lastAnalyticsData = data;
                if (!analyticsChart) {
                    analyticsChart = create3DPieChart(ctx5, data);
                } else {
                    updateAnalyticsChart(analyticsChart, data);
                }
                loadKPIs();
            })
            .catch(() => {
                if (!analyticsChart && ctx5) {
                    analyticsChart = create3DPieChart(ctx5, {
                        numChats: 10,
                        numEscalatedChats: 8,
                        numTickets: 12,
                        numEscalatedTickets: 3,
                        numReceipts: 20,
                        numResolvedChats: 15
                    });
                }
                loadKPIs();
            });
    }

    async function initializeAnalyticsPage() {
        if (!analyticsChart && ctx5) {
            analyticsChart = create3DPieChart(ctx5, {
                numChats: 0,
                numEscalatedChats: 0,
                numTickets: 0,
                numEscalatedTickets: 0,
                numReceipts: 0,
                numResolvedChats: 0
            });
        }

        if (!messageChart && messageCtx) {
            messageChart = createMessageBarChart(messageCtx, { daily: 0, weekly: 0, monthly: 0 });
        }
        if (!outwardMessagesChart && outwardChartContainer) {
            outwardMessagesChart = createOutwardMessagesChart(outwardChartContainer, { daily: 0, weekly: 0, monthly: 0 });
        }
        if (!aiStaffChart && aiStaffCtx) {
            aiStaffChart = createAIStaffMonthlyChart(aiStaffCtx, [], [], []);
        }

        await Promise.allSettled([
            refreshAnalyticsChart(),
            refreshMessageChart(),
            refreshTicketCountChart(),
            refreshOutwardMessagesChart(),
            refreshAIStaffMonthlyChart()
        ]);
        loadKPIs();
    }

    initializeAnalyticsPage();

    // Function to create bar chart for message traffic
    function createMessageBarChart(ctx, data) {
        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Today', 'This Week', 'This Month'],
                datasets: [{
                    label: 'Messages Received',
                    data: [data.daily, data.weekly, data.monthly],
                    backgroundColor: [
                        '#4CAF50',
                        '#2196F3',
                        '#FF9800'
                    ],
                    borderColor: [
                        '#4CAF50',
                        '#2196F3',
                        '#FF9800'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    title: {
                        display: true,
                        text: 'Message Traffic by Period'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    function createOutwardMessagesChart(container, data) {
        const options = {
            chart: {
                type: 'bar',
                height: 240,
                toolbar: { show: false }
            },
            series: [{
                name: 'Outward Messages',
                data: [data.daily, data.weekly, data.monthly]
            }],
            colors: ['#465fff'],
            plotOptions: {
                bar: {
                    horizontal: false,
                    columnWidth: '55%',
                    borderRadius: 8,
                    borderRadiusApplication: 'end'
                }
            },
            dataLabels: { enabled: false },
            xaxis: {
                categories: ['Day', 'Week', 'Month'],
                axisBorder: { show: false },
                axisTicks: { show: false },
                labels: {
                    style: { colors: '#64748b', fontSize: '13px', fontWeight: 600 }
                }
            },
            yaxis: {
                labels: {
                    style: { colors: '#64748b', fontSize: '13px' }
                }
            },
            grid: {
                borderColor: 'rgba(148,163,184,0.18)',
                strokeDashArray: 5,
                yaxis: { lines: { show: true } }
            },
            legend: { show: false },
            tooltip: {
                theme: 'light',
                x: { show: false },
                y: {
                    formatter: function (val) {
                        return val;
                    }
                }
            }
        };

        const chart = new ApexCharts(container, options);
        chart.render();
        return chart;
    }

    function updateOutwardMessagesChart(chart, data) {
        if (!chart || !data) return;
        chart.updateSeries([{ data: [data.daily, data.weekly, data.monthly] }]);
    }

    async function refreshOutwardMessagesChart() {
        if (!outwardMessagesChart) return;
        try {
            const res = await fetch('/api/outward-messages-by-period' + buildQueryParams(), { credentials: 'same-origin' });
            handleAuthRedirect(res);
            if (!res.ok) {
                const body = await res.text();
                console.error('outward-messages-by-period fetch failed', res.status, body);
                throw new Error('Fetch failed');
            }
            const data = await res.json();
            updateOutwardMessagesChart(outwardMessagesChart, data);
            return data;
        } catch (error) {
            console.error('refreshOutwardMessagesChart error', error);
            if (outwardMessagesChart) {
                updateOutwardMessagesChart(outwardMessagesChart, { daily: 34, weekly: 182, monthly: 732 });
            }
            return { daily: 34, weekly: 182, monthly: 732 };
        }
    }

    function createAIStaffMonthlyChart(ctx, labels, aiData, staffData) {
        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'AI Messages',
                        data: aiData,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59,130,246,0.18)',
                        fill: true,
                        tension: 0.34,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: '#3b82f6',
                        pointRadius: 5,
                        pointHitRadius: 14,
                        pointHoverRadius: 10,
                        pointHoverBorderWidth: 3,
                        pointHoverBackgroundColor: '#3b82f6',
                        pointStyle: 'circle',
                        hoverBorderColor: '#3b82f6',
                        borderWidth: 3
                    },
                    {
                        label: 'Staff Messages',
                        data: staffData,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16,185,129,0.18)',
                        fill: true,
                        tension: 0.34,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: '#10b981',
                        pointRadius: 5,
                        pointHitRadius: 14,
                        pointHoverRadius: 10,
                        pointHoverBorderWidth: 3,
                        pointHoverBackgroundColor: '#10b981',
                        pointStyle: 'circle',
                        hoverBorderColor: '#10b981',
                        borderWidth: 3
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    title: {
                        display: true,
                        text: 'AI vs Staff Messages - Last 12 Months'
                    },
                    tooltip: {
                        enabled: true,
                        mode: 'index',
                        intersect: false,
                        position: 'nearest',
                        backgroundColor: 'rgba(255,255,255,0.98)',
                        borderColor: 'rgba(148,163,184,0.75)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 12,
                        caretSize: 8,
                        caretPadding: 10,
                        bodyColor: '#111',
                        titleColor: '#111',
                        titleFont: { weight: '600' },
                        displayColors: true,
                        usePointStyle: true,
                        bodySpacing: 8,
                        callbacks: {
                            title: function(context) {
                                return context[0] ? context[0].label : '';
                            },
                            label: function(context) {
                                return `${context.dataset.label}: ${context.formattedValue}`;
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false,
                    axis: 'x'
                },
                hover: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#333' }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#333' },
                        grid: {
                            color: 'rgba(148,163,184,0.18)',
                            borderDash: [4, 4]
                        }
                    }
                }
            },
            plugins: [
                {
                    id: 'verticalHoverLine',
                    afterDraw: function(chart) {
                        if (chart.tooltip && chart.tooltip.opacity === 1) {
                            const ctx = chart.ctx;
                            const x = chart.tooltip.caretX;
                            const top = chart.scales.y.top;
                            const bottom = chart.scales.y.bottom;
                            ctx.save();
                            ctx.beginPath();
                            ctx.setLineDash([4, 4]);
                            ctx.strokeStyle = 'rgba(148,163,184,0.85)';
                            ctx.lineWidth = 1;
                            ctx.moveTo(x, top);
                            ctx.lineTo(x, bottom);
                            ctx.stroke();
                            ctx.restore();
                        }
                    }
                }
            ]
        });
    }

    function normalizeMonthlyLabels(labels, aiData, staffData) {
        const monthOrder = {
            Jan: 0, Feb: 1, Mar: 2, Apr: 3,
            May: 4, Jun: 5, Jul: 6, Aug: 7,
            Sep: 8, Oct: 9, Nov: 10, Dec: 11
        };
        const items = (labels || []).map((label, index) => {
            const key = String(label || '').slice(0, 3);
            const order = monthOrder[key];
            return {
                label: label || '',
                ai: aiData[index] != null ? aiData[index] : 0,
                staff: staffData[index] != null ? staffData[index] : 0,
                order: typeof order === 'number' ? order : 999
            };
        });
        items.sort((a, b) => a.order - b.order);
        return {
            labels: items.map(item => item.label),
            ai: items.map(item => item.ai),
            staff: items.map(item => item.staff)
        };
    }

    function updateAIStaffMonthlyChart(chart, labels, aiData, staffData) {
        if (!chart) return;
        const normalized = normalizeMonthlyLabels(labels, aiData, staffData);
        chart.data.labels = normalized.labels;
        chart.data.datasets[0].data = normalized.ai;
        chart.data.datasets[1].data = normalized.staff;
        chart.update();
    }

    function updateMessageChart(chart, data) {
        if (!chart) return;
        chart.data.datasets[0].data = [data.daily, data.weekly, data.monthly];
        chart.update();
    }

    async function refreshMessageChart() {
        try {
            const res = await fetch('/api/messages-by-period' + buildQueryParams(), { credentials: 'same-origin' });
            handleAuthRedirect(res);
            if (!res.ok) {
                const body = await res.text();
                console.error('messages-by-period fetch failed', res.status, body);
                throw new Error('Fetch failed');
            }
            const data = await res.json();
            lastMessagesData = data;
            if (!messageChart) {
                messageChart = createMessageBarChart(messageCtx, data);
            } else {
                updateMessageChart(messageChart, data);
            }
            return data;
        } catch (error) {
            console.error('refreshMessageChart error', error);
            if (!messageChart) {
                messageChart = createMessageBarChart(messageCtx, {
                    daily: 50,
                    weekly: 300,
                    monthly: 1200
                });
            }
            return { daily: 50, weekly: 300, monthly: 1200 };
        }
    }

    async function refreshAIStaffMonthlyChart() {
        try {
            const res = await fetch('/api/messages-monthly', { credentials: 'same-origin' });
            handleAuthRedirect(res);
            if (!res.ok) {
                const body = await res.text();
                console.error('messages-monthly fetch failed', res.status, body);
                throw new Error('Fetch failed');
            }
            const data = await res.json();
            const normalized = normalizeMonthlyLabels(data.labels || [], data.ai || [], data.staff || []);
            if (!aiStaffChart) {
                aiStaffChart = createAIStaffMonthlyChart(aiStaffCtx, normalized.labels, normalized.ai, normalized.staff);
            } else {
                updateAIStaffMonthlyChart(aiStaffChart, normalized.labels, normalized.ai, normalized.staff);
            }
            return data;
        } catch (error) {
            console.error('refreshAIStaffMonthlyChart error', error);
            const placeholderLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            const placeholderAi = [10, 18, 22, 20, 25, 32, 28, 30, 35, 40, 42, 38];
            const placeholderStaff = [25, 28, 32, 30, 34, 38, 40, 45, 50, 55, 52, 48];
            if (!aiStaffChart) {
                aiStaffChart = createAIStaffMonthlyChart(aiStaffCtx, placeholderLabels, placeholderAi, placeholderStaff);
            }
            return { labels: placeholderLabels, ai: placeholderAi, staff: placeholderStaff };
        }
    }

    function msUntilNextMidnight() {
        const now = new Date();
        const nextMidnight = new Date(now);
        nextMidnight.setHours(24, 0, 0, 0);
        return nextMidnight - now;
    }

    function msUntilNextWeek() {
        const now = new Date();
        const nextWeek = new Date(now);
        const dayOfWeek = nextWeek.getDay();
        const daysUntilMonday = ((8 - dayOfWeek) % 7) || 7;
        nextWeek.setDate(nextWeek.getDate() + daysUntilMonday);
        nextWeek.setHours(0, 0, 0, 0);
        return nextWeek - now;
    }

    function msUntilNextMonth() {
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        nextMonth.setHours(0, 0, 0, 0);
        return nextMonth - now;
    }

    function scheduleDailyMessageRefresh() {
        setTimeout(() => {
            refreshMessageChart();
            scheduleDailyMessageRefresh();
        }, msUntilNextMidnight());
    }

    function scheduleWeeklyMessageRefresh() {
        setTimeout(() => {
            refreshMessageChart();
            scheduleWeeklyMessageRefresh();
        }, msUntilNextWeek());
    }

    function scheduleMonthlyMessageRefresh() {
        setTimeout(() => {
            refreshMessageChart();
            scheduleMonthlyMessageRefresh();
        }, msUntilNextMonth());
    }

    /*refreshMessageChart();
    scheduleDailyMessageRefresh();
    scheduleWeeklyMessageRefresh();
    scheduleMonthlyMessageRefresh();
    setInterval(refreshMessageChart, 10000);*/

    // Initialize default date range (last 30 days)
    (function initDefaultDates() {
        try {
            const today = new Date();
            const prior = new Date();
            prior.setDate(today.getDate() - 30);
            if (startDateInput) startDateInput.value = prior.toISOString().slice(0,10);
            if (endDateInput) endDateInput.value = today.toISOString().slice(0,10);
        } catch (e) {}
    })();

    // Load KPI summary cards using last fetched datasets where possible
    function loadKPIs() {
        // total tickets
        let totalTickets = '—';
        if (lastAnalyticsData && typeof lastAnalyticsData.numTickets === 'number') {
            totalTickets = lastAnalyticsData.numTickets;
        } else if (lastTicketsData && typeof lastTicketsData.monthly === 'number') {
            totalTickets = lastTicketsData.monthly;
        }
        if (kpiTotalTickets) kpiTotalTickets.textContent = totalTickets;

        // avg response
        let avgResp = '—';
        if (lastAnalyticsData && typeof lastAnalyticsData.avgResponseSeconds === 'number') {
            avgResp = Math.round(lastAnalyticsData.avgResponseSeconds);
        }
        if (kpiAvgResponse) kpiAvgResponse.textContent = avgResp;

        // resolution time
        let resolutionTime = '—';
        if (lastAnalyticsData && typeof lastAnalyticsData.avgResolutionSeconds === 'number') {
            resolutionTime = Math.round(lastAnalyticsData.avgResolutionSeconds);
        }
        if (kpiResolutionTime) kpiResolutionTime.textContent = resolutionTime;

        // active chats
        let active = '—';
        if (lastAnalyticsData && typeof lastAnalyticsData.activeChats === 'number') {
            active = lastAnalyticsData.activeChats;
        } else if (lastAnalyticsData && typeof lastAnalyticsData.numChats === 'number') {
            active = lastAnalyticsData.numChats;
        }
        if (kpiActiveChats) kpiActiveChats.textContent = active;
        // AI feedback KPIs
        if (kpiAIFeedbackAvg) {
            const avg = lastAnalyticsData && typeof lastAnalyticsData.aiFeedbackAvg === 'number' ? Number(lastAnalyticsData.aiFeedbackAvg).toFixed(2) : '—';
            kpiAIFeedbackAvg.textContent = avg;
        }
        if (kpiAIFeedbackCount) {
            const cnt = lastAnalyticsData && typeof lastAnalyticsData.aiFeedbackCount === 'number' ? lastAnalyticsData.aiFeedbackCount : '—';
            kpiAIFeedbackCount.textContent = cnt;
        }

        // Initialize gauges if needed and update them
        try {
            // Average response gauge (max in seconds)
            const maxResp = 600; // 10 minutes cap for visualization
            if (!gaugeRespChart && gaugeRespCtx) {
                gaugeRespChart = createGaugeChart(gaugeRespCtx, 0, maxResp, '#1e88e5', '—s');
            }
            let avgRespVal = 0;
            if (lastAnalyticsData && typeof lastAnalyticsData.avgResponseSeconds === 'number') avgRespVal = lastAnalyticsData.avgResponseSeconds;
            else if (lastTicketsData && typeof lastTicketsData.avgResponseSeconds === 'number') avgRespVal = lastTicketsData.avgResponseSeconds;
            const avgRespDisplay = avgRespVal ? `${Math.round(avgRespVal)}s` : '—s';
            updateGauge(gaugeRespChart, avgRespVal || 0, maxResp, avgRespDisplay);

            // Resolution rate gauge (0.0 - 1.0)
            if (!gaugeResRateChart && gaugeResRateCtx) {
                gaugeResRateChart = createGaugeChart(gaugeResRateCtx, 0, 1, '#4caf50', '—%');
            }
            let resRateVal = 0;
            if (lastAnalyticsData && typeof lastAnalyticsData.resolutionRate === 'number') {
                resRateVal = lastAnalyticsData.resolutionRate;
            } else if (lastAnalyticsData && lastAnalyticsData.numTickets && lastAnalyticsData.numResolvedChats) {
                resRateVal = (lastAnalyticsData.numResolvedChats / Math.max(1, lastAnalyticsData.numTickets));
            }
            const resRateDisplay = isFinite(resRateVal) ? `${Math.round(resRateVal * 100)}%` : '—%';
            updateGauge(gaugeResRateChart, resRateVal || 0, 1, resRateDisplay);
        } catch (e) {
            console.warn('Gauge update failed', e);
        }
    }

    // Wire up filter apply button
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', async () => {
            try {
                const [tix] = await Promise.all([fetchTicketsByPeriod()]);
                lastTicketsData = tix;
            } catch (e) {
                console.warn('tickets fetch for filters failed', e);
            }
            refreshAnalyticsChart();
            refreshMessageChart();
        });
    }

    // CSV export
    function exportCsv() {
        const rows = [];
        rows.push(['metric','value']);
        if (lastAnalyticsData) {
            Object.keys(lastAnalyticsData).forEach(k => rows.push([k, JSON.stringify(lastAnalyticsData[k])]));
        }
        if (lastTicketsData) {
            Object.keys(lastTicketsData).forEach(k => rows.push([`tickets_${k}`, lastTicketsData[k]]));
        }
        if (lastMessagesData) {
            Object.keys(lastMessagesData).forEach(k => rows.push([`messages_${k}`, lastMessagesData[k]]));
        }
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-export-${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportCsv);

    // initial KPI load
    loadKPIs();

    // load user-specific metrics and refresh periodically
    refreshMyMetrics();
    setInterval(refreshMyMetrics, 15000);

    socket.on('newMessage', msg => {
        if (msg.sender === 'customer' || msg.sender === 'received') {
            refreshMessageChart();
        }
    });

    socket.on('ticketCreated', refreshAnalyticsChart);
    socket.on('ticketDeleted', refreshAnalyticsChart);
    socket.on('ticketEscalated', refreshAnalyticsChart);
    socket.on('receiptCreated', refreshAnalyticsChart);
    socket.on('receiptDeleted', refreshAnalyticsChart);
    socket.on('connect', () => {
        refreshAnalyticsChart();
        refreshMessageChart();
    });

});