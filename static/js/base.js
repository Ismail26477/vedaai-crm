// Navigation functionality
document.addEventListener("DOMContentLoaded", () => {
  initializeSidebar()
  initializeSearch()
  initializeAnimations()
  updateActiveNav()

  // Wait 500ms to ensure DOM is fully rendered
  setTimeout(() => {
    updateNavCounters()
    loadHomeStats()
    loadRecentActivities()  // Added call to load recent activities
    loadNotifications();  // Added call to load notifications
    loadUserProfile();  // Added call to load user profile info
  }, 500)
})

// Sidebar functionality
function initializeSidebar() {
  const sidebar = document.getElementById("sidebar")
  const sidebarToggle = document.getElementById("sidebarToggle")
  const mobileMenuBtn = document.getElementById("mobileMenuBtn")

  // Desktop sidebar toggle
  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
      sidebar.classList.toggle("collapsed")
    })
  }

  // Mobile menu toggle
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener("click", () => {
      sidebar.classList.toggle("open")
    })
  }

  // Close sidebar when clicking outside on mobile
  document.addEventListener("click", (event) => {
    if (window.innerWidth <= 768) {
      if (!sidebar.contains(event.target) && !mobileMenuBtn.contains(event.target)) {
        sidebar.classList.remove("open")
      }
    }
  })

  // Handle window resize
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) {
      sidebar.classList.remove("open")
    }
  })
}

// Update active navigation item based on current page
function updateActiveNav() {
  const currentPage = window.location.pathname.split("/").pop() || "index.html"
  const navItems = document.querySelectorAll(".nav-item")

  navItems.forEach((item) => {
    const href = item.getAttribute("href")
    if (href === currentPage) {
      item.classList.add("active")
    } else {
      item.classList.remove("active")
    }
  })
}

// Search functionality
function initializeSearch() {
  const searchInput = document.querySelector(".search-bar input")

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase()

      // Add debounce for better performance
      clearTimeout(searchInput.debounceTimer)
      searchInput.debounceTimer = setTimeout(() => {
        handleSearch(query)
      }, 300)
    })

    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const query = e.target.value
        console.log("Searching for:", query)
        // Implement actual search functionality here
      }
    })
  }
}

function handleSearch(query) {
  if (query.length < 2) return

  console.log("Searching for:", query)
  // Implement search logic here
  // This could search through leads, deals, customers, etc.
}

// Animation on scroll
function initializeAnimations() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px",
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1"
        entry.target.style.transform = "translateY(0)"
      }
    })
  }, observerOptions)

  // Observe elements that should animate
  const animatedElements = document.querySelectorAll(".access-card, .timeline-item")
  animatedElements.forEach((el) => {
    el.style.opacity = "0"
    el.style.transform = "translateY(20px)"
    el.style.transition = "opacity 0.5s ease, transform 0.5s ease"
    observer.observe(el)
  })
}

// Update notification badge
function updateNotificationBadge(count) {
  const badge = document.querySelector(".notification-dot")
  if (badge) {
    if (count > 0) {
      badge.style.display = "block"
    } else {
      badge.style.display = "none"
    }
  }
}

