// Data storage
let leads = []
let filteredLeads = []
let currentLeadId = null
let currentView = "list"
let sortColumn = ""
let sortDirection = "asc"
const selectedLeads = new Set()
let importedData = []
let notifications = []
const MAX_NOTIFICATIONS = 20

// Data structures for column mapping
let importedRawData = [] // Raw parsed data from file
let columnMapping = {} // Maps file columns to database fields
let fileHeaders = [] // Headers from the imported file

// List of available database fields for mapping
const AVAILABLE_FIELDS = [
  { value: "name", label: "Name", required: true, description: "Lead's full name" },
  { value: "phone", label: "Phone / Number", required: true, description: "Contact phone number" },
  { value: "email", label: "Email", required: false, description: "Email address (optional)" },
  { value: "city", label: "City", required: false, description: "City or location (optional)" },
  { value: "value", label: "Value / Deal Value", required: false, description: "Deal value (defaults to 0)" },
  {
    value: "source",
    label: "Source / Lead Source",
    required: false,
    description: "Lead source (defaults to Manual Entry)",
  },
  { value: "stage", label: "Stage / Status", required: false, description: "Lead stage (defaults to New Lead)" },
  {
    value: "priority",
    label: "Priority / Priority Level",
    required: false,
    description: "Priority level (defaults to Warm)",
  },
  { value: "company", label: "Company / Organization", required: false, description: "Company name (optional)" },
  { value: "notes", label: "Notes / Comments", required: false, description: "Additional notes (optional)" },
  { value: "project", label: "Project", required: false, description: "Associated project" },
  {
    value: "leadStatus",
    label: "Lead Status",
    required: false,
    description: "Current status of the lead (e.g., Active, Inactive, Paused)",
  },
  {
    value: "nextFollow",
    label: "Next Follow Up (Action)",
    required: false,
    description: "Brief description of the next follow-up action",
  },
  {
    value: "nextFollowDate",
    label: "Next Follow Up Date",
    required: false,
    description: "Date and time for the next follow-up",
  },
]

// Initialize app
document.addEventListener("DOMContentLoaded", () => {
  loadLeads()
  renderLeads()
  updateStats()
  loadCallersForAssignment()
  loadNotifications()
})

function deduplicateLeadsByPhone(leadsArray) {
  if (!Array.isArray(leadsArray)) return leadsArray

  const seenPhones = new Map()
  const deduped = []

  for (const lead of leadsArray) {
    const phone = (lead.phone || "").trim()

    if (!phone) {
      // Keep leads without phone numbers
      deduped.push(lead)
      continue
    }

    // Extract digits only for comparison (handles different formatting)
    const phoneDigits = phone.replace(/[^0-9]/g, "")

    if (!seenPhones.has(phoneDigits)) {
      seenPhones.set(phoneDigits, lead.id)
      deduped.push(lead)
    } else {
      console.log(
        `[v0] Skipping duplicate lead: "${lead.name}" (${phone}) - already have ID: ${seenPhones.get(phoneDigits)}`,
      )
    }
  }

  console.log(`[v0] Deduplication: ${leadsArray.length} leads → ${deduped.length} leads`)
  return deduped
}

// Load leads from localStorage
function loadLeads() {
  fetch("/api/leads")
    .then((r) => r.json())
    .then((data) => {
      if (data && data.success && Array.isArray(data.leads)) {
        leads = deduplicateLeadsByPhone(data.leads)
        saveLeads()
        filteredLeads = [...leads]
        renderLeads()
      } else {
        const stored = localStorage.getItem("crm_leads")
        if (stored) {
          leads = deduplicateLeadsByPhone(JSON.parse(stored))
        } else {
          leads = deduplicateLeadsByPhone(generateSampleData())
          saveLeads()
        }
        filteredLeads = [...leads]
        renderLeads()
      }
    })
    .catch((err) => {
      const stored = localStorage.getItem("crm_leads")
      if (stored) {
        leads = deduplicateLeadsByPhone(JSON.parse(stored))
      } else {
        leads = deduplicateLeadsByPhone(generateSampleData())
        saveLeads()
      }
      filteredLeads = [...leads]
      renderLeads()
    })
}

// Generate sample data
function generateSampleData() {
  return [
    {
      id: generateId(),
      name: "John Smith",
      phone: "+1-555-0101",
      email: "john@example.com",
      city: "New York",
      value: 45000,
      source: "Website Form",
      stage: "New Lead",
      priority: "Hot",
      project: "E-commerce Platform",
      leadStatus: "Active",
      nextFollow: "Discuss pricing",
      nextFollowDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
      assignedCaller: null,
      assignedCallerName: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId(),
      name: "Sarah Johnson",
      phone: "+1-555-0102",
      email: "sarah@example.com",
      city: "Los Angeles",
      value: 75000,
      source: "Google Ads",
      stage: "Qualified",
      priority: "Hot",
      project: "Mobile App Development",
      leadStatus: "Active",
      nextFollow: "Send proposal",
      nextFollowDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day from now
      assignedCaller: null,
      assignedCallerName: null,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: generateId(),
      name: "Mike Chen",
      phone: "+1-555-0103",
      email: "mike@example.com",
      city: "Chicago",
      value: 32000,
      source: "Referral",
      stage: "Proposal",
      priority: "Warm",
      project: "Website Redesign",
      leadStatus: "Paused",
      nextFollow: "Check-in",
      nextFollowDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
      assignedCaller: null,
      assignedCallerName: null,
      createdAt: new Date(Date.now() - 172800000).toISOString(),
    },
  ]
}

// Save leads to localStorage
function saveLeads() {
  localStorage.setItem("crm_leads", JSON.stringify(leads))
}

// Generate unique ID
function generateId() {
  return "lead_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
}

// Render leads
function renderLeads() {
  if (currentView === "list") {
    renderTableView()
  } else {
    renderGridView()
  }
  updateStats()
}

