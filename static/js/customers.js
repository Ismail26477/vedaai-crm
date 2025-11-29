let allCustomers = [];
let currentCustomer = null;

// Load all customers from API
async function loadCustomers() {
    const tableBody = document.getElementById('customerTableBody');
    tableBody.innerHTML = `<tr class="loading-row"><td colspan="11" class="loading-cell">
        <div class="loader"></div><p>Loading customers...</p></td></tr>`;

    try {
        const res = await fetch('/api/customers', { credentials: 'same-origin' });
        if (!res.ok) {
            // HTTP error (401 redirect to login may produce 200 with HTML; non-OK indicates a clear failure)
            throw new Error(`Server returned ${res.status}`);
        }

        let payload = null;
        try {
            payload = await res.json();
        } catch (e) {
            // Response not JSON (likely redirected to login HTML) — treat as no customers / unauthorized
            console.warn('Customers API did not return JSON. Response text will be logged.');
            const txt = await res.text().catch(() => null);
            console.debug('Non-JSON response from /api/customers:', txt);
            throw new Error('Unexpected response from server (not JSON)');
        }

        if (!payload || !payload.success) {
            throw new Error((payload && payload.error) ? payload.error : 'Failed to load customers');
        }

        allCustomers = payload.customers || [];

        if (!allCustomers.length) {
            document.getElementById('emptyState').style.display = 'block';
            document.querySelector('.table-section').style.display = 'none';
            // clear table body
            tableBody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:2rem">No customers found</td></tr>`;
        } else {
            document.getElementById('emptyState').style.display = 'none';
            document.querySelector('.table-section').style.display = 'block';
            renderCustomers(allCustomers);
        }

        updateStats(allCustomers);
    } catch (err) {
        console.error('Error loading customers:', err);
        // show friendly UI state rather than leaving the spinner
        document.getElementById('emptyState').style.display = 'block';
        const tableSection = document.querySelector('.table-section');
        if (tableSection) tableSection.style.display = 'none';
        tableBody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:2rem;color:#64748b">Unable to load customers</td></tr>`;
        showError('Error loading customers. Please ensure you are logged in and the server is reachable.');
    }
}

// Render table rows
function renderCustomers(customers) {
    const tableBody = document.getElementById('customerTableBody');
    if (!customers || !customers.length) {
        tableBody.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:2rem">No customers found</td></tr>`;
        return;
    }

    tableBody.innerHTML = customers.map((c, idx) => {
        const phone = c.phone || '';
        const digits = (phone.match(/\d+/g) || []).join('');
        const tel = digits ? `tel:${digits}` : '#';
        const wa = digits ? `https://wa.me/${digits}` : '#';
        return `
        <tr data-id="${c.id}">
            <td>${idx + 1}</td>
            <td><strong>${escapeHtml(c.name || '')}</strong></td>
            <td>${escapeHtml(phone || 'N/A')}</td>
            <td>${escapeHtml(c.email || 'N/A')}</td>
            <td>${escapeHtml(c.city || 'N/A')}</td>
            <td>₹${formatNumber(c.value || 0)}</td>
            <td>${escapeHtml(c.source || 'N/A')}</td>
            <td>${escapeHtml(c.stage || 'N/A')}</td>
            <td><span class="badge badge-${(c.priority || 'medium').toLowerCase()}">${escapeHtml(c.priority || '')}</span></td>
            <td>${digits ? `<a href="${tel}">📞</a> <a href="${wa}" target="_blank">💬</a>` : '—'}</td>
            <td>
                <button class="btn-icon" onclick="viewCustomer('${c.id}')" title="View details">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </button>
                <button class="btn-icon btn-delete" onclick="deleteCustomer('${c.id}')" title="Delete">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </td>
        </tr>`;
    }).join('');
}

// Update stats cards
function updateStats(cs) {
    const total = cs.length;
    const totalValue = cs.reduce((s, x) => s + (parseFloat(x.value) || 0), 0);
    const vip = cs.filter(x => (x.priority || '').toUpperCase() === 'VIP').length;
    const avg = total ? totalValue / total : 0;

    document.getElementById('totalCustomers').textContent = total;
    document.getElementById('vipCustomers').textContent = vip;
    document.getElementById('avgValue').textContent = `₹${formatNumber(avg)}`;
}

