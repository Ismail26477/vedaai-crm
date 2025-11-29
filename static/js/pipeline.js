// static/js/pipeline.js
// Modified pipeline.js — server-first with localStorage fallback and sync
let leads = [];
let currentLeadId = null;
let draggedElement = null;

// Utility: identify local-only IDs created by generateId()
function isLocalId(id) {
    return typeof id === 'string' && id.startsWith('lead_');
}

// -------------------- Initialization --------------------
document.addEventListener('DOMContentLoaded', () => {
    loadLeads().then(() => {
        renderPipeline();
        updateStats();
    });
});

// -------------------- Persistence --------------------
function saveLeads() {
    localStorage.setItem('crm_leads', JSON.stringify(leads));
}

// Generate unique ID (local fallback)
function generateId() {
    return 'lead_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// -------------------- Server sync / loading --------------------
async function loadLeads() {
    // Try server first
    try {
        const res = await fetch('/api/leads');
        if (!res.ok) throw new Error('Server returned ' + res.status);
        const body = await res.json();
        if (body && body.success && Array.isArray(body.leads)) {
            // Normalize lead values (ensure numeric)
            leads = body.leads.map(l => ({
                id: l.id,
                name: l.name || '',
                company: l.company || '',
                contact: l.name || '',
                email: l.email || '',
                phone: l.phone || '',
                value: Number(l.value || 0),
                stage: l.stage || 'New Lead',
                source: l.source || 'Manual Entry',
                notes: l.notes || '',
                priority: l.priority || 'Warm',
                createdAt: l.createdAt || new Date().toISOString()
            }));
            saveLeads(); // cache locally
            console.log('Loaded leads from server:', leads.length);
            return;
        } else {
            throw new Error('Malformed server response');
        }
    } catch (err) {
        console.warn('Could not load leads from server, falling back to localStorage:', err);
        // fallback to local storage
        const stored = localStorage.getItem('crm_leads');
        if (stored) {
            try {
                leads = JSON.parse(stored);
            } catch (e) {
                leads = [];
            }
        } else {
            // If no local, initialize sample dataset (keeps original behavior)
            initSampleData();
        }
    }
}

function initSampleData() {
    // keep your original sample dataset but with stable structure
    leads = [
        {
            id: generateId(),
            name: 'Website Redesign',
            company: 'Tech Corp',
            contact: 'John Smith',
            email: 'john@techcorp.com',
            phone: '+1-555-0101',
            value: 45000,
            stage: 'New Lead',
            source: 'Website Form',
            notes: 'Interested in complete website overhaul with modern design',
            createdAt: new Date().toISOString()
        },
        {
            id: generateId(),
            name: 'Cloud Migration',
            company: 'Global Industries',
            contact: 'Sarah Johnson',
            email: 'sarah@globalind.com',
            phone: '+1-555-0102',
            value: 120000,
            stage: 'Qualified',
            source: 'Google Ads',
            notes: 'Moving 50+ servers to cloud infrastructure',
            createdAt: new Date().toISOString()
        },
        {
            id: generateId(),
            name: 'Mobile App Development',
            company: 'StartupXYZ',
            contact: 'Mike Chen',
            email: 'mike@startupxyz.com',
            phone: '+1-555-0103',
            value: 85000,
            stage: 'Proposal',
            source: 'Referral',
            notes: 'iOS and Android native apps for e-commerce platform',
            createdAt: new Date().toISOString()
        },
        {
            id: generateId(),
            name: 'ERP Implementation',
            company: 'Manufacturing Co',
            contact: 'Lisa Anderson',
            email: 'lisa@mfgco.com',
            phone: '+1-555-0104',
            value: 250000,
            stage: 'Negotiation',
            source: 'Meta Ads',
            notes: 'Enterprise resource planning system for 500+ users',
            createdAt: new Date().toISOString()
        },
        {
            id: generateId(),
            name: 'Security Audit',
            company: 'Finance Plus',
            contact: 'David Brown',
            email: 'david@financeplus.com',
            phone: '+1-555-0105',
            value: 35000,
            stage: 'Closed Won',
            source: 'External API',
            notes: 'Completed comprehensive security review and penetration testing',
            createdAt: new Date().toISOString()
        },
        {
            id: generateId(),
            name: 'SEO Optimization',
            company: 'E-commerce Store',
            contact: 'Emma Wilson',
            email: 'emma@ecomstore.com',
            phone: '+1-555-0106',
            value: 15000,
            stage: 'New Lead',
            source: 'Google Sheet',
            notes: 'Need better search rankings and organic traffic growth',
            createdAt: new Date().toISOString()
        },
        {
            id: generateId(),
            name: 'CRM Integration',
            company: 'Sales Team Inc',
            contact: 'Robert Taylor',
            email: 'robert@salesteam.com',
            phone: '+1-555-0107',
            value: 60000,
            stage: 'Qualified',
            source: 'Manual Entry',
            notes: 'Integrate CRM with existing tools and automate workflows',
            createdAt: new Date().toISOString()
        }
    ];
    saveLeads();
}

// -------------------- Rendering --------------------
function renderPipeline() {
    const stages = ['New Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won'];

    stages.forEach(stage => {
        const containerId = 'stage-' + stage.toLowerCase().replace(/\s+/g, '-');
        const container = document.getElementById(containerId);
        const stageLeads = leads.filter(lead => lead.stage === stage);

        if (!container) return;
        // clear - keep consistent behavior
        container.innerHTML = '';

        stageLeads.forEach(lead => {
            container.appendChild(createLeadCard(lead));
        });

        // Update column stats
        updateColumnStats(stage, stageLeads);
    });
}

function createLeadCard(lead) {
    const card = document.createElement('div');
    card.className = 'deal-card';
    card.draggable = true;
    card.dataset.id = lead.id;
    card.id = `card-${lead.id}`;

    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);

    card.innerHTML = `
        <div class="deal-header">
            <div class="deal-name">${escapeHtml(lead.name)}</div>
            <div class="deal-value">${formatCurrency(lead.value)}</div>
        </div>
        <div class="deal-info">
            <div class="deal-info-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
                ${escapeHtml(lead.contact || '')}
            </div>
            <div class="deal-info-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
                ${escapeHtml(lead.company || '')}
            </div>
        </div>
        <div class="deal-source">${escapeHtml(lead.source || '')}</div>
        ${lead.notes ? `<div class="deal-notes">${escapeHtml(lead.notes)}</div>` : ''}
        <div class="deal-actions">
            <button class="btn-small btn-view" onclick="viewLeadDetails('${lead.id}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>
                View Details
            </button>
        </div>
    `;

    return card;
}