// Render table view
function renderTableView() {
  const tbody = document.getElementById("leadsTableBody")
  const emptyState = document.getElementById("emptyState")

  if (filteredLeads.length === 0) {
    tbody.innerHTML = ""
    emptyState.style.display = "block"
    return
  }

  emptyState.style.display = "none"

  tbody.innerHTML = filteredLeads
    .map(
      (lead, index) => `
        <tr>
            
            <td>
                <input type="checkbox" class="lead-checkbox" value="${lead.id}" onchange="handleLeadSelection('${lead.id}', this.checked)">
            </td>
            <!-- Added SR NO. cell as first column showing row index -->
            <td style="text-align: center; font-weight: 500; color: #64748b;">
                ${index + 1}
            </td>
            <td class="lead-name-cell" onclick="viewLeadDetails('${lead.id}')" style="cursor: pointer;">
                ${escapeHtml(lead.name)}
            </td>
            <td class="phone-cell">
                <span class="phone-number" onclick="copyPhoneNumber('${lead.phone || "-"}')" title="Click to copy">
                    ${lead.phone || "-"}
                </span>
                ${lead.phone ? `<button class="btn-copy" onclick="copyPhoneNumber('${lead.phone}')" title="Copy number"></button>` : ""}
            </td>
            <td>${escapeHtml(lead.email || "-")}</td>
            <td>${escapeHtml(lead.city || "-")}</td>
            <td>${lead.assignedCallerName ? `<span style="background: #e0e7ff; color: #4c51bf; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">${escapeHtml(lead.assignedCallerName)}</span>` : '<span style="color: #cbd5e1;">Not Assigned</span>'}</td>
            <td><span class="source-badge">${lead.source}</span></td>
            <td>
                <select class="inline-select stage-select stage-${lead.stage.toLowerCase().replace(" ", "-")}"
                        onchange="updateLeadStage('${lead.id}', this.value)">
                    <option value="New Lead" ${lead.stage === "New Lead" ? "selected" : ""}>New Lead</option>
                    <option value="Qualified" ${lead.stage === "Qualified" ? "selected" : ""}>Qualified</option>
                    <option value="Proposal" ${lead.stage === "Proposal" ? "selected" : ""}>Proposal</option>
                    <option value="Negotiation" ${lead.stage === "Negotiation" ? "selected" : ""}>Negotiation</option>
                    <option value="Closed Won" ${lead.stage === "Closed Won" ? "selected" : ""}>Closed Won</option>
                    <option value="Closed Lost" ${lead.stage === "Closed Lost" ? "selected" : ""}>Closed Lost</option>
                </select>
            </td>
            <td>
                <select class="inline-select priority-select priority-${lead.priority.toLowerCase()}"
                        onchange="updateLeadPriority('${lead.id}', this.value)">
                    <option value="Hot" ${lead.priority === "Hot" ? "selected" : ""}>Hot</option>
                    <option value="Warm" ${lead.priority === "Warm" ? "selected" : ""}>Warm</option>
                    <option value="Cold" ${lead.priority === "Cold" ? "selected" : ""}>Cold</option>
                </select>
            </td>
            <td>${formatDateDDMMYYYY(lead.createdAt)}</td>
            <td>${escapeHtml(lead.project || "-")}</td>
            <td>
                <span class="status-badge ${(lead.leadStatus || "").toLowerCase().replace(/\s+/g, "-")}" style="padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; background: ${
                  lead.leadStatus === "Active"
                    ? "#e0f2fe"
                    : lead.leadStatus === "Inactive"
                      ? "#f3e8ff"
                      : lead.leadStatus === "Not Interested"
                        ? "#fecaca" // Red for Not Interested
                        : lead.leadStatus === "Paused"
                          ? "#fef3c7"
                          : "#f1f5f9"
                }; color: ${
                  lead.leadStatus === "Active"
                    ? "#0369a1"
                    : lead.leadStatus === "Inactive"
                      ? "#6b21a8"
                      : lead.leadStatus === "Not Interested"
                        ? "#991b1b" // Dark red for Not Interested
                        : lead.leadStatus === "Paused"
                          ? "#92400e"
                          : "#334155"
                };">
                ${lead.leadStatus || "-"}
                </span>
            </td>
            <td>${escapeHtml(lead.nextFollow || "-")}</td>
            <td>${lead.nextFollowDate ? new Date(lead.nextFollowDate).toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}</td>
            <td class="contact-actions">
                ${
                  lead.phone
                    ? `
                  <button class="btn-icon" onclick="makeCall('${lead.phone}', '${escapeHtml(lead.name)}')" title="Call">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                  </button>
                  <button class="btn-icon" onclick="sendWhatsApp('${lead.phone}', '${escapeHtml(lead.name)}')" title="WhatsApp" style="color: var(--whatsapp-green);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.004a9.87 9.87 0 00-4.782 1.13c-1.88 1.045-3.517 2.632-4.602 4.622-1.089 2.006-1.387 4.227-.786 6.323.601 2.097 1.886 3.894 3.592 5.101 1.706 1.207 3.8 1.684 5.898 1.35 2.099-.334 4.012-1.453 5.357-3.05 1.345-1.596 1.978-3.644 1.78-5.698-.199-2.053-1.249-3.946-2.881-5.207-1.632-1.262-3.804-1.738-5.876-1.272-.494.105-.972.287-1.417.536z"/>
                    </svg>
                  </button>
                `
                    : '<span style="color: #94a3b8;">-</span>'
                }
            </td>
            <td class="">
                <button class="btn-small btn-edit" onclick="editLead('${lead.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    Edit
                </button>
            </td>
        </tr>
    `,
    )
    .join("")
}

// Render grid view
function renderGridView() {
  const gridContainer = document.getElementById("gridView")

  if (filteredLeads.length === 0) {
    gridContainer.innerHTML = '<div class="empty-state"><p>No leads found</p></div>'
    return
  }

  gridContainer.innerHTML = filteredLeads
    .map(
      (lead) => `
        <div class="lead-card" onclick="viewLeadDetails('${lead.id}')" style="cursor: pointer;">
            <div class="lead-card-header">
                <div>
                    <div class="lead-card-title">${escapeHtml(lead.name)}</div>
                    <div class="lead-card-company">${escapeHtml(lead.city || "-")}</div>
                </div>
                <div class="lead-card-value">${formatCurrency(lead.value)}</div>
            </div>
            <div class="lead-card-body">
                <div class="lead-card-info">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                    ${lead.phone || "-"}
                </div>
                <div class="lead-card-info">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                        <polyline points="22,6 12,13 2,6"></polyline>
                    </svg>
                    ${lead.email || "-"}
                </div>
            </div>
            <div class="lead-card-footer">
                <span class="stage-badge stage-${lead.stage.toLowerCase().replace(" ", "-")}">${lead.stage}</span>
                <span class="priority-badge priority-${lead.priority.toLowerCase()}">${lead.priority}</span>
                ${lead.assignedCallerName ? `<span class="assigned-badge" style="background: #e0e7ff; color: #4c51bf; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">${escapeHtml(lead.assignedCallerName)}</span>` : ""}
                <span class="project-badge">${escapeHtml(lead.project || "-")}</span>
                <span class="status-badge status-${(lead.leadStatus || "").toLowerCase().replace(/\s+/g, "-")}" style="background: ${
                  lead.leadStatus === "Active"
                    ? "#e0f2fe"
                    : lead.leadStatus === "Inactive"
                      ? "#f3e8ff"
                      : lead.leadStatus === "Paused"
                        ? "#fef3c7"
                        : lead.leadStatus === "Not Interested"
                          ? "#fecaca" // Red for Not Interested
                          : "#f1f5f9"
                }; color: ${
                  lead.leadStatus === "Active"
                    ? "#0369a1"
                    : lead.leadStatus === "Inactive"
                      ? "#6b21a8"
                      : lead.leadStatus === "Paused"
                        ? "#92400e"
                        : lead.leadStatus === "Not Interested"
                          ? "#b91c1c" // Dark red for Not Interested
                          : "#334155"
                };">${escapeHtml(lead.leadStatus || "-")}</span>
            </div>
        </div>
    `,
    )
    .join("")
}

// Toggle view
function toggleView(view) {
  currentView = view
  document.getElementById("listView").style.display = view === "list" ? "block" : "none"
  document.getElementById("gridView").style.display = view === "grid" ? "block" : "none"
  document.getElementById("listViewBtn").classList.toggle("active", view === "list")
  document.getElementById("gridViewBtn").classList.toggle("active", view === "grid")
  renderLeads()
}

// Filter leads
function filterLeads() {
  const searchTerm = document.getElementById("searchInput").value.toLowerCase()
  const stageFilter = document.getElementById("filterStage").value
  const sourceFilter = document.getElementById("filterSource").value
  const priorityFilter = document.getElementById("filterPriority").value
  const callerFilter = document.getElementById("filterCaller").value
  const projectFilter = document.getElementById("filterProject").value
  const statusFilter = document.getElementById("filterLeadStatus").value
  const nextFollowFilter = document.getElementById("filterNextFollow").value

  const unfilteredLeads = deduplicateLeadsByPhone(leads)

  filteredLeads = unfilteredLeads.filter((lead) => {
    const matchesSearch =
      !searchTerm ||
      lead.name.toLowerCase().includes(searchTerm) ||
      (lead.city && lead.city.toLowerCase().includes(searchTerm)) ||
      (lead.email && lead.email.toLowerCase().includes(searchTerm)) ||
      (lead.phone && lead.phone.toLowerCase().includes(searchTerm)) ||
      (lead.project && lead.project.toLowerCase().includes(searchTerm)) ||
      (lead.leadStatus && lead.leadStatus.toLowerCase().includes(searchTerm)) ||
      (lead.nextFollow && lead.nextFollow.toLowerCase().includes(searchTerm))

    const matchesStage = !stageFilter || lead.stage === stageFilter
    const matchesSource = !sourceFilter || lead.source === sourceFilter
    const matchesPriority = !priorityFilter || lead.priority === priorityFilter
    const matchesCaller = !callerFilter || lead.assignedCallerName === callerFilter
    const matchesProject = !projectFilter || lead.project === projectFilter
    const matchesStatus = !statusFilter || lead.leadStatus === statusFilter
    const matchesNextFollow = !nextFollowFilter || lead.nextFollow === nextFollowFilter

    return (
      matchesSearch &&
      matchesStage &&
      matchesSource &&
      matchesPriority &&
      matchesCaller &&
      matchesProject &&
      matchesStatus &&
      matchesNextFollow
    )
  })

  renderLeads()
}

