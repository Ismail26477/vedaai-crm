// Data storage
let leads = [];
let filteredLeads = [];
let currentLeadId = null;
let currentView = 'list';
let sortColumn = '';
let sortDirection = 'asc';
let selectedLeads = new Set();
let importedData = [];

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadLeads(); 
    renderLeads();
    updateStats();
});

// Load leads from localStorage
function loadLeads() {
    const stored = localStorage.getItem('crm_leads');
    if (stored) {
        leads = JSON.parse(stored);
    } else {
        leads = generateSampleData();
        saveLeads();
    }
    filteredLeads = [...leads];
}

// Generate sample data
function generateSampleData() {
    return [
        {
            id: generateId(),
            name: 'Website Redesign Project',
            company: 'Tech Innovations Inc',
            contact: 'John Smith',
            jobTitle: 'CEO',
            email: 'john@techinnovations.com',
            phone: '+1-555-0101',
            website: 'https://techinnovations.com',
            linkedin: 'https://linkedin.com/in/johnsmith',
            value: 45000,
            stage: 'New Lead',
            source: 'Website Form',
            priority: 'Hot',
            industry: 'Technology',
            notes: 'Looking for a modern, responsive website.',
            createdAt: new Date().toISOString()
        },
        {
            id: generateId(),
            name: 'Cloud Infrastructure Migration',
            company: 'Global Manufacturing Corp',
            contact: 'Sarah Johnson',
            jobTitle: 'CTO',
            email: 'sarah@globalmanufacturing.com',
            phone: '+1-555-0102',
            website: 'https://globalmanufacturing.com',
            linkedin: 'https://linkedin.com/in/sarahjohnson',
            value: 250000,
            stage: 'Qualified',
            source: 'Google Ads',
            priority: 'Hot',
            industry: 'Manufacturing',
            notes: 'Large enterprise migration project.',
            createdAt: new Date(Date.now() - 86400000).toISOString()
        },
        {
            id: generateId(),
            name: 'Mobile App Development',
            company: 'HealthTech Startup',
            contact: 'Mike Chen',
            jobTitle: 'Product Manager',
            email: 'mike@healthtech.io',
            phone: '+1-555-0103',
            website: 'https://healthtech.io',
            linkedin: 'https://linkedin.com/in/mikechen',
            value: 120000,
            stage: 'Proposal',
            source: 'Referral',
            priority: 'Warm',
            industry: 'Healthcare',
            notes: 'iOS and Android app for patient monitoring.',
            createdAt: new Date(Date.now() - 172800000).toISOString()
        }
    ];
}

// Save leads to localStorage
function saveLeads() {
    localStorage.setItem('crm_leads', JSON.stringify(leads));
}

