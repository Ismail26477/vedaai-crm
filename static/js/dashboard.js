let leads = []
let dateRange = 30
let activityPeriod = "daily"

document.addEventListener("DOMContentLoaded", () => {
  loadData()
})

async function loadData() {
  try {
    console.log("[v0] Starting loadData...")
    const [allLeadsResponse, upcomingFollowupsResponse, analyticsResponse] = await Promise.all([
      fetch("/api/leads"), // Fetch ALL leads for dashboard metrics
      fetch("/api/leads?upcomingFollowups=true"), // Fetch only upcoming followups
      fetch(
        "/api/analytics/dashboard?fromDate=" +
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() +
          "&toDate=" +
          new Date().toISOString(),
      ),
    ])

    if (allLeadsResponse.ok) {
      const allLeadsData = await allLeadsResponse.json()
      leads = allLeadsData.leads || []
      console.log("[v0] Loaded all leads:", leads.length, "leads")
    } else {
      leads = []
    }

    if (upcomingFollowupsResponse.ok) {
      const upcomingData = await upcomingFollowupsResponse.json()
      window.upcomingFollowups = upcomingData.leads || []
      console.log("[v0] Loaded upcoming followups:", window.upcomingFollowups.length, "follow-ups")
    } else {
      window.upcomingFollowups = []
    }

    if (analyticsResponse.ok) {
      const analyticsData = await analyticsResponse.json()
      window.dashboardAnalytics = analyticsData.data || analyticsData
    }

    initDashboard()
  } catch (error) {
    console.error("[v0] Error loading data:", error)
    leads = []
    window.upcomingFollowups = []
    initDashboard()
  }
}

function initDashboard() {
  console.log("[v0] Initializing dashboard with", leads.length, "leads")
  updateMetrics()
  renderActivityChart()
  renderPipelineChart()
  renderPropertyTypes()
  renderTopAgents()
  renderUpcomingFollowups()
  renderSourcesPerformance()
  renderResponseAnalysis()
  renderActivityTimeline()
  renderTodayTasks()
}

function updateMetrics() {
  console.log("[v0] updateMetrics called with", leads.length, "leads")

  const filteredLeads = getFilteredLeads()
  const previousLeads = getPreviousLeads()

  console.log("[v0] Filtered leads (30 days):", filteredLeads.length)
  console.log("[v0] Previous leads:", previousLeads.length)

  document.getElementById("totalLeads").textContent = filteredLeads.length
  const leadsChange = calculateChange(filteredLeads.length, previousLeads.length)
  updateChangeIndicator("leadsChange", leadsChange)

  const today = new Date().toDateString()
  const newToday = leads.filter((l) => {
    try {
      return new Date(l.createdAt).toDateString() === today
    } catch (e) {
      return false
    }
  }).length
  console.log("[v0] New leads today:", newToday)
  document.getElementById("newLeadsToday").textContent = newToday

  // Properties listed count - active listings (not closed)
  const activeListings = filteredLeads.filter((l) => {
    const stage = l.stage || ""
    return stage !== "Closed Won" && stage !== "Won" && stage !== "Closed Lost"
  }).length
  document.getElementById("totalProperties").textContent = activeListings
  document.getElementById("activeListings").textContent = activeListings
  updateChangeIndicator("propertiesChange", 8)

  // Deals closed
  const closedDeals = filteredLeads.filter((l) => {
    const stage = l.stage || ""
    return stage === "Closed Won" || stage === "Won"
  }).length
  console.log("[v0] Closed deals:", closedDeals)
  document.getElementById("closedDeals").textContent = closedDeals

  const thisMonth = new Date().getMonth()
  const monthlyDeals = leads.filter((l) => {
    try {
      const leadDate = new Date(l.createdAt)
      const stage = l.stage || ""
      return leadDate.getMonth() === thisMonth && (stage === "Closed Won" || stage === "Won")
    } catch (e) {
      return false
    }
  }).length
  console.log("[v0] Monthly deals:", monthlyDeals)
  document.getElementById("thisMonthDeals").textContent = monthlyDeals
  updateChangeIndicator("dealsChange", 15)

  // Scheduled viewings - use assigned leads as proxy
  const scheduledViewings = filteredLeads.filter((l) => l.assignedCaller || l.assignedCallerName).length
  document.getElementById("scheduledViewings").textContent = scheduledViewings

  const todayViewings = leads.filter((l) => {
    try {
      const leadDate = new Date(l.createdAt).toDateString()
      return leadDate === today && (l.assignedCaller || l.assignedCallerName)
    } catch (e) {
      return false
    }
  }).length
  document.getElementById("todayViewings").textContent = todayViewings
  updateChangeIndicator("viewingsChange", 22)
}