// -------------------- Stats --------------------
function updateColumnStats(stage, stageLeads) {
    const stageId = stage.toLowerCase().replace(/\s+/g, '-');
    const countEl = document.getElementById('count-' + stageId);
    const valueEl = document.getElementById('value-' + stageId);

    const totalValue = stageLeads.reduce((sum, lead) => sum + (Number(lead.value) || 0), 0);

    if (countEl) countEl.textContent = stageLeads.length;
    if (valueEl) valueEl.textContent = formatCurrency(totalValue);
}

function updateStats() {
    const totalDeals = leads.length;
    const pipelineValue = leads.reduce((sum, lead) => sum + (Number(lead.value) || 0), 0);
    const avgDealSize = totalDeals > 0 ? pipelineValue / totalDeals : 0;
    const closedWon = leads.filter(lead => lead.stage === 'Closed Won').length;
    const winRate = totalDeals > 0 ? (closedWon / totalDeals) * 100 : 0;

    const td = document.getElementById('totalDeals');
    const pv = document.getElementById('pipelineValue');
    const ad = document.getElementById('avgDealSize');
    const wr = document.getElementById('winRate');

    if (td) td.textContent = totalDeals;
    if (pv) pv.textContent = formatCurrency(pipelineValue);
    if (ad) ad.textContent = formatCurrency(avgDealSize);
    if (wr) wr.textContent = winRate.toFixed(1) + '%';
}

// -------------------- Drag & Drop --------------------
function handleDragStart(e) {
    draggedElement = e.currentTarget;
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', e.currentTarget.dataset.id);
}

function handleDragEnd(e) {
    if (e.currentTarget) e.currentTarget.classList.remove('dragging');
    draggedElement = null;
}

function allowDrop(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const container = e.currentTarget;
    container.classList.add('drag-over');

    setTimeout(() => {
        container.classList.remove('drag-over');
    }, 100);
}