// Update nav counters
function updateNavCounters() {
  console.log("[v0] Starting updateNavCounters...")

  fetch("/api/sidebar-stats", {
    method: "GET",
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
    },
  })
    .then((response) => {
      console.log("[v0] API response status:", response.status)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return response.json()
    })
    .then((data) => {
      console.log("[v0] Full API response:", JSON.stringify(data))

      if (data.success && data.stats) {
        const stats = data.stats
        console.log("[v0] Stats data:", stats)

        const allCounts = document.querySelectorAll(".nav-count")
        console.log("[v0] Found", allCounts.length, "nav-count elements")

        if (allCounts.length >= 2) {
          // First nav-count is Leads
          allCounts[0].textContent = stats.total_leads
          console.log("[v0] Updated Leads to:", stats.total_leads)

          // Second nav-count is Pipeline
          allCounts[1].textContent = stats.pipeline_count
          console.log("[v0] Updated Pipeline to:", stats.pipeline_count)
        }

        if (allCounts.length >= 3) {
          allCounts[2].textContent = stats.total_customers
          console.log("[v0] Updated Customers to:", stats.total_customers)
        }

        const cardLeadsCount = document.getElementById("card-leads-count")
        if (cardLeadsCount) {
          cardLeadsCount.textContent = stats.total_leads
          console.log("[v0] Updated card leads badge to:", stats.total_leads)
        }

        const cardPipelineCount = document.getElementById("card-pipeline-count")
        if (cardPipelineCount) {
          cardPipelineCount.textContent = stats.pipeline_count
          console.log("[v0] Updated card pipeline badge to:", stats.pipeline_count)
        }
      } else {
        console.warn("[v0] Response success is false or no stats object")
      }
    })
    .catch((error) => {
      console.error("[v0] FETCH ERROR:", error)
    })

  // Refresh every 30 seconds
  setTimeout(() => {
    updateNavCounters()
  }, 30000)
}

// Load home page statistics
function loadHomeStats() {
  console.log("[v0] Starting loadHomeStats...")

  fetch("/api/home-stats", {
    method: "GET",
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
    },
    credentials: "same-origin",
  })
    .then((response) => {
      console.log("[v0] Home stats API response status:", response.status)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return response.json()
    })
    .then((data) => {
      console.log("[v0] Home stats data received:", JSON.stringify(data))

      if (data.success && data.stats) {
        const stats = data.stats
        console.log("[v0] Parsed stats:", stats)

        // Update Total Leads
        const totalLeadsElement = document.getElementById("totalLeadsValue")
        if (totalLeadsElement) {
          totalLeadsElement.textContent = stats.total_leads || "-"
          console.log("[v0] Updated Total Leads to:", stats.total_leads)
        } else {
          console.warn("[v0] totalLeadsValue element not found")
        }

        // Update Conversion Rate
        const conversionElement = document.getElementById("conversionRateValue")
        if (conversionElement) {
          conversionElement.textContent = (stats.conversion_rate || 0) + "%"
          console.log("[v0] Updated Conversion to:", stats.conversion_rate)
        } else {
          console.warn("[v0] conversionRateValue element not found")
        }

        // Update Active Deals
        const activeDealsElement = document.getElementById("activeDealsValue")
        if (activeDealsElement) {
          activeDealsElement.textContent = stats.active_deals || "-"
          console.log("[v0] Updated Active Deals to:", stats.active_deals)
        } else {
          console.warn("[v0] activeDealsValue element not found")
        }
      } else {
        console.warn("[v0] Response success is false or no stats object")
      }
    })
    .catch((error) => {
      console.error("[v0] HOME STATS FETCH ERROR:", error)
    })
}