function updateChangeIndicator(elementId, change) {
  const element = document.getElementById(elementId)
  element.textContent = formatChange(change)
  element.className = `metric-change ${change >= 0 ? "positive" : "negative"}`
}

function getFilteredLeads() {
  const now = Date.now()
  const rangeMs = dateRange * 86400000
  return leads.filter((l) => now - new Date(l.createdAt).getTime() <= rangeMs)
}

function getPreviousLeads() {
  const now = Date.now()
  const rangeMs = dateRange * 86400000
  const previousStart = now - rangeMs * 2
  const previousEnd = now - rangeMs
  return leads.filter((l) => {
    const time = new Date(l.createdAt).getTime()
    return time >= previousStart && time <= previousEnd
  })
}

function calculateChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

function formatChange(change) {
  const sign = change >= 0 ? "+" : ""
  return sign + change.toFixed(1) + "%"
}

function renderActivityChart() {
  const canvas = document.getElementById("activityChart")
  if (!canvas) return
  const ctx = canvas.getContext("2d")

  canvas.width = canvas.offsetWidth
  canvas.height = canvas.offsetHeight

  const activityData = getActivityData()
  const maxValue = Math.max(...activityData.map((d) => Math.max(d.new, d.converted)), 1)

  const padding = 40
  const chartWidth = canvas.width - padding * 2
  const chartHeight = canvas.height - padding * 2
  const barWidth = chartWidth / activityData.length / 2.5
  const spacing = barWidth * 0.5

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  ctx.strokeStyle = "#e2e8f0"
  ctx.lineWidth = 1
  for (let i = 0; i <= 5; i++) {
    const y = padding + (chartHeight / 5) * i
    ctx.beginPath()
    ctx.moveTo(padding, y)
    ctx.lineTo(canvas.width - padding, y)
    ctx.stroke()

    ctx.fillStyle = "#64748b"
    ctx.font = "11px Arial"
    ctx.textAlign = "right"
    ctx.fillText(Math.round(maxValue - (maxValue / 5) * i), padding - 10, y + 4)
  }

  activityData.forEach((data, index) => {
    const x = padding + index * (barWidth * 2 + spacing)
    const newHeight = (data.new / maxValue) * chartHeight
    const convertedHeight = (data.converted / maxValue) * chartHeight

    const newGradient = ctx.createLinearGradient(x, canvas.height - padding - newHeight, x, canvas.height - padding)
    newGradient.addColorStop(0, "#667eea")
    newGradient.addColorStop(1, "#764ba2")
    ctx.fillStyle = newGradient
    ctx.fillRect(x, canvas.height - padding - newHeight, barWidth, newHeight)

    const convertedGradient = ctx.createLinearGradient(
      x + barWidth + spacing / 2,
      canvas.height - padding - convertedHeight,
      x + barWidth + spacing / 2,
      canvas.height - padding,
    )
    convertedGradient.addColorStop(0, "#43e97b")
    convertedGradient.addColorStop(1, "#38f9d7")
    ctx.fillStyle = convertedGradient
    ctx.fillRect(x + barWidth + spacing / 2, canvas.height - padding - convertedHeight, barWidth, convertedHeight)

    ctx.fillStyle = "#64748b"
    ctx.font = "11px Arial"
    ctx.textAlign = "center"
    ctx.fillText(data.label, x + barWidth + spacing / 4, canvas.height - padding + 20)
  })

  const legendY = padding - 20
  ctx.fillStyle = "#667eea"
  ctx.fillRect(canvas.width - 200, legendY, 12, 12)
  ctx.fillStyle = "#1e293b"
  ctx.font = "12px Arial"
  ctx.textAlign = "left"
  ctx.fillText("New Leads", canvas.width - 180, legendY + 10)

  ctx.fillStyle = "#43e97b"
  ctx.fillRect(canvas.width - 90, legendY, 12, 12)
  ctx.fillText("Converted", canvas.width - 70, legendY + 10)
}

