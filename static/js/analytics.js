// --- Globals ---
let conversionsChart, callsChart, sourceChart, followupChart;
let allLeads = [];
let dashboardData = null;
let refreshTimeout; // Track refresh timeout for optimization

// --- Helper function to determine follow-up status and color ---
function getFollowupStatus(nextFollowupDate) {
    if (!nextFollowupDate) return { status: 'no-action', label: 'No Action', color: '#808080' };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextDate = new Date(nextFollowupDate);
    nextDate.setHours(0, 0, 0, 0);
    
    const diffTime = nextDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
        return { status: 'overdue', label: `Overdue by ${Math.abs(diffDays)} days`, color: '#FF0000' };
    } else if (diffDays === 0) {
        return { status: 'today', label: 'Due Today', color: '#FFA500' };
    } else if (diffDays <= 3) {
        return { status: 'pending', label: `Due in ${diffDays} days`, color: '#FFA500' };
    } else {
        return { status: 'scheduled', label: 'Scheduled', color: '#4CAF50' };
    }
}

// --- Format date with time info ---
function formatDateWithInfo(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return `Today - ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
        return `Yesterday - ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
}

// --- API Call to fetch analytics data ---
async function fetchAnalyticsData() {
    try {
        const startTime = performance.now();
        
        const fromDate = document.getElementById('fromDate').value;
        const toDate = document.getElementById('toDate').value;
        const source = document.getElementById('sourceFilter').value;
        
        let url = '/api/analytics/dashboard?';
        if (fromDate) url += `fromDate=${fromDate}&`;
        if (toDate) url += `toDate=${toDate}&`;
        if (source && source !== 'all') url += `source=${source}&`;
        
        const res = await fetch(url);
        const data = await res.json();
        
        const loadTime = performance.now() - startTime;
        console.log(`[v0] Analytics data loaded in ${loadTime.toFixed(0)}ms`);
        
        if (data.success) {
            dashboardData = data;
            updateAllVisuals();
        } else {
            console.error("API Error:", data.error);
            showToast("Error loading analytics data");
        }
    } catch (err) {
        console.error("Failed to fetch analytics:", err);
        showToast("Failed to load analytics data");
    }
}

// --- Update all visual elements ---
function updateAllVisuals() {
    if (!dashboardData) return;
    
    updateKPIs();
    updateFollowupTable();
    updateTeamTable();
    updateCharts();
}

// --- Update KPIs ---
function updateKPIs() {
    const kpis = dashboardData.kpis;
    document.getElementById('kpiTotalLeads').textContent = kpis.totalLeads || 0;
    document.getElementById('kpiContacted').textContent = kpis.leadsContacted || 0;
    document.getElementById('kpiConverted').textContent = kpis.leadsConverted || 0;
    document.getElementById('kpiMissed').textContent = kpis.missedFollowups || 0;
    document.getElementById('kpiCalls').textContent = kpis.totalCalls || 0;
}

// --- Update Follow-up Table ---
function updateFollowupTable() {
    const tbody = document.getElementById('followupTableBody');
    tbody.innerHTML = '';
    
    const followupData = dashboardData.followupTracker || [];
    if (followupData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No follow-ups pending</td></tr>';
        return;
    }
    
    followupData.forEach(lead => {
        const tr = document.createElement('tr');
        
        const followupStatus = getFollowupStatus(lead.nextFollowup);
        const lastCallFormatted = formatDateWithInfo(lead.lastCallDate);
        const nextFollowupFormatted = formatDateWithInfo(lead.nextFollowup);
        
        tr.innerHTML = `
            <td><strong>${escapeHtml(lead.name)}</strong></td>
            <td>${lastCallFormatted}</td>
            <td>
                <span style="
                    display: inline-block;
                    padding: 6px 12px;
                    border-radius: 4px;
                    background-color: ${followupStatus.color}20;
                    color: ${followupStatus.color};
                    font-weight: 500;
                    font-size: 12px;
                ">
                    ${nextFollowupFormatted}
                </span>
                <div style="font-size: 11px; color: #666; margin-top: 2px;">${followupStatus.label}</div>
            </td>
            <td>
                <span style="
                    display: inline-block;
                    padding: 4px 8px;
                    border-radius: 3px;
                    background-color: #E3F2FD;
                    color: #1976D2;
                    font-size: 12px;
                ">
                    ${escapeHtml(lead.status || '-')}
                </span>
            </td>
            <td>${escapeHtml(lead.assignedTo || 'Unassigned')}</td>
            <td><button class="btn-view" onclick="showLeadModal('${lead.id}')">View</button></td>
        `;
        tbody.appendChild(tr);
    });
}