// Load recent activities
function loadRecentActivities() {
  console.log("[v0] Starting loadRecentActivities...")

  fetch("/api/home-activities?limit=5", {
    method: "GET",
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
    },
    credentials: "same-origin",
  })
    .then((response) => {
      console.log("[v0] Activities API response status:", response.status)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return response.json()
    })
    .then((data) => {
      console.log("[v0] Activities data received:", JSON.stringify(data))

      if (data.success && data.activities) {
        const activitiesContainer = document.getElementById("activitiesContainer")
        if (!activitiesContainer) {
          console.warn("[v0] activitiesContainer element not found")
          return
        }

        // Clear existing content
        activitiesContainer.innerHTML = ""

        const activities = data.activities
        console.log("[v0] Processing", activities.length, "activities")

        if (activities.length === 0) {
          activitiesContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No recent activities</p>'
          return
        }

        // Map activity types to icons and styles
        const activityConfig = {
          stage_change: {
            icon: "📋",
            label: "Stage Changed",
          },
          call: {
            icon: "📞",
            label: "Call Logged",
          },
          assigned: {
            icon: "👤",
            label: "Assigned",
          },
          lead_created: {
            icon: "👥",
            label: "Lead Added",
          },
          lead_imported: {
            icon: "📥",
            label: "Lead Imported",
          },
          lead_updated: {
            icon: "✏️",
            label: "Lead Updated",
          },
          bulk_import: {
            icon: "📊",
            label: "Bulk Import",
          },
          default: {
            icon: "📝",
            label: "Activity",
          },
        }

        activities.forEach((activity) => {
          const config = activityConfig[activity.activityType] || activityConfig.default
          const createdAt = new Date(activity.createdAt)
          const timeAgo = getTimeAgo(createdAt)

          const activityEl = document.createElement("div")
          activityEl.className = "activity-item"
          activityEl.innerHTML = `
            <div class="activity-icon">${config.icon}</div>
            <div class="activity-content">
              <div class="activity-description">${activity.description}</div>
              <div class="activity-meta">
                <span class="activity-actor">${activity.performedByName || "Unknown"}</span>
                <span class="activity-time">${timeAgo}</span>
              </div>
            </div>
          `
          activitiesContainer.appendChild(activityEl)
        })
      } else {
        const activitiesContainer = document.getElementById("activitiesContainer")
        if (activitiesContainer) {
          activitiesContainer.innerHTML = '<p style="color: var(--danger-color);">Error loading activities</p>'
        }
        console.warn("[v0] Response success is false or no activities array")
      }
    })
    .catch((error) => {
      console.error("[v0] ACTIVITIES FETCH ERROR:", error)
      const activitiesContainer = document.getElementById("activitiesContainer")
      if (activitiesContainer) {
        activitiesContainer.innerHTML = '<p style="color: var(--danger-color);">Error loading activities</p>'
      }
    })
}

// Helper function to calculate time ago (e.g., "5 minutes ago")
function getTimeAgo(dateInput) {
  let date;
  
  // Handle both Date objects and ISO string timestamps
  if (typeof dateInput === 'string') {
    date = new Date(dateInput);
  } else if (dateInput instanceof Date) {
    date = dateInput;
  } else {
    return 'Recently';
  }
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    return 'Recently';
  }
  
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 0) {
    return 'Just now';
  }
  
  let interval = seconds / 31536000;
  if (interval > 1) {
    return Math.floor(interval) + ' year' + (Math.floor(interval) > 1 ? 's' : '') + ' ago';
  }
  
  interval = seconds / 2592000;
  if (interval > 1) {
    return Math.floor(interval) + ' month' + (Math.floor(interval) > 1 ? 's' : '') + ' ago';
  }
  
  interval = seconds / 86400;
  if (interval > 1) {
    return Math.floor(interval) + ' day' + (Math.floor(interval) > 1 ? 's' : '') + ' ago';
  }
  
  interval = seconds / 3600;
  if (interval > 1) {
    return Math.floor(interval) + ' hour' + (Math.floor(interval) > 1 ? 's' : '') + ' ago';
  }
  
  interval = seconds / 60;
  if (interval > 1) {
    return Math.floor(interval) + ' minute' + (Math.floor(interval) > 1 ? 's' : '') + ' ago';
  }
  
  return Math.floor(seconds) + ' second' + (Math.floor(seconds) > 1 ? 's' : '') + ' ago';
}