async function drop(e) {
    e.preventDefault();
    const leadId = e.dataTransfer.getData('text/plain') || (draggedElement && draggedElement.dataset.id);
    if (!leadId) return;

    // figure stage from column
    const column = e.currentTarget.closest('.pipeline-column');
    if (!column) return;
    const newStage = column.dataset.stage;
    if (!newStage) return;

    // update locally
    const leadIndex = leads.findIndex(l => l.id === leadId);
    if (leadIndex === -1) {
        console.warn('Dropped lead not found locally:', leadId);
        return;
    }
    leads[leadIndex].stage = newStage;
    saveLeads();
    renderPipeline();
    updateStats();

    // Sync with server:
    try {
        // If this lead already exists on server (not local ID), PATCH stage.
        if (!isLocalId(leadId)) {
            const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}/stage`, {
                method: 'PATCH',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({stage: newStage})
            });
            const j = await res.json().catch(()=>null);
            if (!res.ok || (j && !j.success)) {
                console.warn('Server failed to update stage', res.status, j);
                showNotification('⚠️ Could not update stage on server; saved locally.');
            } else {
                await refreshSummary(); // update cards/stats from server summary (optional)
            }
        } else {
            // If it's a local-only lead, try to create it on server (POST) to obtain a server id, then PATCH stage (server create includes stage)
            const created = await createLeadOnServer(leads[leadIndex]);
            if (created && created.id) {
                // replace local id with server id
                const oldId = leads[leadIndex].id;
                leads = leads.map(l => l.id === oldId ? Object.assign({}, l, { id: created.id }) : l);
                saveLeads();
                renderPipeline();
                updateStats();
            }
        }
        showNotification(`${leads[leadIndex].name} moved to ${newStage}`);
    } catch (err) {
        console.error('Error syncing stage change:', err);
        showNotification('⚠️ Stage changed locally. Server sync failed.', 'warning');
    }
}

// -------------------- CRUD: create/update/delete --------------------
async function saveLead(event) {
    if (event && event.preventDefault) event.preventDefault();

    const leadIdFromForm = document.getElementById('leadId').value;
    const isUpdate = !!leadIdFromForm;

    const leadPayload = {
        id: leadIdFromForm || generateId(),
        name: (document.getElementById('leadName').value || '').trim(),
        phone: (document.getElementById('leadPhone').value || '').trim(),
        email: (document.getElementById('leadEmail').value || '').trim(),
        city: (document.getElementById('leadCity').value || '').trim(),
        value: parseFloat(document.getElementById('leadValue').value) || 0,
        source: document.getElementById('leadSource').value || 'Manual Entry',
        stage: document.getElementById('leadStage').value || 'New Lead',
        priority: document.getElementById('leadPriority').value || 'Warm',
        notes: document.getElementById('leadNotes') ? document.getElementById('leadNotes').value : '',
        createdAt: isUpdate
            ? (leads.find(l => l.id === leadIdFromForm)?.createdAt || new Date().toISOString())
            : new Date().toISOString()
    };

    // Validation
    if (!leadPayload.name || !leadPayload.phone || !leadPayload.city) {
        showNotification('Name, Phone and City are required.', 'error');
        return;
    }

    // Optimistic local update
    const existingIndex = leads.findIndex(l => l.id === leadPayload.id);
    if (existingIndex >= 0) {
        leads[existingIndex] = leadPayload;
    } else {
        leads.unshift(leadPayload);
    }
    saveLeads();
    renderPipeline();
    updateStats();
    closeLeadModal();

    // Try server sync
    try {
        if (isUpdate && !isLocalId(leadPayload.id)) {
            // Full update to server (PUT)
            const res = await fetch(`/api/leads/${encodeURIComponent(leadPayload.id)}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(leadPayload)
            });
            const j = await res.json().catch(()=>null);
            if (!res.ok || (j && !j.success)) {
                showNotification('⚠️ Server update failed; saved locally.', 'warning');
            } else {
                showNotification('Lead updated in database.', 'success');
            }
        } else {
            // Create on server (POST) — server may return authoritative id
            const created = await createLeadOnServer(leadPayload);
            if (created && created.id) {
                // swap ids locally
                const oldId = leadPayload.id;
                leads = leads.map(l => l.id === oldId ? Object.assign({}, l, { id: created.id }) : l);
                saveLeads();
                renderPipeline();
                updateStats();
                showNotification('Lead added to database.', 'success');
            } else {
                showNotification('Saved locally. Server did not return an id.', 'warning');
            }
        }
    } catch (err) {
        console.error('saveLead server sync failed', err);
        showNotification('⚠️ Server offline — saved locally only.', 'warning');
    }
}