// Clear filters
function clearFilters() {
  document.getElementById("searchInput").value = ""
  document.getElementById("filterStage").value = ""
  document.getElementById("filterSource").value = ""
  document.getElementById("filterPriority").value = ""
  document.getElementById("filterCaller").value = ""
  document.getElementById("filterProject").value = ""
  document.getElementById("filterLeadStatus").value = ""
  document.getElementById("filterNextFollow").value = ""
  filterLeads()
}

// Sort table
function sortTable(column) {
  if (sortColumn === column) {
    sortDirection = sortDirection === "asc" ? "desc" : "asc"
  } else {
    sortColumn = column
    sortDirection = "asc"
  }

  filteredLeads.sort((a, b) => {
    let aVal = a[column]
    let bVal = b[column]

    if (column === "value") {
      aVal = Number.parseFloat(aVal) || 0
      bVal = Number.parseFloat(bVal) || 0
    } else if (column === "createdAt" || column === "nextFollowDate") {
      aVal = new Date(a.createdAt || a.nextFollowDate)
      bVal = new Date(b.createdAt || b.nextFollowDate)
    } else {
      aVal = String(aVal || "").toLowerCase()
      bVal = String(bVal || "").toLowerCase()
    }

    if (sortDirection === "asc") {
      return aVal > bVal ? 1 : -1
    } else {
      return aVal < bVal ? 1 : -1
    }
  })

  renderLeads()
}

// Update stats
function updateStats() {
  const today = new Date().toDateString()
  const newToday = leads.filter((l) => new Date(l.createdAt).toDateString() === today).length
  const hotLeads = leads.filter((l) => l.priority === "Hot").length
  const totalValue = leads.reduce((sum, l) => sum + (l.value || 0), 0)
  const activeLeads = leads.filter((l) => l.leadStatus === "Active").length

  document.getElementById("totalLeads").textContent = leads.length
  document.getElementById("newToday").textContent = newToday
  document.getElementById("hotLeads").textContent = hotLeads
  document.getElementById("totalValue").textContent = formatCurrency(totalValue)
}

// Handle lead selection
function handleLeadSelection(leadId, checked) {
  if (checked) {
    selectedLeads.add(leadId)
  } else {
    selectedLeads.delete(leadId)
  }
  updateBulkDeleteButton()
}

// Toggle select all
function toggleSelectAll() {
  const selectAll = document.getElementById("selectAll")
  const checkboxes = document.querySelectorAll(".lead-checkbox")

  checkboxes.forEach((checkbox) => {
    checkbox.checked = selectAll.checked
    handleLeadSelection(checkbox.value, selectAll.checked)
  })
}

// Update bulk delete button
function updateBulkDeleteButton() {
  const bulkDeleteBtn = document.getElementById("bulkDeleteBtn")
  const deleteCountSpan = bulkDeleteBtn.querySelector("span:nth-child(2)")

  if (selectedLeads.size > 0) {
    bulkDeleteBtn.style.display = "flex"
    deleteCountSpan.textContent = `Delete Selected (${selectedLeads.size})`
  } else {
    bulkDeleteBtn.style.display = "none"
  }
}

// Bulk delete leads
async function bulkDeleteLeads() {
  if (selectedLeads.size === 0) return

  const idsToDelete = Array.from(selectedLeads)
  const count = idsToDelete.length

  if (!confirm(`Are you sure you want to delete ${count} lead(s)? This action cannot be undone.`)) return

  const backupLeads = [...leads]

  // Optimistic removal locally
  leads = leads.filter((lead) => !selectedLeads.has(lead.id))
  saveLeads()
  selectedLeads.clear()
  document.getElementById("selectAll").checked = false
  filterLeads()
  updateBulkDeleteButton()
  addNotification(`${count} lead(s) deleted`, "warning", null)
  showNotification(`Deleting ${count} lead(s)...`, "info")

  try {
    const res = await fetch("/api/leads/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ ids: idsToDelete }),
    })

    const text = await res.text()
    let body = null
    try {
      body = JSON.parse(text)
    } catch (e) {
      body = text
    }

    if (!res.ok) {
      leads = backupLeads
      saveLeads()
      filterLeads()
      showNotification(`Server error deleting leads: ${body && body.error ? body.error : res.status}`, "error")
      console.warn("Bulk delete failed:", res.status, body)
      return
    }

    showNotification(`Deleted ${count} lead(s) on server.`, "success")
  } catch (err) {
    leads = backupLeads
    saveLeads()
    filterLeads()
    showNotification("Network error — could not delete selected leads on server. Local changes restored.", "error")
    console.error("Bulk delete error:", err)
  }
}

// Copy phone number
function copyPhoneNumber(phone) {
  if (!phone || phone === "-") {
    showNotification("No phone number to copy", "error")
    return
  }

  navigator.clipboard
    .writeText(phone)
    .then(() => {
      showNotification(`Phone number ${phone} copied to clipboard!`, "success")
    })
    .catch(() => {
      const textarea = document.createElement("textarea")
      textarea.value = phone
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
      showNotification(`Phone number ${phone} copied to clipboard!`, "success")
    })
}

// Make call
function makeCall(phone, contactName) {
  if (!phone || phone === "-") {
    showNotification("No phone number available", "error")
    return
  }

  if (confirm(`Do you want to call ${contactName} at ${phone}?`)) {
    window.location.href = `tel:${phone}`
    showNotification(`Initiating call to ${contactName}...`, "info")
  }
}

// Send WhatsApp message
function sendWhatsApp(phone, contactName) {
  if (!phone || phone === "-") {
    showNotification("No phone number available", "error")
    return
  }

  const cleanPhone = phone.replace(/[^0-9]/g, "")
  const whatsappUrl = `https://wa.me/${cleanPhone}`
  window.open(whatsappUrl, "_blank")
  showNotification(`Opening WhatsApp chat with ${contactName}...`, "success")
}

// Update lead stage
async function updateLeadStage(leadId, newStage) {
  const lead = leads.find((l) => l.id === leadId)
  if (!lead) return

  const oldStage = lead.stage
  lead.stage = newStage
  saveLeads()
  renderLeads()
  addNotification(`Lead "${lead.name}" moved to "${newStage}"`, "info", lead.name)

  try {
    const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.JSON.stringify({ stage: newStage }),
    })
    if (!res.ok) throw new Error(`Server returned ${res.status}`)
    showNotification(`Stage updated from "${oldStage}" to "${newStage}"`, "success")
  } catch (err) {
    showNotification("Could not update stage on server — change saved locally.", "warning")
    console.warn("updateLeadStage failed:", err)
  }
}

// Update lead priority
async function updateLeadPriority(leadId, newPriority) {
  const lead = leads.find((l) => l.id === leadId)
  if (!lead) return

  const oldPriority = lead.priority
  lead.priority = newPriority
  saveLeads()
  renderLeads()
  addNotification(`Lead "${lead.name}" priority changed to "${newPriority}"`, "info", lead.name)

  try {
    const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority: newPriority }),
    })
    if (!res.ok) throw new Error(`Server returned ${res.status}`)
    showNotification(`Priority updated from "${oldPriority}" to "${newPriority}"`, "success")
  } catch (err) {
    showNotification("Could not update priority on server — change saved locally.", "warning")
    console.warn("updateLeadPriority failed:", err)
  }
}

// Open import modal
function openImportModal() {
  document.getElementById("importModal").classList.add("active")
  document.getElementById("uploadStep").style.display = "block"
  document.getElementById("mappingStep").style.display = "none"
  document.getElementById("previewStep").style.display = "none"

  document.getElementById("uploadStepBtns").style.display = "flex"
  document.getElementById("mappingStepBtns").style.display = "none"
  document.getElementById("previewStepBtns").style.display = "none"

  document.getElementById("excelFileInput").value = ""
  document.querySelectorAll('input[name="importSource"]').forEach((radio) => (radio.checked = false))
  importedData = []
  importedRawData = []
  columnMapping = {}
  fileHeaders = []
}