// Toast notification system
function showToast(message, type = "info") {
  const toast = document.createElement("div")
  toast.className = `toast toast-${type}`

  const icons = {
    success:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
    error:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
    warning:
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
    info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
  }

  toast.innerHTML = `
        ${icons[type] || icons.info}
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </button>
    `

  // Add toast styles if not already added
  if (!document.getElementById("toast-styles")) {
    const style = document.createElement("style")
    style.id = "toast-styles"
    style.textContent = `
            .toast {
                position: fixed;
                top: 100px;
                right: 2rem;
                background: white;
                padding: 1rem 1.5rem;
                border-radius: 0.75rem;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
                display: flex;
                align-items: center;
                gap: 0.75rem;
                z-index: 10000;
                animation: slideInRight 0.3s ease;
                max-width: 400px;
            }
            .toast button {
                background: transparent;
                border: none;
                cursor: pointer;
                color: var(--text-secondary);
                padding: 0.25rem;
                border-radius: 0.25rem;
                display: flex;
                transition: all 0.2s;
            }
            .toast button:hover {
                background: var(--background);
            }
            .toast-success {
                border-left: 4px solid var(--success-color);
                color: var(--success-color);
            }
            .toast-error {
                border-left: 4px solid var(--danger-color);
                color: var(--danger-color);
            }
            .toast-warning {
                border-left: 4px solid var(--warning-color);
                color: var(--warning-color);
            }
            .toast-info {
                border-left: 4px solid var(--primary-color);
                color: var(--primary-color);
            }
            .toast span {
                flex: 1;
                color: var(--text-primary);
                font-size: 0.938rem;
            }
            @keyframes slideInRight {
                from {
                    opacity: 0;
                    transform: translateX(100%);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
        `
    document.head.appendChild(style)
  }

  document.body.appendChild(toast)

  // Auto remove after 5 seconds
  setTimeout(() => {
    toast.style.animation = "slideInRight 0.3s ease reverse"
    setTimeout(() => toast.remove(), 300)
  }, 5000)
}

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  // Ctrl/Cmd + K for search
  if ((e.ctrlKey || e.metaKey) && e.key === "k") {
    e.preventDefault()
    const searchInput = document.querySelector(".search-bar input")
    if (searchInput) {
      searchInput.focus()
    }
  }

  // Escape to close sidebar on mobile
  if (e.key === "Escape") {
    const sidebar = document.getElementById("sidebar")
    if (sidebar && sidebar.classList.contains("open")) {
      sidebar.classList.remove("open")
    }
  }
})

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault()
    const target = document.querySelector(this.getAttribute("href"))
    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }
  })
})

window.refreshActivityFeed = function() {
  console.log("[v0] Refreshing activity feed and stats...")
  loadRecentActivities()
  loadHomeStats()
}

// Notification loading function
function loadNotifications() {
  console.log("[v0] Starting loadNotifications function");
  
  const notificationListEl = document.getElementById('notificationList');
  const notificationDotEl = document.getElementById('notificationDot');
  if (!notificationListEl || !notificationDotEl) {
    console.warn("[v0] Notification elements not found");
    return;
  }
  
  try {
    const storedNotifications = sessionStorage.getItem('crm_notifications');
    const notifications = storedNotifications ? JSON.parse(storedNotifications) : [];
    
    console.log("[v0] Loaded", notifications.length, 'notifications from storage');
    
    if (notifications && notifications.length > 0) {
      notificationListEl.innerHTML = '';
      notificationDotEl.style.display = 'block';
      
      // Show latest notifications first
      notifications.slice().reverse().forEach(notification => {
        const notificationItem = createNotificationItem(notification);
        notificationListEl.appendChild(notificationItem);
      });
    } else {
      notificationListEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #94a3b8;">No notifications yet</div>';
      notificationDotEl.style.display = 'none';
    }
  } catch (error) {
    console.error("[v0] Error loading notifications:", error.message);
    notificationListEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #ff6b6b;">Error loading notifications</div>';
    notificationDotEl.style.display = 'none';
  }
}