// Helper: create lead on server and return created lead object (or null)
async function createLeadOnServer(lead) {
    try {
        const res = await fetch('/api/leads', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(lead)
        });

        // server may return JSON or text
        const text = await res.text();
        let json = null;
        try { json = JSON.parse(text); } catch(e){}

        if (!res.ok) {
            console.warn('createLeadOnServer failed:', res.status, json || text);
            return null;
        }

        // Existing app.py returns { success: True, lead: { id: db_id } }
        if (json && json.success && json.lead && json.lead.id) {
            return { id: json.lead.id };
        }

        // For import endpoint some responses only include imported count — not helpful for id mapping
        return null;
    } catch (err) {
        console.error('createLeadOnServer error:', err);
        return null;
    }
}

// Delete lead (local + server)
async function deleteLead() {
    if (!currentLeadId) return;

    const lead = leads.find(l => l.id === currentLeadId);
    if (!lead) return;

    if (!confirm(`Are you sure you want to delete "${lead.name}"?`)) return;

    // Remove locally first
    leads = leads.filter(l => l.id !== currentLeadId);
    saveLeads();
    renderPipeline();
    updateStats();
    closeDetailsModal();
    showNotification('Lead deleted locally.');

    // Try server delete if server id
    if (!isLocalId(currentLeadId)) {
        try {
            const res = await fetch(`/api/leads/${encodeURIComponent(currentLeadId)}`, { method: 'DELETE' });
            const j = await res.json().catch(()=>null);
            if (!res.ok || (j && !j.success)) {
                showNotification('⚠️ Server delete may have failed', 'warning');
            } else {
                showNotification('Lead deleted from database', 'success');
            }
        } catch (err) {
            console.error('Server delete failed', err);
            showNotification('⚠️ Server offline — deletion pending', 'warning');
        }
    }
}

// -------------------- Details / Edit modal --------------------
async function viewLeadDetails(id) {
    // Try server for freshest data, fallback to local
    let lead = null;
    if (!isLocalId(id)) {
        try {
            const res = await fetch(`/api/leads/${encodeURIComponent(id)}`);
            if (res.ok) {
                const j = await res.json();
                if (j && j.success && j.lead) {
                    lead = j.lead;
                }
            }
        } catch (err) {
            console.warn('Could not fetch lead details from server', err);
        }
    }
    if (!lead) {
        lead = leads.find(l => l.id === id);
    }
    if (!lead) return showNotification('Lead not found', 'error');

    document.getElementById('detailsTitle').textContent = lead.name || 'Lead Details';
    document.getElementById('detailCompany').textContent = lead.company || '';
    document.getElementById('detailContact').textContent = lead.contact || lead.name || '';
    document.getElementById('detailEmail').textContent = lead.email || '';
    document.getElementById('detailPhone').textContent = lead.phone || '';
    document.getElementById('detailValue').textContent = formatCurrency(lead.value || 0);
    document.getElementById('detailStage').textContent = lead.stage || '';
    document.getElementById('detailSource').textContent = lead.source || '';
    document.getElementById('detailNotes').textContent = lead.notes || '';

    const detailsModal = document.getElementById('detailsModal');
    if (detailsModal) {
        detailsModal.dataset.currentLeadId = id;
        detailsModal.style.display = 'block';
    }
}

// Prefill edit modal
function editLead(id) {
    const lead = leads.find(l => l.id === id);
    if (!lead) {
        showNotification('Lead not found locally', 'error');
        return;
    }

    currentLeadId = id;
    document.getElementById('modalTitle').textContent = 'Edit Lead';
    document.getElementById('leadId').value = lead.id;
    document.getElementById('leadName').value = lead.name || ''; 
    document.getElementById('leadPhone').value = lead.phone || '';
    document.getElementById('leadEmail').value = lead.email || '';
    document.getElementById('leadCity').value = lead.city || '';
    document.getElementById('leadValue').value = lead.value || 0;
    try { document.getElementById('leadSource').value = lead.source || 'Manual Entry'; } catch(e){}
    try { document.getElementById('leadStage').value = lead.stage || 'New Lead'; } catch(e){}
    try { document.getElementById('leadPriority').value = lead.priority || 'Warm'; } catch(e){}
    if (document.getElementById('leadNotes')) document.getElementById('leadNotes').value = lead.notes || '';

    document.getElementById('leadModal').classList.add('active');
}
// ==================== Lead Import ====================

// Open Source Selection Modal
function openLeadSourceModal() {
    document.getElementById('sourceModal').classList.add('active');
}