// Generate unique ID
function generateId() {
    return 'lead_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Render leads
function renderLeads() {
    if (currentView === 'list') {
        renderTableView();
    } else {
        renderGridView();
    }
    updateStats();
}

// Render table view
function renderTableView() {
    const tbody = document.getElementById('leadsTableBody');
    const emptyState = document.getElementById('emptyState');

    if (filteredLeads.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    tbody.innerHTML = filteredLeads.map(lead => `
        <tr>
            <td>
                <input type="checkbox" class="lead-checkbox" value="${lead.id}" onchange="handleLeadSelection('${lead.id}', this.checked)">
            </td>
            <td class="lead-name-cell" onclick="viewLeadDetails('${lead.id}')" style="cursor: pointer;">
                ${escapeHtml(lead.name)}
            </td>
            <td>${escapeHtml(lead.contact || '-')}</td>
            <td class="phone-cell">
                <span class="phone-number" onclick="copyPhoneNumber('${lead.phone || '-'}')" title="Click to copy">
                    ${lead.phone || '-'}
                </span>
                ${lead.phone ? `<button class="btn-copy" onclick="copyPhoneNumber('${lead.phone}')" title="Copy number">Copy</button>` : ''}
            </td>
            <td class="lead-value-cell">${formatCurrency(lead.value)}</td>
            <td><span class="stage-badge stage-${lead.stage.toLowerCase().replace(' ', '-')}">${lead.stage}</span></td>
            <td><span class="source-badge">${lead.source}</span></td>
            <td><span class="priority-badge priority-${lead.priority.toLowerCase()}">${lead.priority}</span></td>
            <td class="contact-actions">
                ${lead.phone ? `
                    <button class="btn-call" onclick="makeCall('${lead.phone}', '${escapeHtml(lead.contact)}')" title="Call ${escapeHtml(lead.contact)}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                    </button>
                    <button class="btn-message" onclick="sendMessage('${lead.phone}', '${escapeHtml(lead.contact)}')" title="Message ${escapeHtml(lead.contact)}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                    </button>
                ` : '<span style="color: #94a3b8;">-</span>'}
            </td>
            <td class="actions-cell">
                <button class="btn-small btn-edit" onclick="editLead('${lead.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    Edit
                </button>
            </td>
        </tr>
    `).join('');
}

// Render grid view
function renderGridView() {
    const gridContainer = document.getElementById('gridView');

    if (filteredLeads.length === 0) {
        gridContainer.innerHTML = '<div class="empty-state"><p>No leads found</p></div>';
        return;
    }

    gridContainer.innerHTML = filteredLeads.map(lead => `
        <div class="lead-card">
            <div class="lead-card-header">
                <div>
                    <div class="lead-card-title">${escapeHtml(lead.name)}</div>
                    <div class="lead-card-company">${escapeHtml(lead.company || '-')}</div>
                </div>
                <div class="lead-card-value">${formatCurrency(lead.value)}</div>
            </div>
            <div class="lead-card-body">
                <div class="lead-card-info">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    ${escapeHtml(lead.contact || '-')}
                </div>
                <div class="lead-card-info">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                    ${lead.phone || '-'}
                </div>
            </div>
            <div class="lead-card-footer">
                <span class="stage-badge stage-${lead.stage.toLowerCase().replace(' ', '-')}">${lead.stage}</span>
                <span class="priority-badge priority-${lead.priority.toLowerCase()}">${lead.priority}</span>
            </div>
        </div>
    `).join('');
}

// Toggle view
function toggleView(view) {
    currentView = view;
    document.getElementById('listView').style.display = view === 'list' ? 'block' : 'none';
    document.getElementById('gridView').style.display = view === 'grid' ? 'block' : 'none';
    document.getElementById('listViewBtn').classList.toggle('active', view === 'list');
    document.getElementById('gridViewBtn').classList.toggle('active', view === 'grid');
    renderLeads();
}

// Filter leads
function filterLeads() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const stageFilter = document.getElementById('filterStage').value;
    const sourceFilter = document.getElementById('filterSource').value;
    const priorityFilter = document.getElementById('filterPriority').value;

    filteredLeads = leads.filter(lead => {
        const matchesSearch = !searchTerm ||
            lead.name.toLowerCase().includes(searchTerm) ||
            (lead.company && lead.company.toLowerCase().includes(searchTerm)) ||
            (lead.contact && lead.contact.toLowerCase().includes(searchTerm)) ||
            (lead.phone && lead.phone.toLowerCase().includes(searchTerm));

        const matchesStage = !stageFilter || lead.stage === stageFilter;
        const matchesSource = !sourceFilter || lead.source === sourceFilter;
        const matchesPriority = !priorityFilter || lead.priority === priorityFilter;

        return matchesSearch && matchesStage && matchesSource && matchesPriority;
    });

    renderLeads();
}

// Clear filters
function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('filterStage').value = '';
    document.getElementById('filterSource').value = '';
    document.getElementById('filterPriority').value = '';
    filterLeads();
}

// Sort table
function sortTable(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }

    filteredLeads.sort((a, b) => {
        let aVal = a[column];
        let bVal = b[column];

        if (column === 'value') {
            aVal = parseFloat(aVal) || 0;
            bVal = parseFloat(bVal) || 0;
        } else {
            aVal = String(aVal || '').toLowerCase();
            bVal = String(bVal || '').toLowerCase();
        }

        if (sortDirection === 'asc') {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });

    renderLeads();
}

