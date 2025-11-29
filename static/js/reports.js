document.addEventListener("DOMContentLoaded", () => {
    setDefaultDates();
    loadReportsFromAPI();
});

async function loadReportsFromAPI() {
    try {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        
        const params = new URLSearchParams();
        if (startDate) params.append('fromDate', startDate);
        if (endDate) params.append('toDate', endDate);
        
        console.log("[v0] Fetching reports with params:", params.toString());
        const response = await fetch(`/api/reports/advanced?${params.toString()}`);
        const data = await response.json();
        
        console.log("[v0] Reports API response:", data);
        
        if (data.success) {
            updateAllReports(data);
        } else {
            console.error("[v0] Reports API error:", data.error);
        }
    } catch (error) {
        console.error('[v0] Error loading reports:', error);
    }
}

function updateAllReports(data) {
    console.log("[v0] Updating all reports with data");
    
    // Update quick stats
    if (data.quickStats) {
        updateQuickStats(data.quickStats);
    }
    
    // Update listings analysis
    if (data.monthlyMetrics) {
        updateListingsAnalysis(data.monthlyMetrics);
    }
    
    // Update lead performance
    if (data.sourcePerformance && data.priorityInsights) {
        updateLeadPerformance(data.sourcePerformance, data.priorityInsights);
    }
    
    // Update conversion funnel
    if (data.funnelAnalysis) {
        updateConversionFunnel(data.funnelAnalysis);
    }
    
    // Update time analysis
    if (data.timeAnalytics) {
        updateTimeAnalysis(data.timeAnalytics);
    }
    
    // Update executive summary
    if (data.executiveSummary) {
        updateExecutiveSummary(data.executiveSummary);
    }
    
    if (data.topOpportunities) {
        updateTopOpportunities(data.topOpportunities);
    }
}

function updateQuickStats(stats) {
    console.log("[v0] Updating quick stats:", stats);
    
    const statElements = {
        'statActiveListings': stats.activeListings,
        'statPipelineValue': formatINRCurrency(stats.pipelineValue),
        'statSoldThisMonth': stats.soldThisMonth,
        'statAvgDOM': stats.avgDOM + ' days'
    };
    
    for (const [elementId, value] of Object.entries(statElements)) {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = value;
            console.log(`[v0] Updated ${elementId} to ${value}`);
        } else {
            console.warn(`[v0] Element ${elementId} not found in HTML`);
        }
    }
}

function updateListingsAnalysis(metrics) {
    console.log("[v0] Updating listings analysis:", metrics);
    
    // Update monthly chart if canvas exists
    const canvasId = 'listingsChart';
    const canvas = document.getElementById(canvasId);
    if (canvas && metrics.months && metrics.months.length > 0) {
        const chartData = metrics.months.map(m => ({month: m.month, count: m.closed}));
        renderBarChart(canvasId, chartData, 'Closed Listings', '#4facfe', '#43e97b');
    } else {
        console.warn(`[v0] Canvas ${canvasId} not found or no data`);
    }
    
    // Update metric cards
    const metricElements = {
        'currentMonthClosed': metrics.currentMonthClosed,
        'lastMonthClosed': metrics.lastMonthClosed,
        'ytdClosed': metrics.ytdClosed,
        'projectedClosings': metrics.projectedClosings
    };
    
    for (const [elementId, value] of Object.entries(metricElements)) {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = value;
        } else {
            console.warn(`[v0] Metric element ${elementId} not found`);
        }
    }
}