// Close import modal
function closeImportModal() {
  document.getElementById("importModal").classList.remove("active")
  importedData = []
  importedRawData = []
  columnMapping = {}
  fileHeaders = []
}

// Download template
function downloadTemplate() {
  const template = [
    [
      "Name",
      "Number",
      "Email",
      "City",
      "Value",
      "Source",
      "Stage",
      "Priority",
      "Project",
      "Lead Status",
      "Next Follow",
      "Next Follow Date",
    ],
    [
      "John Doe",
      "+1-555-0001",
      "john@example.com",
      "New York",
      "50000",
      "Website Form",
      "New Lead",
      "Hot",
      "Project Alpha",
      "Active",
      "Follow up call",
      "2023-12-31T10:00:00Z",
    ],
    [
      "Jane Smith",
      "+1-555-0002",
      "jane@example.com",
      "Los Angeles",
      "75000",
      "Referral",
      "Qualified",
      "Warm",
      "Project Beta",
      "Active",
      "Send proposal",
      "2023-12-30T14:30:00Z",
    ],
  ]

  const csv = template.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "leads_import_template.csv"
  a.click()
  window.URL.revokeObjectURL(url)
  showNotification("Template downloaded successfully!", "success")
}

// Handle file select
function handleFileSelect(event) {
  const file = event.target.files[0]
  if (file) {
    processFile(file)
  }
}

// Handle file drop
function handleFileDrop(event) {
  event.preventDefault()
  event.stopPropagation()
  document.getElementById("uploadZone").classList.remove("drag-over")

  const file = event.dataTransfer.files[0]
  if (file) {
    processFile(file)
  }
}

// Handle drag over
function handleDragOver(event) {
  event.preventDefault()
  event.stopPropagation()
  document.getElementById("uploadZone").classList.add("drag-over")
}

// Handle drag leave
function handleDragLeave(event) {
  event.preventDefault()
  event.stopPropagation()
  document.getElementById("uploadZone").classList.remove("drag-over")
}

// Process file
function processFile(file) {
  const fileName = file.name.toLowerCase()
  const fileType = fileName.split(".").pop()

  if (!["csv", "xlsx", "xls"].includes(fileType)) {
    showNotification("Please upload a valid Excel (.xlsx, .xls) or CSV file", "error")
    return
  }

  showNotification("Processing file...", "info")

  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target.result
    parseCSV(text)
  }
  reader.readAsText(file)
}