// Update stats
function updateStats() {
    const today = new Date().toDateString();
    const newToday = leads.filter(l => new Date(l.createdAt).toDateString() === today).length;
    const hotLeads = leads.filter(l => l.priority === 'Hot').length;
    const totalValue = leads.reduce((sum, l) => sum + (l.value || 0), 0);

    document.getElementById('totalLeads').textContent = leads.length;
    document.getElementById('newToday').textContent = newToday;
    document.getElementById('hotLeads').textContent = hotLeads;
    document.getElementById('totalValue').textContent = formatCurrency(totalValue);
}

// Handle lead selection
function handleLeadSelection(leadId, checked) {
    if (checked) {
        selectedLeads.add(leadId);
    } else {
        selectedLeads.delete(leadId);
    }
    updateBulkDeleteButton();
}

// Toggle select all
function toggleSelectAll() {
    const selectAll = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.lead-checkbox');

    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll.checked;
        handleLeadSelection(checkbox.value, selectAll.checked);
    });
}

// Update bulk delete button
function updateBulkDeleteButton() {
    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    if (selectedLeads.size > 0) {
        bulkDeleteBtn.style.display = 'flex';
        bulkDeleteBtn.textContent = `Delete Selected (${selectedLeads.size})`;
    } else {
        bulkDeleteBtn.style.display = 'none';
    }
}

// Bulk delete leads
function bulkDeleteLeads() {
    if (selectedLeads.size === 0) return;

    if (confirm(`Are you sure you want to delete ${selectedLeads.size} lead(s)? This action cannot be undone.`)) {
        leads = leads.filter(lead => !selectedLeads.has(lead.id));
        saveLeads();
        selectedLeads.clear();
        document.getElementById('selectAll').checked = false;
        filterLeads();
        showNotification(`${selectedLeads.size} lead(s) deleted successfully!`, 'success');
        updateBulkDeleteButton();
    }
}

// Copy phone number
function copyPhoneNumber(phone) {
    if (!phone || phone === '-') {
        showNotification('No phone number to copy', 'error');
        return;
    }

    navigator.clipboard.writeText(phone).then(() => {
        showNotification(`Phone number ${phone} copied to clipboard!`, 'success');
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = phone;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showNotification(`Phone number ${phone} copied to clipboard!`, 'success');
    });
}

// Make call
function makeCall(phone, contactName) {
    if (!phone || phone === '-') {
        showNotification('No phone number available', 'error');
        return;
    }

    if (confirm(`Do you want to call ${contactName} at ${phone}?`)) {
        window.location.href = `tel:${phone}`;
        showNotification(`Initiating call to ${contactName}...`, 'info');
    }
}

// Send message
function sendMessage(phone, contactName) {
    if (!phone || phone === '-') {
        showNotification('No phone number available', 'error');
        return;
    }

    const message = prompt(`Enter message to send to ${contactName}:`);
    if (message) {
        window.location.href = `sms:${phone}?body=${encodeURIComponent(message)}`;
        showNotification(`Opening SMS to ${contactName}...`, 'info');
    }
}

// Open import modal
function openImportModal() {
    document.getElementById('importModal').classList.add('active');
    document.getElementById('importPreview').style.display = 'none';
    document.getElementById('importConfirmBtn').style.display = 'none';
    document.getElementById('excelFileInput').value = '';
    importedData = [];
}

// Close import modal
function closeImportModal() {
    document.getElementById('importModal').classList.remove('active');
    importedData = [];
}

// Download template
function downloadTemplate() {
    const template = [
        ['Lead Name', 'Contact Person', 'Contact Number', 'Deal Value', 'Stage', 'Source', 'Priority', 'Company', 'Email', 'Job Title', 'Website', 'LinkedIn', 'Industry', 'Notes'],
        ['Website Redesign', 'John Doe', '+1-555-0001', '50000', 'New Lead', 'Website Form', 'Hot', 'Tech Corp', 'john@techcorp.com', 'CEO', 'https://techcorp.com', 'https://linkedin.com/in/johndoe', 'Technology', 'Interested in modern design'],
        ['Mobile App', 'Jane Smith', '+1-555-0002', '75000', 'Qualified', 'Referral', 'Warm', 'Startup Inc', 'jane@startup.com', 'CTO', 'https://startup.com', 'https://linkedin.com/in/janesmith', 'Software', 'iOS and Android app needed']
    ];

    const csv = template.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    showNotification('Template downloaded successfully!', 'success');
}