// View single customer in modal
async function viewCustomer(id) {
    try {
        const res = await fetch(`/api/leads/${id}`, { credentials: 'same-origin' });
        const p = await res.json();
        if (!p.success) throw new Error(p.error || 'Failed to load customer');

        const d = p.lead;
        currentCustomer = d;

        // Populate modal with customer details
        document.getElementById('detailsTitle').textContent = 'Customer Details';
        document.getElementById('detailContact').textContent = d.name || 'Unknown';
        document.getElementById('detailCompany').textContent = d.city || '-';
        document.getElementById('detailEmail').textContent = d.email || '-';
        document.getElementById('detailPhone').textContent = d.phone || '-';
        document.getElementById('detailValue').textContent = `₹${formatNumber(d.value || 0)}`;
        document.getElementById('detailStage').textContent = d.stage || '-';
        document.getElementById('detailSource').textContent = d.source || '-';
        document.getElementById('detailPriority').textContent = d.priority || '-';
        document.getElementById('detailCreated').textContent = d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '-';

        // Set stage badge styling
        const stageBadge = document.getElementById('detailsStage');
        stageBadge.textContent = d.stage || 'Unknown';
        stageBadge.className = 'detail-badge stage-' + (d.stage || '').toLowerCase().replace(/\s+/g, '-');

        // Show modal
        document.getElementById('detailsModal').classList.add('active');
    } catch (err) {
        console.error('[v0] View customer error:', err);
        showError('Failed to open customer details');
    }
}

// Proper modal close function
function closeDetailsModal() {
    document.getElementById('detailsModal').classList.remove('active');
    currentCustomer = null;
}

// Delete current customer function
async function deleteCurrentCustomer() {
    if (!currentCustomer) return;
    if (!confirm('Delete this customer?')) return;

    try {
        const res = await fetch(`/api/leads/${currentCustomer.id}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });
        const p = await res.json();
        if (!res.ok || !p.success) throw new Error(p.error || 'Delete failed');

        alert('Customer deleted successfully');
        closeDetailsModal();
        loadCustomers();
    } catch (err) {
        console.error('[v0] Delete error:', err);
        showError('Failed to delete customer');
    }
}

async function deleteCustomer(id) {
    if (!confirm('Delete this customer?')) return;
    try {
        const res = await fetch(`/api/leads/${id}`, {
            method: 'DELETE',
            credentials: 'same-origin'
        });
        const p = await res.json();
        if (!res.ok || !p.success) throw new Error(p.error || 'Delete failed');
        alert('Deleted');
        loadCustomers();
    } catch (err) {
        console.error(err);
        showError('Delete failed');
    }
}

// Export CSV
function exportToCSV() {
    if (!allCustomers.length) { alert('No customers'); return; }
    const headers = ['name', 'phone', 'email', 'city', 'value', 'source', 'stage', 'priority', 'createdAt'];
    let csv = headers.join(',') + '\n';
    allCustomers.forEach(c => {
        csv += headers.map(h => `"${String(c[h] || '').replace(/"/g, '""')}"`).join(',') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `customers_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
}

// Filter customers
function filterCustomers() {
    const q = (document.getElementById('searchInput').value || '').toLowerCase();
    const p = document.getElementById('priorityFilter').value;
    const s = document.getElementById('sourceFilter').value;
    const filtered = allCustomers.filter(c => {
        const matchQ = !q || (c.name || '').toLowerCase().includes(q) ||
                       (c.email || '').toLowerCase().includes(q) ||
                       (c.city || '').toLowerCase().includes(q);
        const matchP = !p || c.priority === p;
        const matchS = !s || c.source === s;
        return matchQ && matchP && matchS;
    });
    renderCustomers(filtered);
}

// Utilities
function formatNumber(n) {
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function escapeHtml(t) {
    if (t == null) return '';
    const d = document.createElement('div');
    d.textContent = String(t);
    return d.innerHTML;
}

function showError(m) {
    alert(m);
}

// Dummy function for syncing won leads (replace with actual API call)
async function syncWonLeads() {
    try {
        const res = await fetch('/api/leads/sync-to-customers', { method: 'POST', credentials: 'same-origin' });
        const j = await res.json().catch(() => null);
        if (res.ok && j && j.success) {
            alert(`Synced ${j.inserted || 0} won leads to customers.`);
        } else if (res.ok) {
            alert('Sync completed.');
        } else {
            alert('Sync failed: ' + (j && j.error ? j.error : res.status));
        }
    } catch (err) {
        console.error('Sync error', err);
        alert('Could not sync won leads (network/server error)');
    }
    // refresh list after attempting sync
    loadCustomers();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('searchInput')?.addEventListener('input', filterCustomers);
    document.getElementById('priorityFilter')?.addEventListener('change', filterCustomers);
    document.getElementById('sourceFilter')?.addEventListener('change', filterCustomers);
    document.querySelectorAll('button[onclick="syncWonLeads()"]').forEach(b => b.addEventListener('click', loadCustomers));
    loadCustomers();
});