// Parse CSV
function parseCSV(text) {
  const lines = text.split("\n").filter((line) => line.trim())
  if (lines.length < 2) {
    showNotification("File is empty or invalid", "error")
    return
  }

  // Parse headers
  fileHeaders = lines[0].split(",").map((h) => h.replace(/"/g, "").trim())
  importedRawData = []

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.replace(/"/g, "").trim())
    const row = {}
    fileHeaders.forEach((header, index) => {
      row[header] = values[index] || ""
    })
    importedRawData.push(row)
  }

  // Auto-detect and map columns
  autoMapColumns()
  showMappingStep()
}

function autoMapColumns() {
  columnMapping = {}

  for (const fileHeader of fileHeaders) {
    const lowerHeader = fileHeader.toLowerCase()

    // Try to match file header to database field
    for (const field of AVAILABLE_FIELDS) {
      const fieldLabel = field.label.toLowerCase()
      const fieldValue = field.value.toLowerCase()

      // Exact or partial match
      if (
        lowerHeader.includes(fieldValue) ||
        fieldLabel.includes(lowerHeader) ||
        (lowerHeader.includes("name") && field.value === "name") ||
        ((lowerHeader.includes("phone") || lowerHeader.includes("number")) && field.value === "phone") ||
        (lowerHeader.includes("email") && field.value === "email") ||
        (lowerHeader.includes("city") && field.value === "city") ||
        ((lowerHeader.includes("value") || lowerHeader.includes("deal")) && field.value === "value") ||
        ((lowerHeader.includes("source") || lowerHeader.includes("lead")) && field.value === "source") ||
        (lowerHeader.includes("stage") && field.value === "stage") ||
        (lowerHeader.includes("priority") && field.value === "priority") ||
        (lowerHeader.includes("project") && field.value === "project") ||
        (lowerHeader.includes("lead status") && field.value === "leadStatus") ||
        ((lowerHeader.includes("next follow") || lowerHeader.includes("follow up")) && field.value === "nextFollow") ||
        ((lowerHeader.includes("next follow date") || lowerHeader.includes("follow up date")) &&
          field.value === "nextFollowDate")
      ) {
        columnMapping[fileHeader] = field.value
        break
      }
    }
  }

  console.log("[v0] Auto-detected column mappings:", columnMapping)
}

function showMappingStep() {
  document.getElementById("uploadStep").style.display = "none"
  document.getElementById("mappingStep").style.display = "block"
  document.getElementById("previewStep").style.display = "none"

  // Update button visibility
  document.getElementById("uploadStepBtns").style.display = "none"
  document.getElementById("mappingStepBtns").style.display = "flex"
  document.getElementById("previewStepBtns").style.display = "none"

  // Show helpful info about minimal import
  const minimalImportInfo = document.createElement("div")
  minimalImportInfo.style.cssText =
    "background: #f0f9ff; border: 1px solid #93c5fd; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem;"
  minimalImportInfo.innerHTML = `
    <div style="display: flex; gap: 8px;">
      <div style="color: #3b82f6; font-weight: 600; flex-shrink: 0;">ℹ️</div>
      <div style="font-size: 14px; color: #0c4a6e;">
        <strong>Quick Import Tip:</strong> You only need <strong>Name</strong> and <strong>Number</strong> columns to import leads.
        Other fields will be filled with default values automatically:
        <ul style="margin-top: 8px; padding-left: 20px;">
          <li>Value: 0</li>
          <li>Source: Manual Entry</li>
          <li>Stage: New Lead</li>
          <li>Priority: Warm</li>
          <li>Project: -</li>
          <li>Lead Status: Active</li>
          <li>Next Follow: -</li>
          <li>Next Follow Date: -</li>
        </ul>
      </div>
    </div>
  `
  const mappingTable = document.getElementById("columnMappingTable")
  mappingTable.innerHTML = ""
  mappingTable.parentNode.insertBefore(minimalImportInfo, mappingTable)

  // Create mapping table
  mappingTable.innerHTML = `
    <table style="width: 100%; border-collapse: collapse;">
      <thead style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
        <tr>
          <th style="padding: 12px; text-align: left; font-weight: 600;">Your Column</th>
          <th style="padding: 12px; text-align: left; font-weight: 600;">Map To Field</th>
          <th style="padding: 12px; text-align: left; font-weight: 600;">Required</th>
        </tr>
      </thead>
      <tbody>
        ${fileHeaders
          .map((header) => {
            const currentMapping = columnMapping[header] || ""
            const field = AVAILABLE_FIELDS.find((f) => f.value === currentMapping)
            const isRequired = field && field.required

            return `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 12px; font-weight: 500;">${escapeHtml(header)}</td>
              <td style="padding: 12px;">
                <select class="inline-select" onchange="updateColumnMapping('${escapeHtml(header)}', this.value)" style="min-width: 200px;">
                  <option value="">-- Don't Import --</option>
                  ${AVAILABLE_FIELDS.map(
                    (f) => `
                    <option value="${f.value}" ${currentMapping === f.value ? "selected" : ""} title="${f.description}">
                      ${f.label}${f.required ? " *" : ""}
                    </option>
                  `,
                  ).join("")}
                </select>
              </td>
              <td style="padding: 12px; color: ${isRequired ? "#ef4444" : "#94a3b8"};">
                ${isRequired ? "✓ Required" : "Optional"}
              </td>
            </tr>
          `
          })
          .join("")}
      </tbody>
    </table>
  `
}

function updateColumnMapping(header, fieldValue) {
  if (fieldValue === "") {
    delete columnMapping[header]
  } else {
    columnMapping[header] = fieldValue
  }
  console.log("[v0] Column mapping updated:", columnMapping)
}

function goToPreview() {
  const importSource = document.querySelector('input[name="importSource"]:checked')?.value || "Manual Entry"

  // Only Name and Phone are truly required
  const requiredFields = ["name", "phone"] // Only these are absolutely required
  const mappedFields = Object.values(columnMapping)

  const missingRequired = requiredFields.filter((rf) => !mappedFields.includes(rf))
  if (missingRequired.length > 0) {
    showNotification(
      `Please map these required columns: ${missingRequired.map((f) => AVAILABLE_FIELDS.find((x) => x.value === f)?.label).join(", ")}`,
      "error",
    )
    return
  }

  // Transform raw data using column mapping
  importedData = importedRawData.map((row) => {
    const mapped = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      assignedCaller: null,
      assignedCallerName: null,
      source: importSource, // Use selected import source
    }

    for (const [fileColumn, dbField] of Object.entries(columnMapping)) {
      const value = row[fileColumn]

      if (dbField === "value") {
        mapped[dbField] = Number.parseFloat(value) || 0
      } else if (dbField === "nextFollowDate" && value) {
        // Attempt to parse common date formats, if parsing fails, it will be null
        const parsedDate = new Date(value)
        mapped[dbField] = isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString()
      } else if (value) {
        mapped[dbField] = value
      }
    }

    // Set default values for fields not explicitly mapped or present in the file
    if (!mapped.name) mapped.name = "Unknown"
    if (!mapped.phone) mapped.phone = ""
    if (!mapped.email) mapped.email = ""
    if (!mapped.city) mapped.city = ""
    if (!mapped.value) mapped.value = 0
    if (!mapped.stage) mapped.stage = "New Lead"
    if (!mapped.priority) mapped.priority = "Warm"
    if (!mapped.project) mapped.project = "-"
    if (!mapped.leadStatus) mapped.leadStatus = "Active"
    if (!mapped.nextFollow) mapped.nextFollow = "-"
    if (!mapped.nextFollowDate) mapped.nextFollowDate = null // Explicitly null if not provided

    return mapped
  })

  console.log("[v0] Mapped data ready:", importedData.length, "leads with source:", importSource)
  displayImportPreview()

  document.getElementById("uploadStep").style.display = "none"
  document.getElementById("mappingStep").style.display = "none"
  document.getElementById("previewStep").style.display = "block"

  document.getElementById("uploadStepBtns").style.display = "none"
  document.getElementById("mappingStepBtns").style.display = "none"
  document.getElementById("previewStepBtns").style.display = "flex"
}

function goBackToUpload() {
  document.getElementById("uploadStep").style.display = "block"
  document.getElementById("mappingStep").style.display = "none"
  document.getElementById("previewStep").style.display = "none"

  document.getElementById("uploadStepBtns").style.display = "flex"
  document.getElementById("mappingStepBtns").style.display = "none"
  document.getElementById("previewStepBtns").style.display = "none"

  importedRawData = []
  columnMapping = {}
  fileHeaders = []
}

function goToMapping() {
  document.getElementById("uploadStep").style.display = "none"
  document.getElementById("mappingStep").style.display = "block"
  document.getElementById("previewStep").style.display = "none"

  document.getElementById("uploadStepBtns").style.display = "none"
  document.getElementById("mappingStepBtns").style.display = "flex"
  document.getElementById("previewStepBtns").style.display = "none"
}

function goBackToMapping() {
  document.getElementById("uploadStep").style.display = "none"
  document.getElementById("mappingStep").style.display = "block"
  document.getElementById("previewStep").style.display = "none"

  document.getElementById("uploadStepBtns").style.display = "none"
  document.getElementById("mappingStepBtns").style.display = "flex"
  document.getElementById("previewStepBtns").style.display = "none"
}

function displayImportPreview() {
  if (!importedData || importedData.length === 0) {
    showNotification("No data to preview", "error")
    return
  }

  document.getElementById("previewCount").textContent = importedData.length

  // Create preview table
  const thead = document.getElementById("previewTableHead")
  const tbody = document.getElementById("previewTableBody")

  thead.innerHTML = `
    <tr>
      <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e2e8f0;">Name</th>
      <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e2e8f0;">Phone</th>
      <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e2e8f0;">Email</th>
      <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e2e8f0;">City</th>
      <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e2e8f0;">Project</th>
      <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e2e8f0;">Status</th>
      <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e2e8f0;">Next Follow</th>
      <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e2e8f0;">Next Follow Date</th>
    </tr>
  `

  tbody.innerHTML = importedData
    .slice(0, 10)
    .map(
      (lead) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 12px;">${escapeHtml(lead.name)}</td>
        <td style="padding: 12px;">${escapeHtml(lead.phone)}</td>
        <td style="padding: 12px;">${escapeHtml(lead.email || "-")}</td>
        <td style="padding: 12px;">${escapeHtml(lead.city || "-")}</td>
        <td style="padding: 12px;">${escapeHtml(lead.project || "-")}</td>
        <td style="padding: 12px;">
          <span style="background: ${
            lead.leadStatus === "Active"
              ? "#e0f2fe"
              : lead.leadStatus === "Inactive"
                ? "#f3e8ff"
                : lead.leadStatus === "Paused"
                  ? "#fef3c7"
                  : lead.leadStatus === "Not Interested"
                    ? "#fecaca" // Red for Not Interested
                    : "#f1f5f9"
          }; color: ${
            lead.leadStatus === "Active"
              ? "#0369a1"
              : lead.leadStatus === "Inactive"
                ? "#6b21a8"
                : lead.leadStatus === "Paused"
                  ? "#92400e"
                  : lead.leadStatus === "Not Interested"
                    ? "#b91c1c" // Dark red for Not Interested
                    : "#334155"
          }; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">
            ${escapeHtml(lead.leadStatus || "-")}
          </span>
        </td>
        <td style="padding: 12px;">${escapeHtml(lead.nextFollow || "-")}</td>
        <td style="padding: 12px;">${lead.nextFollowDate ? new Date(lead.nextFollowDate).toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}</td>
      </tr>
    `,
    )
    .join("")

  if (importedData.length > 10) {
    tbody.innerHTML += `
      <tr style="background: #f8fafc;">
        <td colspan="8" style="padding: 12px; text-align: center; color: #64748b; font-size: 14px;">
          ... and ${importedData.length - 10} more leads
        </td>
      </tr>
    `
  }
}

// Confirm import
function confirmImport() {
  if (importedData.length === 0) {
    showNotification("No data to import", "error")
    return
  }

  fetch("/api/leads/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leads: importedData }),
  })
    .then((res) => res.json())
    .then((result) => {
      if (result && result.success) {
        showNotification(`Successfully imported ${result.imported || importedData.length} leads to server!`, "success")
        addNotification(`${result.imported || importedData.length} leads imported`, "success", null)
        closeImportModal()
        loadLeadsFromServer()
      } else {
        leads.push(...importedData)
        saveLeads()
        closeImportModal()
        filterLeads()
        showNotification("Server refused import — saved locally instead.", "warning")
      }
    })
    .catch((err) => {
      leads.push(...importedData)
      saveLeads()
      closeImportModal()
      filterLeads()
      showNotification("Server unavailable — leads saved locally.", "warning")
    })
}

// Load leads from server
function loadLeadsFromServer() {
  fetch("/api/leads")
    .then((r) => {
      if (!r.ok) throw new Error(`Server returned ${r.status}`)
      return r.json()
    })
    .then((data) => {
      if (data && data.success && Array.isArray(data.leads)) {
        // Apply deduplication when loading from server as well
        leads = deduplicateLeadsByPhone(data.leads)
        saveLeads()
        filteredLeads = [...leads]
        renderLeads()
        showNotification("Loaded leads from server.", "info")
      } else {
        console.warn("Failed to load leads from server (unexpected response):", data)
      }
    })
    .catch((err) => {
      console.warn("Cannot reach server to load leads:", err)
    })
}

// Open add lead modal
function openAddLeadModal() {
  currentLeadId = null
  document.getElementById("modalTitle").textContent = "Add New Lead"
  document.getElementById("leadForm").reset()
  document.getElementById("leadId").value = ""
  document.getElementById("leadAssignedCaller").value = ""
  document.getElementById("leadProject").value = ""
  document.getElementById("leadLeadStatus").value = "Active"
  document.getElementById("leadNextFollow").value = ""
  document.getElementById("leadNextFollowDate").value = ""

  document.getElementById("leadModal").classList.add("active")
}

// Close lead modal
function closeLeadModal() {
  document.getElementById("leadModal").classList.remove("active")
}

async function removeDuplicatesFromDatabase() {
  if (!confirm("This will merge duplicate leads by phone number. Are you sure?")) return

  showNotification("Removing duplicates from database...", "info")

  try {
    // Get all leads
    const response = await fetch("/api/leads")
    const data = await response.json()

    if (!data.success || !Array.isArray(data.leads)) {
      showNotification("Failed to fetch leads from server", "error")
      return
    }

    const allLeads = data.leads
    const seenPhones = new Map()
    const duplicatesToDelete = []

    // Find duplicates
    for (const lead of allLeads) {
      const phone = (lead.phone || "").trim()
      if (!phone) continue

      const phoneDigits = phone.replace(/[^0-9]/g, "")

      if (seenPhones.has(phoneDigits)) {
        // This is a duplicate, mark it for deletion (keep the first one)
        duplicatesToDelete.push(lead.id)
      } else {
        seenPhones.set(phoneDigits, lead.id)
      }
    }

    if (duplicatesToDelete.length === 0) {
      showNotification("No duplicates found!", "success")
      return
    }

    // Delete duplicates using bulk delete
    const deleteResponse = await fetch("/api/leads/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ ids: duplicatesToDelete }),
    })

    const deleteResult = await deleteResponse.json()

    if (deleteResult.success) {
      showNotification(`Removed ${deleteResult.deleted || duplicatesToDelete.length} duplicate leads!`, "success")
      addNotification(`Removed ${deleteResult.deleted || duplicatesToDelete.length} duplicates`, "success", null)
      loadLeadsFromServer() // Reload leads to reflect changes
    } else {
      showNotification(`Error removing duplicates: ${deleteResult.error}`, "error")
    }
  } catch (err) {
    console.error("Error removing duplicates:", err)
    showNotification("Network error while removing duplicates", "error")
  }
}

// Save lead
async function saveLead(event) {
  event.preventDefault()

  const leadIdFromForm = document.getElementById("leadId").value
  const isUpdate = !!leadIdFromForm

  const callerSelect = document.getElementById("leadAssignedCaller")
  const callerSelectedOption = callerSelect.options[callerSelect.selectedIndex]
  const assignedCallerName =
    callerSelectedOption.textContent !== "-- Not Assigned --" ? callerSelectedOption.textContent : null

  const nextFollowDateInput = document.getElementById("leadNextFollowDate")
  let nextFollowDateISO = null
  if (nextFollowDateInput.value) {
    const parsedDate = new Date(nextFollowDateInput.value)
    if (!isNaN(parsedDate.getTime())) {
      nextFollowDateISO = parsedDate.toISOString()
    } else {
      showNotification("Invalid Next Follow Up Date format. Please use a valid date and time.", "error")
      return
    }
  }

  const leadFromForm = {
    id: leadIdFromForm || generateId(),
    name: (document.getElementById("leadName").value || "").trim(),
    phone: (document.getElementById("leadPhone").value || "").trim(),
    email: (document.getElementById("leadEmail").value || "").trim(),
    city: (document.getElementById("leadCity").value || "").trim(),
    value: Number.parseFloat(document.getElementById("leadValue").value) || 0,
    source: document.getElementById("leadSource").value || "Manual Entry",
    stage: document.getElementById("leadStage").value || "New Lead",
    priority: document.getElementById("leadPriority").value || "Warm",
    project: document.getElementById("leadProject").value || "-",
    leadStatus: document.getElementById("leadLeadStatus").value || "Active",
    nextFollow: (document.getElementById("leadNextFollow").value || "").trim() || "-",
    nextFollowDate: nextFollowDateISO,
    assignedCaller: document.getElementById("leadAssignedCaller").value || null,
    assignedCallerName: assignedCallerName,
    createdAt: isUpdate
      ? leads.find((l) => l.id === leadIdFromForm)?.createdAt || new Date().toISOString()
      : new Date().toISOString(),
  }

  if (!leadFromForm.name || !leadFromForm.phone) {
    showNotification("Name and Phone are required.", "error")
    return
  }

  const phoneDigits = leadFromForm.phone.replace(/[^0-9]/g, "")
  const duplicatePhone = leads.find(
    (l) => l.id !== leadFromForm.id && (l.phone || "").replace(/[^0-9]/g, "") === phoneDigits,
  )

  if (duplicatePhone) {
    if (
      !confirm(
        `A lead with phone number ${leadFromForm.phone} already exists (${duplicatePhone.name}). Continue adding duplicate?`,
      )
    ) {
      showNotification("Lead not saved", "warning")
      return
    }
  }

  showNotification(isUpdate ? "Updating lead..." : "Creating lead...", "info")
  if (!isUpdate) {
    addNotification(`New lead created: ${leadFromForm.name}`, "success", leadFromForm.name)
  } else {
    addNotification(`Lead updated: ${leadFromForm.name}`, "info", leadFromForm.name)
  }

  try {
    const url = isUpdate ? `/api/leads/${encodeURIComponent(leadFromForm.id)}` : "/api/leads"
    const method = isUpdate ? "PUT" : "POST"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(leadFromForm),
    })

    if (res.status === 201 || res.status === 200) {
      const existingIndex = leads.findIndex((l) => l.id === leadFromForm.id)
      if (existingIndex >= 0) {
        leads[existingIndex] = leadFromForm
      } else {
        leads.unshift(leadFromForm)
      }
      leads = deduplicateLeadsByPhone(leads)
      saveLeads()
      closeLeadModal()
      loadLeadsFromServer()
      showNotification(isUpdate ? "Lead updated successfully!" : "Lead created successfully!", "success")
      return
    }

    let errorMsg = `Server error (${res.status})`
    try {
      const errorText = await res.text()
      if (errorText) {
        const jsonBody = JSON.parse(errorText)
        if (jsonBody && jsonBody.error) {
          errorMsg = jsonBody.error
        }
      }
    } catch (e) {
      console.warn("Could not parse error response:", e)
    }
    showNotification(errorMsg, "error")
  } catch (err) {
    console.error("saveLead network error:", err)
    showNotification("Network error — could not save to server. Try again.", "error")
  }
}

// Edit lead
function editLead(id) {
  const lead = leads.find((l) => l.id === id)
  if (!lead) return

  currentLeadId = id
  document.getElementById("modalTitle").textContent = "Edit Lead"
  document.getElementById("leadForm").reset() // Reset form first
  document.getElementById("leadId").value = lead.id
  document.getElementById("leadName").value = lead.name
  document.getElementById("leadPhone").value = lead.phone || ""
  document.getElementById("leadEmail").value = lead.email || ""
  document.getElementById("leadCity").value = lead.city || ""
  document.getElementById("leadValue").value = lead.value
  document.getElementById("leadSource").value = lead.source
  document.getElementById("leadStage").value = lead.stage
  document.getElementById("leadPriority").value = lead.priority
  document.getElementById("leadProject").value = lead.project || ""
  document.getElementById("leadLeadStatus").value = lead.leadStatus || "Active"
  document.getElementById("leadNextFollow").value = lead.nextFollow || ""
  // Format date for input field
  if (lead.nextFollowDate) {
    const date = new Date(lead.nextFollowDate)
    document.getElementById("leadNextFollowDate").value = date.toISOString().slice(0, 16) // YYYY-MM-DDTHH:MM
  } else {
    document.getElementById("leadNextFollowDate").value = ""
  }
  document.getElementById("leadAssignedCaller").value = lead.assignedCaller || ""

  document.getElementById("leadModal").classList.add("active")
}

// View lead details
function viewLeadDetails(id) {
  const lead = leads.find((l) => l.id === id)
  if (!lead) return

  currentLeadId = id
  document.getElementById("detailsTitle").textContent = lead.name
  document.getElementById("detailsEmail").textContent = lead.email || "No email provided"

  document.getElementById("detailContact").textContent = lead.name || "-"
  document.getElementById("detailPhone").textContent = lead.phone || "-"
  document.getElementById("detailCity").textContent = lead.city || "-"
  document.getElementById("detailValue").textContent = formatCurrency(lead.value)
  document.getElementById("detailSource").textContent = lead.source
  document.getElementById("detailStage").textContent = lead.stage
  document.getElementById("detailPriority").textContent = lead.priority
  document.getElementById("detailProject").textContent = lead.project || "-"
  document.getElementById("detailLeadStatus").textContent = lead.leadStatus || "-"
  document.getElementById("detailNextFollow").textContent = lead.nextFollow || "-"
  document.getElementById("detailNextFollowDate").textContent = lead.nextFollowDate
    ? new Date(lead.nextFollowDate).toLocaleString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-"
  document.getElementById("detailAssignedCaller").textContent = lead.assignedCallerName || "Not Assigned"
  document.getElementById("detailCreatedAt").textContent = new Date(lead.createdAt).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  document.getElementById("detailsModal").classList.add("active")
}

// Close details modal
function closeDetailsModal() {
  document.getElementById("detailsModal").classList.remove("active")
}

// Edit current lead
function editCurrentLead() {
  closeDetailsModal()
  editLead(currentLeadId)
}

// Delete lead
async function deleteLead() {
  if (!currentLeadId) return

  if (!confirm("Are you sure you want to delete this lead? This action cannot be undone.")) return

  const idToDelete = currentLeadId
  const leadName = leads.find((l) => l.id === idToDelete)?.name || "Unknown"
  const backupLeads = [...leads]

  leads = leads.filter((l) => l.id !== idToDelete)
  saveLeads()
  filterLeads()
  closeDetailsModal()
  addNotification(`Lead "${leadName}" deleted`, "warning", leadName)
  showNotification("Deleting lead...", "info")

  try {
    const res = await fetch(`/api/leads/${encodeURIComponent(idToDelete)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
    })

    const text = await res.text()
    let body = null
    try {
      body = JSON.parse(text)
    } catch (e) {
      body = text
    }

    if (!res.ok) {
      leads = backupLeads
      saveLeads()
      filterLeads()

      const errMsg = body && body.error ? body.error : `Server returned ${res.status}`
      showNotification(`Could not delete on server: ${errMsg}`, "error")
      console.warn("Delete failed:", res.status, body)
      return
    }

    showNotification("Lead deleted successfully (server).", "success")
    selectedLeads.delete(idToDelete)
    updateBulkDeleteButton()
  } catch (err) {
    leads = backupLeads
    saveLeads()
    filterLeads()
    showNotification("Network error — could not delete lead on server. Local changes restored.", "error")
    console.error("Delete error:", err)
  } finally {
    currentLeadId = null
  }
}