function closeLeadSourceModal() {
    document.getElementById('sourceModal').classList.remove('active');
}

function openGoogleSheetModal() {
    document.getElementById('googleSheetModal').classList.add('active');
}

function closeGoogleSheetModal() {
    document.getElementById('googleSheetModal').classList.remove('active');
}

function openMetaAdsModal() {
    document.getElementById('metaAdsModal').classList.add('active');
}

function closeMetaAdsModal() {
    document.getElementById('metaAdsModal').classList.remove('active');
}

// Select source
function selectSource(source) {
    closeLeadSourceModal();
    if (source === 'Manual Entry') openAddLeadModal();
    else if (source === 'Google Sheet') openGoogleSheetModal();
    else if (source === 'Meta Ads') openMetaAdsModal();
    else showNotification('Source not implemented', 'error');
}

// Confirm import buttons
function confirmGoogleSheetImport() {
    const sheetId = document.getElementById('sheetUrl').value;
    if (!sheetId) return showNotification('Please enter Sheet URL/ID', 'error');
    closeGoogleSheetModal();
    importFromGoogleSheet(sheetId);
}

function confirmMetaAdsImport() {
    const adAccount = document.getElementById('adAccount').value;
    const campaignId = document.getElementById('campaignId').value;
    closeMetaAdsModal();
    importFromMetaAds(adAccount, campaignId);
}

// Prompt user for Google Sheet URL or ID
function promptGoogleSheetImport() {
    const sheetUrl = prompt('Enter Google Sheet URL or Sheet ID for import:');
    if (!sheetUrl) return;

    importFromGoogleSheet(sheetUrl);
}

// Prompt user for Meta Ads import options
function promptMetaAdsImport() {
    const adAccount = prompt('Enter Meta Ads Account ID (optional):');
    const campaignId = prompt('Enter Campaign ID (optional):');

    importFromMetaAds(adAccount, campaignId);
}

async function importFromGoogleSheet(sheetUrl) {
    try {
        // Convert Google Sheet URL to CSV export link
        if (!sheetUrl.includes('export?format=csv')) {
            const sheetIdMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
            if (!sheetIdMatch) return showNotification('Invalid Sheet URL', 'error');
            const sheetId = sheetIdMatch[1];
            sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
        }

        const leadsData = await fetchLeadsFromSheet(sheetUrl);

        if (!leadsData || leadsData.length === 0) {
            return showNotification('No leads found in Google Sheet', 'error');
        }

        const response = await fetch('/api/leads/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leads: leadsData })
        });

        const data = await response.json();
        console.log('Google Sheet import result:', data);

        if (data.success) {
            showNotification(`Imported ${data.imported} leads`, 'success');
        } else {
            showNotification('Import failed: ' + data.error, 'error');
        }
    } catch (err) {
        console.error('Import failed:', err);
        showNotification('Import failed, see console', 'error');
    }
}

async function fetchLeadsFromSheet(sheetUrl) {
    const res = await fetch(sheetUrl);
    const text = await res.text();

    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

    const leads = lines.slice(1)
        .map(line => {
            const data = line.split(',');
            const obj = {};
            headers.forEach((h, i) => {
                obj[h] = (data[i] || '').trim();
            });
            return obj;
        })
        .filter(l => l.name && l.phone && l.city); // only valid rows

    return leads;
}


// Meta Ads Import
async function importFromMetaAds(adAccount, campaignId) {
    try {
        // Replace with your real API endpoint, passing adAccount & campaignId
        const query = `?adAccount=${encodeURIComponent(adAccount || '')}&campaignId=${encodeURIComponent(campaignId || '')}`;
        const res = await fetch(`/api/meta-ads-leads${query}`);
        if (!res.ok) throw new Error(`Meta Ads API error: ${res.status}`);

        const metaLeads = await res.json();

        for (const lead of metaLeads) {
            await saveImportedLead({
                name: lead.name || 'Unnamed',
                phone: lead.phone || '',
                email: lead.email || '',
                city: lead.city || '',
                company: lead.company || '',
                value: parseFloat(lead.value) || 0,
                stage: lead.stage || 'New Lead',
                priority: lead.priority || 'Warm',
                notes: lead.notes || ''
            }, 'Meta Ads');
        }

        showNotification('Meta Ads leads imported successfully!');
    } catch (err) {
        console.error('Meta Ads import error:', err);
        showNotification('Failed to import Meta Ads leads', 'error');
    }
}