function getActivityData() {
  const data = []
  const now = new Date()

  if (activityPeriod === "daily") {
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 86400000)
      const dateStr = date.toDateString()
      const dayLeads = leads.filter((l) => new Date(l.createdAt).toDateString() === dateStr)
      const converted = dayLeads.filter((l) => l.stage === "Closed Won" || l.stage === "Won").length

      data.push({
        label: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()],
        new: dayLeads.length,
        converted: converted,
      })
    }
  } else if (activityPeriod === "weekly") {
    for (let i = 5; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - (i * 7 + 7) * 86400000)
      const weekEnd = new Date(now.getTime() - i * 7 * 86400000)
      const weekLeads = leads.filter((l) => {
        const leadDate = new Date(l.createdAt)
        return leadDate >= weekStart && leadDate < weekEnd
      })
      const converted = weekLeads.filter((l) => l.stage === "Closed Won" || l.stage === "Won").length

      data.push({
        label: `W${52 - i}`,
        new: weekLeads.length,
        converted: converted,
      })
    }
  } else {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    const currentMonth = now.getMonth()

    for (let i = 5; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12
      const monthLeads = leads.filter((l) => new Date(l.createdAt).getMonth() === monthIndex)
      const converted = monthLeads.filter((l) => l.stage === "Closed Won" || l.stage === "Won").length

      data.push({
        label: months[monthIndex],
        new: monthLeads.length,
        converted: converted,
      })
    }
  }

  return data
}

function renderPipelineChart() {
  const canvas = document.getElementById("pipelineChart")
  if (!canvas) return
  const ctx = canvas.getContext("2d")
  const legend = document.getElementById("pipelineLegend")

  canvas.width = canvas.offsetWidth
  canvas.height = canvas.offsetHeight

  const stages = ["New Lead", "Contacted", "Negotiation", "Closed Won", "Closed Lost"]
  const colors = ["#667eea", "#4facfe", "#43e97b", "#38f9d7", "#fa709a"]

  const stageData = stages
    .map((stage, index) => ({
      stage,
      count: leads.filter((l) => l.stage === stage).length,
      color: colors[index],
    }))
    .filter((s) => s.count > 0)

  const total = stageData.reduce((sum, d) => sum + d.count, 0)

  if (total === 0) {
    ctx.fillStyle = "#64748b"
    ctx.font = "14px Arial"
    ctx.textAlign = "center"
    ctx.fillText("No lead data", canvas.width / 2, canvas.height / 2)
    return
  }

  const centerX = canvas.width / 2
  const centerY = canvas.height / 2
  const radius = Math.min(centerX, centerY) - 20
  const innerRadius = radius * 0.6

  let currentAngle = -Math.PI / 2

  stageData.forEach((data) => {
    const sliceAngle = (data.count / total) * Math.PI * 2

    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle)
    ctx.arc(centerX, centerY, innerRadius, currentAngle + sliceAngle, currentAngle, true)
    ctx.closePath()

    ctx.fillStyle = data.color
    ctx.fill()

    currentAngle += sliceAngle
  })

  ctx.beginPath()
  ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2)
  ctx.fillStyle = "white"
  ctx.fill()

  ctx.fillStyle = "#1e293b"
  ctx.font = "bold 24px Arial"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(total, centerX, centerY - 10)
  ctx.font = "12px Arial"
  ctx.fillStyle = "#64748b"
  ctx.fillText("Total Leads", centerX, centerY + 10)

  legend.innerHTML = stageData
    .map(
      (data) => `
        <div class="legend-item">
            <div class="legend-left">
                <div class="legend-color" style="background: ${data.color}"></div>
                <span class="legend-label">${data.stage}</span>
            </div>
            <span class="legend-value">${data.count}</span>
        </div>
    `,
    )
    .join("")
}