// Export leads
function exportLeads() {
  const csv = [
    [
      "Name",
      "Number",
      "Email",
      "City",
      "Value",
      "Source",
      "Stage",
      "Priority",
      "Project",
      "Lead Status",
      "Next Follow",
      "Next Follow Date",
      "Created Date",
      "Assigned Caller",
    ],
  ]

  filteredLeads.forEach((lead) => {
    csv.push([
      lead.name,
      lead.phone || "",
      lead.email || "",
      lead.city || "",
      lead.value,
      lead.source,
      lead.stage,
      lead.priority,
      lead.project || "-",
      lead.leadStatus || "-",
      lead.nextFollow || "-",
      lead.nextFollowDate
        ? new Date(lead.nextFollowDate).toLocaleString("en-IN", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-",
      new Date(lead.createdAt).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
      lead.assignedCallerName || "Not Assigned",
    ])
  })

  const csvContent = csv.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")
  const blob = new Blob([csvContent], { type: "text/csv" })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `leads_export_${new Date().toISOString().split("T")[0]}.csv`
  a.click()
  window.URL.revokeObjectURL(url)
  showNotification("Leads exported successfully!", "success")
}

// Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement("div")
  div.textContent = text
  return div.innerHTML
}

// Show notification
function showNotification(message, type = "success") {
  const colors = {
    success: "#10b981",
    error: "#ef4444",
    info: "#3b82f6",
    warning: "#f59e0b",
  }

  const notification = document.createElement("div")
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
    `
  notification.textContent = message

  if (!document.getElementById("notification-styles")) {
    const style = document.createElement("style")
    style.id = "notification-styles"
    style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(400px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `
    document.head.appendChild(style)
  }

  document.body.appendChild(notification)
  setTimeout(() => notification.remove(), 3000)
}