// --- Update Team Performance Table ---
function updateTeamTable() {
    const tbody = document.getElementById('teamTableBody');
    tbody.innerHTML = '';
    
    const teamData = dashboardData.teamPerformance || [];
    if (teamData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">No team data available</td></tr>';
        return;
    }
    
    teamData.forEach(member => {
        const tr = document.createElement('tr');
        const conversionRate = member.conversionRate ? member.conversionRate.toFixed(1) : 0;
        tr.innerHTML = `
            <td>${escapeHtml(member.member)}</td>
            <td>${member.calls}</td>
            <td>${member.conversions}</td>
            <td>${conversionRate}%</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- Update Charts ---
function updateCharts() {
    // Lead Conversions (daily)
    const conversionData = dashboardData.conversionsByDay || {};
    const convLabels = Object.keys(conversionData).sort();
    const convValues = convLabels.map(day => conversionData[day]);
    
    conversionsChart.data.labels = convLabels;
    conversionsChart.data.datasets[0].data = convValues;
    conversionsChart.update();
    
    // Calls Per Day
    const callsData = dashboardData.callsByDay || {};
    const callLabels = Object.keys(callsData).sort();
    const callValues = callLabels.map(day => callsData[day]);
    
    callsChart.data.labels = callLabels;
    callsChart.data.datasets[0].data = callValues;
    callsChart.update();
    
    // Lead Source Distribution
    const sourceData = dashboardData.sourceDistribution || [];
    const sourceLabels = sourceData.map(s => s.source || 'Unknown');
    const sourceValues = sourceData.map(s => s.count);
    
    sourceChart.data.labels = sourceLabels;
    sourceChart.data.datasets[0].data = sourceValues;
    sourceChart.update();
    
    // Follow-up Status
    const statusData = dashboardData.followupStatus || {};
    const statusLabels = Object.keys(statusData);
    const statusValues = statusLabels.map(status => statusData[status]);
    
    followupChart.data.labels = statusLabels;
    followupChart.data.datasets[0].data = statusValues;
    followupChart.update();
}

// --- Initialize Charts ---
function initCharts() {
    const convCtx = document.getElementById('conversionsChart').getContext('2d');
    conversionsChart = new Chart(convCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Conversions',
                data: [],
                backgroundColor: '#4CAF50'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true
        }
    });

    const callsCtx = document.getElementById('callsChart').getContext('2d');
    callsChart = new Chart(callsCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Calls',
                data: [],
                borderColor: '#2196F3',
                backgroundColor: 'rgba(33, 150, 243, 0.1)',
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true
        }
    });

    const sourceCtx = document.getElementById('sourceChart').getContext('2d');
    sourceChart = new Chart(sourceCtx, {
        type: 'pie',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: ['#4CAF50', '#2196F3', '#FFC107', '#FF5722', '#9E9E9E', '#673AB7', '#009688']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true
        }
    });

    const followCtx = document.getElementById('followupChart').getContext('2d');
    followupChart = new Chart(followCtx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: ['#FFA500', '#4CAF50', '#FF0000', '#808080']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true
        }
    });
}

// --- Modal Management ---
function showLeadModal(leadId) {
    const lead = (dashboardData.followupTracker || []).find(l => l.id === leadId);
    if (!lead) return;
    
    const followupStatus = getFollowupStatus(lead.nextFollowup);
    const lastCallFormatted = formatDateWithInfo(lead.lastCallDate);
    const nextFollowupFormatted = formatDateWithInfo(lead.nextFollowup);
    
    document.getElementById('modalLeadName').textContent = lead.name;
    document.getElementById('modalAssignedTo').textContent = lead.assignedTo || 'Unassigned';
    document.getElementById('modalLastCall').innerHTML = `
        <span>${lastCallFormatted}</span>
        <div style="font-size: 12px; color: #666; margin-top: 4px;">Last contact made</div>
    `;
    document.getElementById('modalNextFollowup').innerHTML = `
        <span style="color: ${followupStatus.color}; font-weight: 500;">${nextFollowupFormatted}</span>
        <div style="font-size: 12px; color: #666; margin-top: 4px;">${followupStatus.label}</div>
    `;
    document.getElementById('modalStatus').textContent = lead.status || '-';
    document.getElementById('leadModal').setAttribute('aria-hidden', 'false');
}

// --- Utility: Escape HTML ---
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// --- Toast Notification ---
function showToast(message) {
    const toast = document.getElementById('toast');
    const msg = document.getElementById('toastMessage');
    msg.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

// --- Event Listeners ---
document.getElementById('applyFilters').addEventListener('click', fetchAnalyticsData);
document.getElementById('resetFilters').addEventListener('click', () => {
    document.getElementById('fromDate').value = '';
    document.getElementById('toDate').value = '';
    document.getElementById('sourceFilter').value = 'all';
    fetchAnalyticsData();
});

document.getElementById('closeLeadModal').addEventListener('click', () => {
    document.getElementById('leadModal').setAttribute('aria-hidden', 'true');
});

document.getElementById('exportBtn').addEventListener('click', () => {
    if (!dashboardData) {
        showToast("No data to export");
        return;
    }
    let csv = 'Lead Name,Last Call Date,Next Follow-up,Status,Assigned To,Follow-up Status\n';
    (dashboardData.followupTracker || []).forEach(lead => {
        const followupStatus = getFollowupStatus(lead.nextFollowup);
        const lastCall = lead.lastCallDate ? new Date(lead.lastCallDate).toLocaleDateString() : '';
        const nextFollowup = lead.nextFollowup ? new Date(lead.nextFollowup).toLocaleDateString() : '';
        csv += `"${lead.name}","${lastCall}","${nextFollowup}","${lead.status}","${lead.assignedTo}","${followupStatus.label}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
});

// --- Initialize on page load ---
document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    fetchAnalyticsData();
    
    // Remove auto-refresh every 30 seconds to reduce server load
    // Refresh only on user action
    document.getElementById('applyFilters').addEventListener('click', fetchAnalyticsData);
    document.getElementById('resetFilters').addEventListener('click', () => {
        document.getElementById('fromDate').value = '';
        document.getElementById('toDate').value = '';
        document.getElementById('sourceFilter').value = 'all';
        fetchAnalyticsData();
    });
});
