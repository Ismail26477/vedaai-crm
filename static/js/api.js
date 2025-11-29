// API helper functions for CRM application

class CRMApi {
    constructor() {
        this.baseURL = '/api';
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const finalOptions = { ...defaultOptions, ...options };

        try {
            const response = await fetch(url, finalOptions);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API request error:', error);
            throw error;
        }
    }

    // Dashboard API methods
    async getDashboardMetrics() {
        return this.request('/dashboard/metrics');
    }

    async getDashboardCharts() {
        return this.request('/dashboard/charts');
    }

    // Leads API methods
    async getLeads(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/leads${queryString ? '?' + queryString : ''}`);
    }

    async createLead(leadData) {
        return this.request('/leads', {
            method: 'POST',
            body: JSON.stringify(leadData)
        });
    }

    async updateLead(leadId, leadData) {
        return this.request(`/leads/${leadId}`, {
            method: 'PUT',
            body: JSON.stringify(leadData)
        });
    }

    async deleteLead(leadId) {
        return this.request(`/leads/${leadId}`, {
            method: 'DELETE'
        });
    }

    // Contacts API methods
    async getContacts(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/contacts${queryString ? '?' + queryString : ''}`);
    }

    async createContact(contactData) {
        return this.request('/contacts', {
            method: 'POST',
            body: JSON.stringify(contactData)
        });
    }

    async updateContact(contactId, contactData) {
        return this.request(`/contacts/${contactId}`, {
            method: 'PUT',
            body: JSON.stringify(contactData)
        });
    }

    async deleteContact(contactId) {
        return this.request(`/contacts/${contactId}`, {
            method: 'DELETE'
        });
    }

    // Companies API methods
    async getCompanies(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/companies${queryString ? '?' + queryString : ''}`);
    }

    async createCompany(companyData) {
        return this.request('/companies', {
            method: 'POST',
            body: JSON.stringify(companyData)
        });
    }

    async updateCompany(companyId, companyData) {
        return this.request(`/companies/${companyId}`, {
            method: 'PUT',
            body: JSON.stringify(companyData)
        });
    }

    async deleteCompany(companyId) {
        return this.request(`/companies/${companyId}`, {
            method: 'DELETE'
        });
    }

    // Search API method
    async search(query) {
        return this.request(`/search?q=${encodeURIComponent(query)}`);
    }

    // Export API methods
    async exportData(type, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = `${this.baseURL}/export/${type}${queryString ? '?' + queryString : ''}`;
        
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Export failed: ${response.status}`);
            }

            // Create download
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `${type}_export_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);

            return true;
        } catch (error) {
            console.error('Export error:', error);
            throw error;
        }
    }
}

// Create global API instance
const api = new CRMApi();

// Export for use in other scripts
window.api = api;

// Helper function to handle API errors gracefully
window.handleApiError = function(error, fallbackMessage = 'An error occurred') {
    console.error('API Error:', error);
    
    let message = fallbackMessage;
    if (error.message) {
        message = error.message;
    }
    
    // Show error to user
    CRMApp.showError('', message);
    
    return false;
};

// Helper function for successful API operations
window.handleApiSuccess = function(message) {
    CRMApp.showSuccess(message);
};

// Pagination helper for API calls
window.getPaginationParams = function() {
    return {
        limit: currentLimit,
        offset: currentOffset
    };
};

// Filter helper for API calls
window.getFilterParams = function(formId) {
    const form = document.getElementById(formId);
    if (!form) return {};
    
    const formData = new FormData(form);
    const params = {};
    
    for (let [key, value] of formData.entries()) {
        if (value.trim()) {
            params[key] = value;
        }
    }
    
    return params;
};