// Handle file select
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        processFile(file);
    }
}

// Handle file drop
function handleFileDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    document.getElementById('uploadZone').classList.remove('drag-over');

    const file = event.dataTransfer.files[0];
    if (file) {
        processFile(file);
    }
}

// Handle drag over
function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    document.getElementById('uploadZone').classList.add('drag-over');
}

// Handle drag leave
function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    document.getElementById('uploadZone').classList.remove('drag-over');
}

// Process file
function processFile(file) {
    const fileName = file.name.toLowerCase();
    const fileType = fileName.split('.').pop();

    if (!['csv', 'xlsx', 'xls'].includes(fileType)) {
        showNotification('Please upload a valid Excel (.xlsx, .xls) or CSV file', 'error');
        return;
    }

    showNotification('Processing file...', 'info');

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        parseCSV(text);
    };
    reader.readAsText(file);
}

// Parse CSV
function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
        showNotification('File is empty or invalid', 'error');
        return;
    }

    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    importedData = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
        const lead = {
            id: generateId(),
            name: values[0] || 'Unnamed Lead',
            contact: values[1] || '',
            phone: values[2] || '',
            value: parseFloat(values[3]) || 0,
            stage: values[4] || 'New Lead',
            source: values[5] || 'Manual Entry',
            priority: values[6] || 'Warm',
            company: values[7] || '',
            email: values[8] || '',
            jobTitle: values[9] || '',
            website: values[10] || '',
            linkedin: values[11] || '',
            industry: values[12] || '',
            notes: values[13] || '',
            createdAt: new Date().toISOString()
        };
        importedData.push(lead);
    }

    displayImportPreview();
}

// Display import preview
function displayImportPreview() {
    if (importedData.length === 0) {
        showNotification('No valid data found in file', 'error');
        return;
    }

    document.getElementById('previewCount').textContent = importedData.length;
    document.getElementById('importPreview').style.display = 'block';
    document.getElementById('importConfirmBtn').style.display = 'flex';

    const thead = document.getElementById('previewTableHead');
    const tbody = document.getElementById('previewTableBody');

    thead.innerHTML = `
        <tr>
            <th>Lead Name</th>
            <th>Contact</th>
            <th>Phone</th>
            <th>Value</th>
            <th>Stage</th>
            <th>Priority</th>
        </tr>
    `;

    tbody.innerHTML = importedData.slice(0, 10).map(lead => `
        <tr>
            <td>${escapeHtml(lead.name)}</td>
            <td>${escapeHtml(lead.contact)}</td>
            <td>${lead.phone}</td>
            <td>${formatCurrency(lead.value)}</td>
            <td><span class="stage-badge stage-${lead.stage.toLowerCase().replace(' ', '-')}">${lead.stage}</span></td>
            <td><span class="priority-badge priority-${lead.priority.toLowerCase()}">${lead.priority}</span></td>
        </tr>
    `).join('');

    if (importedData.length > 10) {
        tbody.innerHTML += `<tr><td colspan="6" style="text-align: center; color: #64748b; font-style: italic;">... and ${importedData.length - 10} more leads</td></tr>`;
    }

    showNotification(`Found ${importedData.length} leads ready to import`, 'success');
}

// Confirm import
function confirmImport() {
    if (importedData.length === 0) {
        showNotification('No data to import', 'error');
        return;
    }

    leads.push(...importedData);
    saveLeads();
    closeImportModal();
    filterLeads();
    showNotification(`Successfully imported ${importedData.length} leads!`, 'success');
}

// Open add lead modal
function openAddLeadModal() {
    currentLeadId = null;
    document.getElementById('modalTitle').textContent = 'Add New Lead';
    document.getElementById('leadForm').reset();
    document.getElementById('leadId').value = '';
    document.getElementById('leadModal').classList.add('active');
}

// Close lead modal
function closeLeadModal() {
    document.getElementById('leadModal').classList.remove('active');
}