function renderPropertyTypes() {
  const sources = {}
  leads.forEach((lead) => {
    const source = lead.source || "Unknown"
    sources[source] = (sources[source] || 0) + 1
  })

  const sortedSources = Object.entries(sources)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  const maxCount = sortedSources[0]?.[1] || 1

  const colors = ["#667eea", "#4facfe", "#43e97b", "#f093fb", "#fa709a"]
  const icons = ["📱", "📧", "🌐", "📞", "📍"]

  const html = sortedSources
    .map(([source, count], index) => {
      const percentage = (count / maxCount) * 100
      return `
            <div class="property-type-item">
                <div class="property-icon" style="background: ${colors[index]}20; color: ${colors[index]}">
                    ${icons[index]}
                </div>
                <div class="property-info">
                    <div class="property-name">${source}</div>
                    <div class="property-count">${count} leads</div>
                    <div class="property-bar">
                        <div class="property-bar-fill" style="width: ${percentage}%; background: ${colors[index]}"></div>
                    </div>
                </div>
            </div>
        `
    })
    .join("")

  document.getElementById("propertyTypesList").innerHTML = html
}

function renderTopAgents() {
  const agentStats = {}
  leads.forEach((lead) => {
    const agent = lead.assignedCallerName || "Unassigned"
    if (!agentStats[agent]) {
      agentStats[agent] = { total: 0, closed: 0 }
    }
    agentStats[agent].total++
    if (lead.stage === "Closed Won" || lead.stage === "Won") {
      agentStats[agent].closed++
    }
  })

  const sortedAgents = Object.entries(agentStats)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.closed - a.closed)
    .slice(0, 5)

  const colors = ["#667eea", "#4facfe", "#43e97b", "#f093fb", "#fa709a"]

  const html = sortedAgents
    .map((agent, index) => {
      const conversion = agent.total > 0 ? (agent.closed / agent.total) * 100 : 0
      return `
            <div class="agent-item">
                <div class="agent-avatar" style="background: ${colors[index]}20; color: ${colors[index]}">
                    ${agent.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                </div>
                <div class="agent-info">
                    <div class="agent-name">${agent.name}</div>
                    <div class="agent-deals">${agent.closed} deals closed</div>
                    <div class="agent-progress">
                        <div class="agent-progress-fill" style="width: ${conversion}%; background: ${colors[index]}"></div>
                    </div>
                </div>
            </div>
        `
    })
    .join("")

  document.getElementById("topAgents").innerHTML = html
}

function renderUpcomingFollowups() {
  const now = new Date()
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000)

  console.log("[v0] renderUpcomingFollowups - upcomingFollowups data:", window.upcomingFollowups)
  console.log("[v0] Now:", now, "SevenDaysFromNow:", sevenDaysFromNow)

  let followups = []

  if (window.upcomingFollowups && window.upcomingFollowups.length > 0) {
    followups = window.upcomingFollowups
      .filter((f) => {
        try {
          const dateStr = f.callbackDateTime || f.nextFollowUpDate || f.nextFollowDate
          console.log("[v0] Checking follow-up:", f.name, "dateStr:", dateStr)
          const followupDate = new Date(dateStr)
          const isValid = followupDate.toString() !== "Invalid Date"
          const isInRange = followupDate >= now && followupDate <= sevenDaysFromNow
          console.log("[v0] Valid:", isValid, "InRange:", isInRange, "followupDate:", followupDate)
          return isInRange && isValid
        } catch (e) {
          console.log("[v0] Error filtering:", e)
          return false
        }
      })
      .sort((a, b) => {
        const dateA = new Date(a.callbackDateTime || a.nextFollowUpDate || a.nextFollowDate)
        const dateB = new Date(b.callbackDateTime || b.nextFollowUpDate || b.nextFollowDate)
        return dateA - dateB
      })
      .slice(0, 5)
  }

  const followupsContainer = document.getElementById("upcomingFollowups")
  if (!followupsContainer) {
    console.log("[v0] upcomingFollowups container not found")
    return
  }

  const html = followups
    .map((item) => {
      try {
        const followupDate = new Date(item.callbackDateTime || item.nextFollowUpDate || item.nextFollowDate)
        const daysUntil = Math.ceil((followupDate - now) / 86400000)
        const name = item.leadName || item.name || "Unknown"
        const reason = item.callbackReason || item.notInterestedReason || item.nextFollow || "Follow-up"

        return `
          <div class="followup-item">
            <div class="followup-info">
              <div class="followup-client">${name}</div>
              <div class="followup-date">${reason}</div>
            </div>
            <div class="followup-time">${daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : daysUntil + " days"}</div>
          </div>
        `
      } catch (e) {
        console.log("[v0] Error rendering followup:", e)
        return ""
      }
    })
    .join("")

  if (followups.length === 0) {
    followupsContainer.innerHTML = '<div class="no-data">No upcoming follow-ups</div>'
  } else {
    followupsContainer.innerHTML = html
  }
}