// Add notification to bell
function addNotification(message, type = "info", leadName = "") {
  const notification = {
    id: Date.now() + Math.random(),
    message: message,
    type: type,
    leadName: leadName,
    timestamp: new Date().toISOString(),
    read: false,
  }

  notifications.unshift(notification)

  if (notifications.length > MAX_NOTIFICATIONS) {
    notifications = notifications.slice(0, MAX_NOTIFICATIONS)
  }

  saveNotifications()
  updateNotificationBell()
}

// Load notifications
function loadNotifications() {
  const stored = sessionStorage.getItem("crm_notifications")
  if (stored) {
    try {
      notifications = JSON.parse(stored)
    } catch (e) {
      notifications = []
    }
  }
  updateNotificationBell()
}

// Save notifications
function saveNotifications() {
  sessionStorage.setItem("crm_notifications", JSON.stringify(notifications))
}

// Update notification bell
function updateNotificationBell() {
  const unreadCount = notifications.filter((n) => !n.read).length
  const dot = document.getElementById("notificationDot")

  if (unreadCount > 0) {
    dot.style.display = "block"
  } else {
    dot.style.display = "none"
  }
}

// Toggle notification dropdown
function toggleNotificationDropdown() {
  const dropdown = document.getElementById("notificationDropdown")
  const bell = document.getElementById("notificationBell")

  const isOpen = dropdown.style.display !== "none"

  if (isOpen) {
    dropdown.style.display = "none"
  } else {
    dropdown.style.display = "block"
    renderNotificationList()
    notifications.forEach((n) => (n.read = true))
    saveNotifications()
    updateNotificationBell()
  }
}

// Render notification list
function renderNotificationList() {
  const notifList = document.getElementById("notificationList")

  if (notifications.length === 0) {
    notifList.innerHTML = '<div style="padding: 20px; text-align: center; color: #94a3b8;">No notifications yet</div>'
    return
  }

  notifList.innerHTML = notifications
    .map((notif) => {
      const date = new Date(notif.timestamp)
      const timeAgo = getTimeAgo(date)

      let bgColor = "#f0fdf4"
      let borderColor = "#86efac"
      let iconColor = "#10b981"

      if (notif.type === "error") {
        bgColor = "#fef2f2"
        borderColor = "#fca5a5"
        iconColor = "#ef4444"
      } else if (notif.type === "warning") {
        bgColor = "#fffbeb"
        borderColor = "#fcd34d"
        iconColor = "#f59e0b"
      } else if (notif.type === "info") {
        bgColor = "#f0f9ff"
        borderColor = "#93c5fd"
        iconColor = "#3b82f6"
      }

      return `
      <div style="padding: 12px; border-left: 4px solid ${borderColor}; background: ${bgColor}; border-bottom: 1px solid #e2e8f0; cursor: pointer; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">
        <div style="display: flex; gap: 8px;">
          <div style="color: ${iconColor}; font-weight: 600; font-size: 18px; flex-shrink: 0;">●</div>
          <div style="flex: 1;">
            <div style="font-size: 13px; color: #1e293b; font-weight: 500;">${escapeHtml(notif.message)}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">${timeAgo}</div>
            ${notif.leadName ? `<div style="font-size: 12px; color: #475569; margin-top: 2px;"><strong>${escapeHtml(notif.leadName)}</strong></div>` : ""}
          </div>
        </div>
      </div>
    `
    })
    .join("")
}