// Save imported lead (shared for both Google Sheet & Meta Ads)
async function saveImportedLead(lead, source) {
    lead.source = source;
    lead.stage = lead.stage || 'New Lead';
    lead.priority = lead.priority || 'Warm';
    lead.createdAt = lead.createdAt || new Date().toISOString();

    // Save locally
    leads.unshift(lead);
    saveLeads();
    renderPipeline();
    updateStats();

    try {
        const res = await fetch('/api/leads/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leads: [lead] })  // wrap in array
        });

        const json = await res.json();

        if (res.ok && json.success) {
            showNotification(`Lead saved to database (ID: ${json.imported})`, 'success');
        } else {
            showNotification('Lead saved locally but not in database', 'warning');
        }
    } catch (err) {
        console.error('Server offline — lead saved locally only', err);
        showNotification('Server offline — lead saved locally only', 'warning');
    }
}



// Simple CSV parser
function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(l => l.trim() !== '');
    const headers = lines[0].split(',');
    return lines.slice(1).map(line => {
        const values = line.split(',');
        const obj = {};
        headers.forEach((h, i) => obj[h.trim()] = values[i]?.trim());
        return obj;
    });
}

// Helper: fetch CSV from Google sheet and map columns to keys
async function fetchLeadsFromSheet(sheetUrl) {
    const res = await fetch(sheetUrl);
    if (!res.ok) throw new Error('Could not fetch sheet: ' + res.status);
    const text = await res.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    return lines.slice(1).map(line => {
        const cells = line.split(',');
        const obj = {};
        headers.forEach((h, i) => obj[h] = (cells[i] || '').trim());
        return obj;
    }).filter(r => (r.name || r.contact) && (r.phone || r.number));
}

// -------------------- Utilities --------------------
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount || 0);
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    const bg = type === 'error' ? '#ef4444' : (type === 'warning' ? '#f59e0b' : '#10b981');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bg};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        font-weight: 500;
    `;
    notification.textContent = message;

    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; } to { transform: translateX(400px); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// -------------------- UI Helpers: modals & keyboard --------------------
function openAddLeadModal() {
    currentLeadId = null;
    document.getElementById('modalTitle').textContent = 'Add New Lead';
    const form = document.getElementById('leadForm');
    if (form) form.reset();
    if (document.getElementById('leadId')) document.getElementById('leadId').value = '';
    document.getElementById('leadModal').classList.add('active');
}

function closeLeadModal() {
    document.getElementById('leadModal').classList.remove('active');
}

function openLeadSourceModal() {
    document.getElementById('sourceModal').classList.add('active');
}
function closeLeadSourceModal() {
    document.getElementById('sourceModal').classList.remove('active');
}
function openGoogleSheetModal() {
    document.getElementById('googleSheetModal').classList.add('active');
}
function closeGoogleSheetModal() {
    document.getElementById('googleSheetModal').classList.remove('active');
}
function openMetaAdsModal() {
    document.getElementById('metaAdsModal').classList.add('active');
}
function closeMetaAdsModal() {
    document.getElementById('metaAdsModal').classList.remove('active');
}

window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        openAddLeadModal();
    }
});

// -------------------- Small helpers --------------------
async function refreshSummary() {
    // optional: call /api/pipeline/summary if you want server-driven stats
    try {
        const res = await fetch('/api/pipeline/summary');
        if (!res.ok) return;
        const j = await res.json();
        if (j && j.success && Array.isArray(j.summary)) {
            // update stat cards (we keep avg calc simple)
            let totalCount = 0;
            let totalValue = 0;
            j.summary.forEach(s => { totalCount += s.count; totalValue += (s.value || 0); });
            const avg = totalCount > 0 ? totalValue / totalCount : 0;
            const td = document.getElementById('totalDeals');
            const pv = document.getElementById('pipelineValue');
            const ad = document.getElementById('avgDealSize');
            const wr = document.getElementById('winRate');
            if (td) td.textContent = totalCount;
            if (pv) pv.textContent = formatCurrency(totalValue);
            if (ad) ad.textContent = formatCurrency(avg);
            if (wr) {
                const closed = j.summary.find(s => s.stage === 'Closed Won')?.count || 0;
                const winRate = totalCount > 0 ? Math.round((closed / totalCount) * 100) : 0;
                wr.textContent = winRate + '%';
            }
        }
    } catch (err) {
        // ignore silently
    }
}