// Save lead
function saveLead(event) {
    event.preventDefault();

    const lead = {
        id: document.getElementById('leadId').value || generateId(),
        name: document.getElementById('leadName').value,
        company: document.getElementById('leadCompany').value,
        contact: document.getElementById('leadContact').value,
        jobTitle: document.getElementById('leadJobTitle').value,
        email: document.getElementById('leadEmail').value,
        phone: document.getElementById('leadPhone').value,
        website: document.getElementById('leadWebsite').value,
        linkedin: document.getElementById('leadLinkedin').value,
        value: parseFloat(document.getElementById('leadValue').value) || 0,
        stage: document.getElementById('leadStage').value,
        source: document.getElementById('leadSource').value,
        priority: document.getElementById('leadPriority').value,
        industry: document.getElementById('leadIndustry').value,
        notes: document.getElementById('leadNotes').value,
        createdAt: document.getElementById('leadId').value ?
            leads.find(l => l.id === document.getElementById('leadId').value)?.createdAt :
            new Date().toISOString()
    };

    const existingIndex = leads.findIndex(l => l.id === lead.id);
    if (existingIndex >= 0) {
        leads[existingIndex] = lead;
        showNotification('Lead updated successfully!', 'success');
    } else {
        leads.unshift(lead);
        showNotification('Lead added successfully!', 'success');
    }

    saveLeads();
    closeLeadModal();
    filterLeads();
}

// Edit lead
function editLead(id) {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;

    currentLeadId = id;
    document.getElementById('modalTitle').textContent = 'Edit Lead';
    document.getElementById('leadId').value = lead.id;
    document.getElementById('leadName').value = lead.name;
    document.getElementById('leadCompany').value = lead.company || '';
    document.getElementById('leadContact').value = lead.contact || '';
    document.getElementById('leadJobTitle').value = lead.jobTitle || '';
    document.getElementById('leadEmail').value = lead.email || '';
    document.getElementById('leadPhone').value = lead.phone || '';
    document.getElementById('leadWebsite').value = lead.website || '';
    document.getElementById('leadLinkedin').value = lead.linkedin || '';
    document.getElementById('leadValue').value = lead.value;
    document.getElementById('leadStage').value = lead.stage;
    document.getElementById('leadSource').value = lead.source;
    document.getElementById('leadPriority').value = lead.priority;
    document.getElementById('leadIndustry').value = lead.industry || '';
    document.getElementById('leadNotes').value = lead.notes || '';

    document.getElementById('leadModal').classList.add('active');
}

// View lead details
function viewLeadDetails(id) {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;

    currentLeadId = id;
    document.getElementById('detailsTitle').textContent = lead.name;
    document.getElementById('detailsStage').textContent = lead.stage;
    document.getElementById('detailsStage').className = `detail-badge stage-badge stage-${lead.stage.toLowerCase().replace(' ', '-')}`;

    document.getElementById('detailCompany').textContent = lead.company || '-';
    document.getElementById('detailContact').textContent = lead.contact || '-';
    document.getElementById('detailJobTitle').textContent = lead.jobTitle || '-';
    document.getElementById('detailIndustry').textContent = lead.industry || '-';
    document.getElementById('detailEmail').textContent = lead.email || '-';
    document.getElementById('detailPhone').textContent = lead.phone || '-';
    document.getElementById('detailWebsite').textContent = lead.website || '-';
    document.getElementById('detailLinkedin').textContent = lead.linkedin || '-';
    document.getElementById('detailValue').textContent = formatCurrency(lead.value);
    document.getElementById('detailStage').textContent = lead.stage;
    document.getElementById('detailSource').textContent = lead.source;
    document.getElementById('detailPriority').textContent = lead.priority;
    document.getElementById('detailNotes').textContent = lead.notes || 'No notes available';

    document.getElementById('detailsModal').classList.add('active');
}

// Close details modal
function closeDetailsModal() {
    document.getElementById('detailsModal').classList.remove('active');
}

// Edit current lead
function editCurrentLead() {
    closeDetailsModal();
    editLead(currentLeadId);
}

// Delete lead
function deleteLead() {
    if (!currentLeadId) return;

    if (confirm('Are you sure you want to delete this lead? This action cannot be undone.')) {
        leads = leads.filter(l => l.id !== currentLeadId);
        saveLeads();
        closeDetailsModal();
        filterLeads();
        showNotification('Lead deleted successfully!', 'success');
    }
}