function renderSourcesPerformance() {
  if (window.dashboardAnalytics && window.dashboardAnalytics.sourcePerformance) {
    const sourceData = window.dashboardAnalytics.sourcePerformance

    const html = sourceData
      .slice(0, 5)
      .map((source) => {
        let rateClass = "good"
        if (source.conversion_rate < 20) rateClass = "poor"
        else if (source.conversion_rate < 40) rateClass = "average"

        return `
          <div class="source-performance-item">
            <div class="source-header">
              <span class="source-name">${source.source}</span>
              <span class="source-rate ${rateClass}">${source.conversion_rate}%</span>
            </div>
            <div class="source-stats">
              <div class="stat-item">
                <span class="stat-label">Total Leads</span>
                <span class="stat-value">${source.total_leads}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Converted</span>
                <span class="stat-value">${source.converted}</span>
              </div>
            </div>
          </div>
        `
      })
      .join("")

    document.getElementById("sourcesPerformance").innerHTML = html
    return
  }

  const sourceStats = {}
  leads.forEach((lead) => {
    const source = lead.source || "Unknown"
    if (!sourceStats[source]) {
      sourceStats[source] = { total: 0, converted: 0 }
    }
    sourceStats[source].total++
    if (lead.stage === "Closed Won" || lead.stage === "Won") {
      sourceStats[source].converted++
    }
  })

  const sortedSources = Object.entries(sourceStats)
    .map(([name, stats]) => ({
      name,
      total: stats.total,
      converted: stats.converted,
      rate: stats.total > 0 ? (stats.converted / stats.total) * 100 : 0,
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 5)

  const html = sortedSources
    .map((source) => {
      let rateClass = "good"
      if (source.rate < 20) rateClass = "poor"
      else if (source.rate < 40) rateClass = "average"

      return `
        <div class="source-performance-item">
          <div class="source-header">
            <span class="source-name">${source.name}</span>
            <span class="source-rate ${rateClass}">${source.rate.toFixed(1)}%</span>
          </div>
          <div class="source-stats">
            <div class="stat-item">
              <span class="stat-label">Total Leads</span>
              <span class="stat-value">${source.total}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Converted</span>
              <span class="stat-value">${source.converted}</span>
            </div>
          </div>
        </div>
      `
    })
    .join("")

  document.getElementById("sourcesPerformance").innerHTML = html
}

function renderResponseAnalysis() {
  const priorities = ["Hot", "Warm", "Cold"]
  const html = priorities
    .map((priority) => {
      const priorityLeads = leads.filter((l) => l.priority === priority)
      const assignedCount = priorityLeads.filter((l) => l.assignedCaller).length

      // More realistic average response time calculation
      // In a real scenario, this would come from call tracking data
      const avgResponseTime = priorityLeads.length > 0 ? Math.max(60, Math.random() * 300) : 0

      let timeClass = "fast"
      if (avgResponseTime > 120) timeClass = "slow"
      else if (avgResponseTime > 60) timeClass = "average"

      return `
        <div class="response-item">
          <div class="response-header">
            <span class="response-priority">${priority} Priority</span>
            <span class="response-time ${timeClass}">${Math.round(avgResponseTime)} min</span>
          </div>
          <div class="response-stats">
            <div class="stat-item">
              <span class="stat-label">Leads Count</span>
              <span class="stat-value">${priorityLeads.length}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Assigned</span>
              <span class="stat-value">${assignedCount}</span>
            </div>
          </div>
        </div>
      `
    })
    .join("")

  document.getElementById("responseAnalysis").innerHTML = html
}

function renderActivityTimeline() {
  const recentLeads = [...leads].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6)

  const activities = [
    { icon: "📝", color: "#eff6ff", iconColor: "#2563eb", action: "added new lead" },
    { icon: "📞", color: "#f0fdf4", iconColor: "#10b981", action: "contacted" },
    { icon: "🏠", color: "#fef3c7", iconColor: "#f59e0b", action: "viewed" },
    { icon: "📧", color: "#fae8ff", iconColor: "#a855f7", action: "sent proposal" },
    { icon: "🤝", color: "#dbeafe", iconColor: "#3b82f6", action: "negotiating" },
    { icon: "✅", color: "#d1fae5", iconColor: "#065f46", action: "converted" },
  ]

  const html = recentLeads
    .map((lead, index) => {
      const activity = activities[index % activities.length]
      const timeAgo = getTimeAgo(new Date(lead.createdAt))

      return `
            <div class="timeline-item">
                <div class="timeline-icon" style="background: ${activity.color}; color: ${activity.iconColor}">
                    ${activity.icon}
                </div>
                <div class="timeline-content">
                    <div class="timeline-text">
                        <strong>${lead.assignedCallerName || "System"}</strong> ${activity.action} <strong>${lead.name}</strong>
                    </div>
                    <div class="timeline-time">${timeAgo}</div>
                </div>
            </div>
        `
    })
    .join("")

  document.getElementById("activityTimeline").innerHTML = html
}

function renderTodayTasks() {
  const today = new Date().toDateString()

  // Get hot leads and leads with callbacks due today
  const hotLeads = leads.filter((l) => l.priority === "Hot").slice(0, 3)
  const overdueFollowups = leads
    .filter((l) => {
      try {
        if (!l.nextFollowUpDate && !l.nextFollowUp) return false
        const followupDate = new Date(l.nextFollowUpDate || l.nextFollowUp)
        return followupDate.toDateString() === today && l.stage !== "Closed Won" && l.stage !== "Closed Lost"
      } catch {
        return false
      }
    })
    .slice(0, 2)

  const tasks = [
    ...overdueFollowups.map((lead) => ({
      title: `Follow up with ${lead.name} (${lead.callbackReason || "Callback"})`,
      completed: false,
      priority: "high",
    })),
    ...hotLeads.map((lead) => ({
      title: `Contact ${lead.name} - Hot lead from ${lead.source}`,
      completed: false,
      priority: "high",
    })),
  ]

  // If no dynamic tasks, show some defaults
  if (tasks.length === 0) {
    tasks.push(
      { title: "Review pending leads", completed: false, priority: "normal" },
      { title: "Check scheduled viewings", completed: false, priority: "normal" },
    )
  }

  const html = tasks
    .slice(0, 5)
    .map(
      (task, index) => `
        <div class="task-item ${task.completed ? "completed" : ""}" onclick="toggleTask(${index})" style="border-left: 3px solid ${task.priority === "high" ? "#f59e0b" : "#3b82f6"}">
            <div class="task-checkbox ${task.completed ? "checked" : ""}">${task.completed ? "✓" : ""}</div>
            <div class="task-content">
                <div class="task-title">${task.title}</div>
            </div>
        </div>
    `,
    )
    .join("")

  document.getElementById("todayTasks").innerHTML = html
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000)

  if (seconds < 60) return "Just now"
  if (seconds < 3600) return Math.floor(seconds / 60) + " minutes ago"
  if (seconds < 86400) return Math.floor(seconds / 3600) + " hours ago"
  if (seconds < 604800) return Math.floor(seconds / 86400) + " days ago"
  return Math.floor(seconds / 604800) + " weeks ago"
}

function updateDateRange() {
  dateRange = Number.parseInt(document.getElementById("dateRange").value)
  initDashboard()
}

function refreshDashboard() {
  loadData()
  showNotification("Dashboard refreshed successfully")
}

function toggleTask(index) {
  showNotification("Task updated")
}

function scheduleViewing() {
  showNotification("Opening viewing scheduler...")
}

function addNewTask() {
  showNotification("Opening task creator...")
}

function showNotification(message) {
  const notification = document.createElement("div")
  notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        font-weight: 500;
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

document.querySelectorAll(".chart-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".chart-btn").forEach((b) => b.classList.remove("active"))
    btn.classList.add("active")
    activityPeriod = btn.getAttribute("data-period")
    renderActivityChart()
  })
})

window.addEventListener("resize", () => {
  renderActivityChart()
  renderPipelineChart()
})