// Get time ago string
function getTimeAgo(date) {
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDateDDMMYYYY(date)
}

// Close notification dropdown on outside click
document.addEventListener("click", (e) => {
  const dropdown = document.getElementById("notificationDropdown")
  const bell = document.getElementById("notificationBell")

  if (!dropdown || !bell) return

  if (!dropdown.contains(e.target) && !bell.contains(e.target)) {
    dropdown.style.display = "none"
  }
})

// Close modals on outside click
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal")) {
    e.target.classList.remove("active")
  }
})

// Load callers for assignment dropdown
async function loadCallersForAssignment() {
  try {
    const res = await fetch("/api/callers", {
      credentials: "same-origin",
    })
    if (!res.ok) return
    const data = await res.json()
    if (data.success && Array.isArray(data.callers)) {
      const select = document.getElementById("leadAssignedCaller")
      if (select) {
        select.innerHTML =
          '<option value="">-- Not Assigned --</option>' +
          data.callers
            .filter((c) => c.status === "Active")
            .map((c) => `<option value="${c.id}">${c.name || c.username}</option>`)
            .join("")
      }
    }
  } catch (err) {
    console.warn("Could not load callers:", err)
  }
}

async function autoAssignCurrentLead() {
  if (!currentLeadId) {
    showNotification("Please save the lead first before auto-assigning", "warning")
    return
  }

  showNotification("Auto-assigning lead to next available caller...", "info")

  try {
    const res = await fetch(`/api/leads/${encodeURIComponent(currentLeadId)}/auto-assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
    })

    if (!res.ok) {
      const errorData = await res.json()
      showNotification(errorData.error || "Could not auto-assign lead", "error")
      return
    }

    const data = await res.json()

    // Update the select field with newly assigned caller
    if (data.assignedCaller) {
      document.getElementById("leadAssignedCaller").value = data.assignedCaller
    }
    if (data.assignedCallerName) {
      document.getElementById("leadAssignedCaller").value = data.assignedCaller

      // Update the select option text to show the assigned caller
      const selectElement = document.getElementById("leadAssignedCaller")
      for (const option of selectElement.options) {
        if (option.value === data.assignedCaller) {
          option.selected = true
          break
        }
      }
    }

    showNotification(`Lead auto-assigned to ${data.assignedCallerName}!`, "success")
    addNotification(`Lead auto-assigned to ${data.assignedCallerName}`, "success", null)
  } catch (err) {
    console.error("Auto-assign error:", err)
    showNotification("Network error — could not auto-assign lead", "error")
  }
}

function updateLeadStatus(status) {
  const lead = leads.find((l) => l.id === currentLeadId)
  if (!lead) return

  if (status === "Callback") {
    openCallbackModal()
  } else if (status === "Interested") {
    lead.stage = "Qualified" // Assuming "Interested" maps to "Qualified" stage
    lead.leadStatus = "Active" // Assuming "Interested" means the lead is now Active
    saveLeads()
    renderLeads()
    updateStats()
    showNotification(`Lead marked as Interested and Active`, "success")
    addNotification(`Lead "${lead.name}" marked as Interested and Active`, "success", lead.name)
    persistLeadChange(lead.id, { stage: "Qualified", leadStatus: "Active" })
  } else if (status === "Not Interested") {
    openNotInterestedModal()
  }
}

function openCallbackModal() {
  document.getElementById("callbackModal").classList.add("active")
  document.getElementById("callbackReason").value = ""
  document.getElementById("callbackDate").value = ""
  // Removed time input from modal for now to avoid complexity with date picker
  document.getElementById("callbackNote").value = ""

  // Set default date to tomorrow, time to 10:00 AM
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(10, 0, 0, 0)
  document.getElementById("callbackDate").value = tomorrow.toISOString().slice(0, 16)
}

function closeCallbackModal() {
  document.getElementById("callbackModal").classList.remove("active")
}

function isValidTime(timeStr) {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
  return timeRegex.test(timeStr)
}

function saveCallback() {
  const lead = leads.find((l) => l.id === currentLeadId)
  if (!lead) return

  const reason = document.getElementById("callbackReason").value
  const dateInput = document.getElementById("callbackDate")
  // Added time input element reference
  const timeInput = document.getElementById("callbackTime")
  const note = document.getElementById("callbackNote").value

  if (!reason) {
    showNotification("Please select a callback reason", "error")
    return
  }
  if (!dateInput.value) {
    showNotification("Please select a callback date", "error")
    return
  }
  if (timeInput.value && !isValidTime(timeInput.value)) {
    showNotification("Invalid time format", "error")
    return
  }

  let followUpDate
  if (timeInput.value) {
    const [hours, minutes] = timeInput.value.split(":")
    followUpDate = new Date(dateInput.value)
    followUpDate.setHours(Number.parseInt(hours), Number.parseInt(minutes), 0, 0)
  } else {
    followUpDate = new Date(dateInput.value)
  }

  if (isNaN(followUpDate.getTime())) {
    showNotification("Invalid date format for callback", "error")
    return
  }

  // Update lead with callback details
  lead.stage = "Negotiation" // Or another appropriate stage, e.g., "Follow Up"
  lead.leadStatus = "Active" // Assuming callback means lead is active again
  lead.nextFollow = reason
  lead.nextFollowDate = followUpDate.toISOString()

  saveLeads()
  renderLeads()
  updateStats()
  closeCallbackModal()
  closeDetailsModal()

  const timeStr = timeInput.value ? ` at ${timeInput.value}` : ""
  showNotification(
    `Callback scheduled: ${reason} on ${followUpDate.toLocaleString("en-IN", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
    "success",
  )
  addNotification(`Callback scheduled for "${lead.name}" - ${reason}${timeStr}`, "success", lead.name)

  persistLeadChange(lead.id, {
    stage: "Negotiation",
    leadStatus: "Active",
    nextFollow: reason,
    nextFollowDate: followUpDate.toISOString(),
  })
}

function openNotInterestedModal() {
  document.getElementById("notInterestedModal").classList.add("active")
  document.getElementById("notInterestedReason").value = ""
  document.getElementById("notInterestedNote").value = ""
}

function closeNotInterestedModal() {
  document.getElementById("notInterestedModal").classList.remove("active")
}

function saveNotInterested() {
  const lead = leads.find((l) => l.id === currentLeadId)
  if (!lead) return

  const reason = document.getElementById("notInterestedReason").value
  const note = document.getElementById("notInterestedNote").value

  if (!reason) {
    showNotification("Please select a not interested reason", "error")
    return
  }

  lead.stage = "Closed Lost"
  lead.leadStatus = "Not Interested"
  lead.nextFollow = reason
  lead.notInterestedReason = reason
  lead.notInterestedNote = note
  lead.notInterestedDetails = {
    reason: reason,
    note: note,
  }

  saveLeads()
  renderLeads()
  updateStats()
  closeNotInterestedModal()
  closeDetailsModal()

  showNotification(`Lead marked as Not Interested: ${reason}`, "success")
  addNotification(`Lead "${lead.name}" marked as Not Interested - ${reason}`, "success", lead.name)

  persistLeadChange(lead.id, {
    stage: "Closed Lost",
    leadStatus: "Not Interested", // Updated to "Not Interested"
    nextFollow: reason, // Set nextFollow to display the reason
    notInterestedReason: reason,
    notInterestedNote: note,
    notInterestedDetails: {
      reason: reason,
      note: note,
    },
  })
}

async function persistLeadChange(leadId, updates) {
  try {
    const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error(`Server returned ${res.status}`)
  } catch (err) {
    console.warn("Could not persist lead change on server:", err)
  }
}

function formatDateDDMMYYYY(dateString) {
  if (!dateString) return "-"
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}