function updateLeadPerformance(sourceData, priorityInsights) {
    console.log("[v0] Updating lead performance - sources:", sourceData, "priorities:", priorityInsights);
    
    // Render source performance table
    const sourceTableBody = document.getElementById('sourcePerformanceTable');
    if (sourceTableBody) {
        sourceTableBody.innerHTML = '';
        
        sourceData.forEach(source => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${source.source || 'Unknown'}</td>
                <td>${source.total_leads || 0}</td>
                <td>${source.converted || 0}</td>
                <td>${((source.conversion_rate) || 0).toFixed(1)}%</td>
                <td>${formatINRCurrency(source.revenue_generated || 0)}</td>
                <td>${formatINRCurrency(source.avg_deal_value || 0)}</td>
            `;
            sourceTableBody.appendChild(row);
        });
        console.log(`[v0] Updated ${sourceData.length} source rows`);
    } else {
        console.warn('[v0] Source performance table not found');
    }
    
    // Update priority insights
    const priorityElements = {
        'hotLeadsCount': priorityInsights.hot.count,
        'hotLeadsRevenue': formatINRCurrency(priorityInsights.hot.value),
        'warmLeadsCount': priorityInsights.warm.count,
        'warmLeadsRevenue': formatINRCurrency(priorityInsights.warm.value),
        'coldLeadsCount': priorityInsights.cold.count,
        'coldLeadsRevenue': formatINRCurrency(priorityInsights.cold.value)
    };
    
    for (const [elementId, value] of Object.entries(priorityElements)) {
        const el = document.getElementById(elementId);
        if (el) {
            el.textContent = value;
        } else {
            console.warn(`[v0] Priority element ${elementId} not found`);
        }
    }
    
    const total = priorityInsights.hot.count + priorityInsights.warm.count + priorityInsights.cold.count || 1;
    
    const progressBars = {
        'hotLeadsBar': (priorityInsights.hot.count / total) * 100,
        'warmLeadsBar': (priorityInsights.warm.count / total) * 100,
        'coldLeadsBar': (priorityInsights.cold.count / total) * 100
    };
    
    for (const [barId, percentage] of Object.entries(progressBars)) {
        const bar = document.getElementById(barId);
        if (bar) {
            bar.style.width = percentage + '%';
        }
    }
}

function updateConversionFunnel(funnelData) {
    console.log("[v0] Updating conversion funnel:", funnelData);
    
    // Render funnel analysis table
    const funnelTableBody = document.getElementById('funnelAnalysisTable');
    if (funnelTableBody) {
        funnelTableBody.innerHTML = '';
        
        funnelData.forEach(stage => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${stage.stage || 'Unknown'}</td>
                <td>${stage.total_deals || 0}</td>
                <td>${formatINRCurrency(stage.total_value || 0)}</td>
                <td>${((stage.conversion_rate) || 0).toFixed(1)}%</td>
                <td>${((stage.dropoff_rate) || 0).toFixed(1)}%</td>
                <td>${stage.avg_time_in_stage || 0} days</td>
            `;
            funnelTableBody.appendChild(row);
        });
        console.log(`[v0] Updated ${funnelData.length} funnel rows`);
    } else {
        console.warn('[v0] Funnel analysis table not found');
    }
    
    // Render funnel visualization
    renderFunnelVisualization(funnelData);
}

function renderFunnelVisualization(data) {
    const container = document.getElementById('conversionFunnel');
    if (!container) {
        console.warn('[v0] Conversion funnel container not found');
        return;
    }
    
    container.innerHTML = '';
    
    const containerWidth = container.offsetWidth || 600;
    const maxValue = Math.max(...data.map(d => d.total_deals || 0), 1);
    const minWidth = 1100; // Minimum width to ensure text is visible
    
    data.forEach((stage, index) => {
        const percentage = ((stage.total_deals || 0) / maxValue) * 100;
        const width = Math.max((percentage / 100) * containerWidth, minWidth);
        
        const funnelSegment = document.createElement('div');
        funnelSegment.className = 'funnel-stage';
        funnelSegment.style.display = 'flex';
        funnelSegment.style.justifyContent = 'center';
        
        const bar = document.createElement('div');
        bar.className = 'funnel-bar';
        bar.style.width = width + 'px';
        bar.style.padding = '1.5rem 2rem';
        bar.style.margin = '0.5rem auto';
        bar.style.backgroundColor = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a'][index % 5];
        bar.style.color = 'white';
        bar.style.borderRadius = '0.5rem';
        bar.style.textAlign = 'center';
        bar.style.fontSize = '1rem';
        bar.style.fontWeight = '600';
        bar.style.whiteSpace = 'nowrap';
        bar.style.overflow = 'hidden';
        bar.style.textOverflow = 'ellipsis';
        bar.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
        bar.style.transition = 'all 0.3s';
        
        const conversionRate = ((stage.conversion_rate) || 0).toFixed(1);
        bar.textContent = `${stage.stage || 'Unknown'}: ${stage.total_deals || 0} (${conversionRate}%)`;
        
        bar.addEventListener('mouseenter', () => {
            bar.style.transform = 'translateX(8px)';
            bar.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
        });
        
        bar.addEventListener('mouseleave', () => {
            bar.style.transform = 'translateX(0)';
            bar.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
        });
        
        funnelSegment.appendChild(bar);
        container.appendChild(funnelSegment);
    });
    
    console.log(`[v0] Rendered funnel visualization with ${data.length} stages`);
}

function updateTimeAnalysis(timeData) {
    console.log("[v0] Updating time analysis:", timeData);
    
    // Leads by day of week
    if (timeData.leadsByDay) {
        const dayLabels = Object.keys(timeData.leadsByDay);
        const dayValues = Object.values(timeData.leadsByDay);
        const dayChartData = dayLabels.map((label, i) => ({month: label, count: dayValues[i]}));
        renderBarChart('dayOfWeekChart', dayChartData, 'Leads', '#667eea', '#764ba2');
    }
    
    // Deals closed by month
    if (timeData.dealsByMonth) {
        const monthLabels = Object.keys(timeData.dealsByMonth);
        const monthValues = Object.values(timeData.dealsByMonth);
        const monthChartData = monthLabels.map((label, i) => ({month: label, count: monthValues[i]}));
        renderBarChart('monthlyDealsChart', monthChartData, 'Deals', '#43e97b', '#38f9d7');
    }
}