function createNotificationItem(notification) {
  const item = document.createElement('div');
  item.style.cssText = 'padding: 12px; border-bottom: 1px solid #e2e8f0; display: flex; gap: 10px; align-items: flex-start; cursor: pointer; transition: background 0.2s;';
  item.onmouseover = () => item.style.background = '#f8fafc';
  item.onmouseout = () => item.style.background = 'transparent';
  
  // Create a mapping for notification types
  const notificationTypeMap = {
    lead_added: { icon: '➕', color: '#16a34a', label: 'Lead Added' },
    lead_imported: { icon: '📥', color: '#3b82f6', label: 'Lead Imported' },
    lead_updated: { icon: '✏️', color: '#f59e0b', label: 'Lead Updated' },
    lead_deleted: { icon: '🗑️', color: '#dc2626', label: 'Lead Deleted' },
    stage_changed: { icon: '📋', color: '#9333ea', label: 'Stage Changed' },
    bulk_import: { icon: '📊', color: '#06b6d4', label: 'Bulk Import' },
    call_logged: { icon: '📞', color: '#ec4899', label: 'Call Logged' },
    notification: { icon: '📝', color: '#2563eb', label: 'Notification' },
  };
  
  const typeLabel = notification.type || notification.activityType || 'notification';
  const typeConfig = notificationTypeMap[typeLabel] || { icon: '📝', color: '#2563eb', label: 'Notification' };
  
  const timeAgoString = getTimeAgo(notification.timestamp || notification.createdAt);
  
  item.innerHTML = `
    <div style="font-size: 18px; flex-shrink: 0; color: ${typeConfig.color};">${typeConfig.icon}</div>
    <div style="flex: 1; min-width: 0;">
      <div style="font-size: 13px; font-weight: 500; color: #1e293b;">${notification.title || typeConfig.label}</div>
      <div style="font-size: 12px; color: #64748b; margin-top: 4px;">${notification.message || 'No details available'}</div>
      <div style="font-size: 11px; color: #94a3b8; margin-top: 6px;">${timeAgoString}</div>
    </div>
  `;
  
  return item;
}

function toggleNotificationDropdown() {
  const dropdownEl = document.getElementById('notificationDropdown');
  if (dropdownEl.style.display === 'none') {
    dropdownEl.style.display = 'block';
    loadNotifications(); // Refresh notifications when opening dropdown
  } else {
    dropdownEl.style.display = 'none';
  }
}

// New function to load and display user profile information
function loadUserProfile() {
  console.log("[v0] Loading user profile information");
  
  try {
    // Get user data from the page (set by Flask template)
    const userNameEl = document.getElementById('userName');
    const userInitialsEl = document.getElementById('userInitials');
    const userRoleEl = document.getElementById('userRole');
    
    // Fetch current user info from Flask session
    fetch('/api/user-profile', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin'
    })
    .then(response => {
      console.log("[v0] User profile API response status:", response.status);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log("[v0] User profile data received:", data);
      
      if (data.success && data.user) {
        const user = data.user;
        
        // Update name
        if (userNameEl) {
          userNameEl.textContent = user.username || user.email || 'Admin';
          console.log("[v0] Updated user name to:", user.username);
        }
        
        // Update role
        if (userRoleEl) {
          userRoleEl.textContent = user.role || 'Administrator';
          console.log("[v0] Updated user role to:", user.role);
        }
        
        // Update initials
        if (userInitialsEl) {
          const username = user.username || user.email || 'A';
          const initials = username.substring(0, 2).toUpperCase();
          userInitialsEl.textContent = initials;
          console.log("[v0] Updated user initials to:", initials);
        }
      } else {
        console.warn("[v0] Failed to load user profile");
      }
    })
    .catch(error => {
      console.error("[v0] Error loading user profile:", error.message);
      // Fallback to defaults if API fails
      if (userInitialsEl) userInitialsEl.textContent = 'A';
      if (userNameEl) userNameEl.textContent = 'Admin';
      if (userRoleEl) userRoleEl.textContent = 'Administrator';
    });
  } catch (error) {
    console.error("[v0] Error in loadUserProfile:", error);
  }
}

// Logout function that redirects to /logout endpoint
function logout() {
  console.log("[v0] User clicked logout button");
  window.location.href = '/logout';
}

console.log("CRM Platform initialized successfully!")