// Export leads
function exportLeads() {
    const csv = [
        ['Lead Name', 'Company', 'Contact', 'Phone', 'Email', 'Value', 'Stage', 'Source', 'Priority', 'Industry', 'Created Date']
    ];

    filteredLeads.forEach(lead => {
        csv.push([
            lead.name,
            lead.company || '',
            lead.contact || '',
            lead.phone || '',
            lead.email || '',
            lead.value,
            lead.stage,
            lead.source,
            lead.priority,
            lead.industry || '',
            new Date(lead.createdAt).toLocaleDateString()
        ]);
    });

    const csvContent = csv.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showNotification('Leads exported successfully!', 'success');
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show notification
function showNotification(message, type = 'success') {
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        info: '#3b82f6',
        warning: '#f59e0b'
    };

    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type]};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        font-weight: 500;
        max-width: 400px;
    `;
    notification.textContent = message;

    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// Close modals on outside click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});


// Example leads for testing
leads = [
    {
        id: generateId(),
        name: 'Website Redesign',
        company: 'Tech Corp',
        contact: 'John Smith',
        jobTitle: 'CEO',
        email: 'john@techcorp.com',
        phone: '+1-555-0101',
        website: 'https://techcorp.com',
        linkedin: 'https://linkedin.com/in/johnsmith',
        value: 45000,
        stage: 'New Lead',
        source: 'Website Form',
        priority: 'Hot',
        industry: 'Technology',
        notes: 'Interested in complete website overhaul with modern design',
        createdAt: new Date().toISOString()
    },
    {
        id: generateId(),
        name: 'Cloud Migration',
        company: 'Global Industries',
        contact: 'Sarah Johnson',
        jobTitle: 'CTO',
        email: 'sarah@globalind.com',
        phone: '+1-555-0102',
        website: 'https://globalind.com',
        linkedin: 'https://linkedin.com/in/sarahjohnson',
        value: 120000,
        stage: 'Qualified',
        source: 'Google Ads',
        priority: 'Warm',
        industry: 'Manufacturing',
        notes: 'Moving 50+ servers to cloud infrastructure',
        createdAt: new Date(Date.now() - 86400000).toISOString() // yesterday
    },
    {
        id: generateId(),
        name: 'Mobile App Development',
        company: 'StartupXYZ',
        contact: 'Mike Chen',
        jobTitle: 'Product Manager',
        email: 'mike@startupxyz.com',
        phone: '+1-555-0103',
        website: 'https://startupxyz.com',
        linkedin: 'https://linkedin.com/in/mikechen',
        value: 85000,
        stage: 'Proposal',
        source: 'Referral',
        priority: 'Hot',
        industry: 'Healthcare',
        notes: 'iOS and Android apps for e-commerce platform',
        createdAt: new Date(Date.now() - 172800000).toISOString() // 2 days ago
    },
    {
        id: generateId(),
        name: 'ERP Implementation',
        company: 'Manufacturing Co',
        contact: 'Lisa Anderson',
        jobTitle: 'Operations Director',
        email: 'lisa@mfgco.com',
        phone: '+1-555-0104',
        website: 'https://mfgco.com',
        linkedin: 'https://linkedin.com/in/lisaanderson',
        value: 250000,
        stage: 'Negotiation',
        source: 'Meta Ads',
        priority: 'Hot',
        industry: 'Retail',
        notes: 'ERP system for 500+ users',
        createdAt: new Date(Date.now() - 259200000).toISOString() // 3 days ago
    },
    {
        id: generateId(),
        name: 'Security Audit',
        company: 'Finance Plus',
        contact: 'David Brown',
        jobTitle: 'CISO',
        email: 'david@financeplus.com',
        phone: '+1-555-0105',
        website: 'https://financeplus.com',
        linkedin: 'https://linkedin.com/in/davidbrown',
        value: 35000,
        stage: 'Closed Won',
        source: 'External API',
        priority: 'Warm',
        industry: 'Finance',
        notes: 'Completed comprehensive security review and penetration testing',
        createdAt: new Date(Date.now() - 604800000).toISOString() // 1 week ago
    }
];

saveLeads();
filteredLeads = [...leads];