function updateExecutiveSummary(summary) {
    console.log("[v0] Updating executive summary:", summary);
    
    // Performance Highlights
    const highlightsUl = document.getElementById('performanceHighlights');
    if (highlightsUl) {
        highlightsUl.innerHTML = (summary.highlights || []).map(h => `<li>${h}</li>`).join('');
    }
    
    // Areas for Improvement
    const improvementUl = document.getElementById('improvementAreas');
    if (improvementUl) {
        improvementUl.innerHTML = (summary.improvements || []).map(i => `<li>${i}</li>`).join('');
    }
    
    // Recommendations
    const recommendationsUl = document.getElementById('recommendations');
    if (recommendationsUl) {
        recommendationsUl.innerHTML = (summary.recommendations || []).map(r => `<li>${r}</li>`).join('');
    }
}

function updateTopOpportunities(opportunities) {
    console.log("[v0] Updating top opportunities:", opportunities);
    
    const opportunitiesContainer = document.getElementById('topOpportunitiesTable');
    if (!opportunitiesContainer) {
        console.warn('[v0] Top opportunities table not found');
        return;
    }
    
    opportunitiesContainer.innerHTML = '';
    
    opportunities.forEach(opp => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${opp.name || 'Unknown'}</td>
            <td>${opp.company || 'N/A'}</td>
            <td>${formatINRCurrency(opp.value || 0)}</td>
            <td>${opp.stage || 'Unknown'}</td>
            <td>${opp.priority || 'Medium'}</td>
            <td>${opp.age_days || 0}</td>
            <td>${opp.win_probability || 0}%</td>
        `;
        opportunitiesContainer.appendChild(row);
    });
    
    console.log(`[v0] Updated ${opportunities.length} opportunities`);
}

function setDefaultDates() {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    document.getElementById('startDate').value = formatDateInput(thirtyDaysAgo);
    document.getElementById('endDate').value = formatDateInput(today);
}

function formatDateInput(date) {
    return date.toISOString().split('T')[0];
}

function formatINRCurrency(amount) {
    if (!amount || amount === 0) return '₹0';
    try {
        return new Intl.NumberFormat('en-IN', { 
            style: 'currency', 
            currency: 'INR', 
            maximumFractionDigits: 0 
        }).format(parseFloat(amount));
    } catch (e) {
        return '₹' + Math.round(parseFloat(amount));
    }
}

function renderBarChart(canvasId, data, label, colorStart, colorEnd) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !data || !data.length) {
        console.warn(`[v0] Canvas ${canvasId} not found or no data provided`);
        return;
    }
    
    const ctx = canvas.getContext('2d');

    const width = canvas.parentElement?.offsetWidth || 600;
    const height = 300;
    canvas.width = width;
    canvas.height = height;

    const padding = 80; // Increased bottom padding for labels
    const topPadding = 20;
    const chartWidth = width - padding * 1.5;
    const chartHeight = height - padding - topPadding;
    const barWidth = Math.max(chartWidth / data.length, 30);

    ctx.clearRect(0, 0, width, height);

    const maxValue = Math.max(...data.map(d => isFinite(d.count) ? d.count : 0), 1);

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
        const y = topPadding + (chartHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(50, y);
        ctx.lineTo(width - 20, y);
        ctx.stroke();
    }

    data.forEach((item, index) => {
        const barHeight = ((item.count || 0) / maxValue) * chartHeight;
        const x = 50 + index * barWidth;
        const y = topPadding + chartHeight - barHeight;

        const gradient = ctx.createLinearGradient(x, y, x, topPadding + chartHeight);
        gradient.addColorStop(0, colorStart);
        gradient.addColorStop(1, colorEnd);

        ctx.fillStyle = gradient;
        ctx.fillRect(x + 4, y, barWidth - 8, barHeight);

        ctx.fillStyle = '#64748b';
        ctx.font = '11px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.save();
        ctx.translate(x + barWidth / 2, height - padding + 30);
        ctx.rotate(-Math.PI / 4); // Rotate labels 45 degrees to prevent overlap
        ctx.fillText((item.month || '').substring(0, 10), 0, 0);
        ctx.restore();

        if (item.count > 0) {
            ctx.fillStyle = '#1e293b';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(item.count, x + barWidth / 2, y - 10);
        }
    });
    
    console.log(`[v0] Rendered chart ${canvasId} with ${data.length} data points`);
}

function printReport() {
    window.print();
}

function exportAllReports() {
    alert('Export functionality will export all report data as CSV/PDF');
}

function exportSection(section) {
    alert(`Exporting ${section} section...`);
}

function changeReportType() {
    loadReportsFromAPI();
}

document.addEventListener('DOMContentLoaded', () => {
    const startDateEl = document.getElementById('startDate');
    const endDateEl = document.getElementById('endDate');
    const reportTypeEl = document.getElementById('reportType');
    
    if (startDateEl) startDateEl.addEventListener('change', loadReportsFromAPI);
    if (endDateEl) endDateEl.addEventListener('change', loadReportsFromAPI);
    if (reportTypeEl) reportTypeEl.addEventListener('change', changeReportType);
});
