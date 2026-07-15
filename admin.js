// Quotramax - Contractor Dashboard Frontend Logic

document.addEventListener('DOMContentLoaded', () => {
    loadLeads();
    loadSettings();
    initDashboardActions();

    // Auto refresh leads table every 30 seconds
    setInterval(loadLeads, 30000);
});

// 1. API GET: Load Leads & Parse Stats
async function loadLeads() {
    try {
        const response = await fetch('/api/leads');
        if (!response.ok) {
            if (response.status === 401) {
                // Redirect unauthorized visitors
                window.location.href = '/login.html';
                return;
            }
            throw new Error('Failed to load leads from server');
        }

        const leads = await response.json();
        renderStats(leads);
        renderLeadsTable(leads);
    } catch (err) {
        console.error('Error fetching leads:', err);
    }
}

function renderStats(leads) {
    const totalLeads = leads.length;
    let pipeline = 0;
    leads.forEach(lead => pipeline += lead.price);
    const averageDeal = totalLeads > 0 ? Math.round(pipeline / totalLeads) : 0;

    document.getElementById('stat-total-leads').textContent = totalLeads;
    document.getElementById('stat-pipeline').textContent = `$${pipeline.toLocaleString()}`;
    document.getElementById('stat-average-deal').textContent = `$${averageDeal.toLocaleString()}`;
}

function renderLeadsTable(leads) {
    const tableBody = document.getElementById('leads-table-body');
    tableBody.innerHTML = '';

    if (leads.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No leads captured yet. Run a quote calculation on the home portal!</td></tr>`;
        return;
    }

    leads.forEach(lead => {
        const tr = document.createElement('tr');
        
        let materialText = 'Asphalt';
        if (lead.material === 'metal') materialText = 'Metal';
        else if (lead.material === 'slate') materialText = 'Slate';

        const statusClass = lead.status === 'scheduled' ? 'scheduled' : 'sent';
        const statusLabel = lead.status === 'scheduled' ? 'Inspection Booked' : 'Quote Sent';

        tr.innerHTML = `
            <td data-label="Date">${lead.date}</td>
            <td data-label="Customer">
                <span class="lead-name">${lead.name}</span>
                <span class="lead-email">${lead.email} | ${lead.phone}</span>
            </td>
            <td data-label="Address">${lead.address}</td>
            <td data-label="Specs">${lead.size.toLocaleString()} sqft | ${materialText}</td>
            <td data-label="Estimate" style="font-weight: 600; color: var(--accent);">$${lead.price.toLocaleString()}</td>
            <td data-label="Status"><span class="status-badge ${statusClass}">${statusLabel}</span></td>
        `;
        tableBody.appendChild(tr);
    });
}

// 2. API GET: Load settings values (Fetch from secure admin endpoint)
async function loadSettings() {
    try {
        const response = await fetch('/api/admin/settings');
        if (!response.ok) {
            if (response.status === 401) {
                window.location.href = '/login.html';
                return;
            }
            throw new Error('Failed to load settings');
        }
        const settings = await response.json();

        document.getElementById('gmaps-api-key').value = settings.gmapsApiKey || '';
        document.getElementById('resend-api-key').value = settings.resendApiKey || '';
        document.getElementById('contractor-email').value = settings.contractorEmail || '';
        document.getElementById('rate-asphalt').value = settings.rateAsphalt;
        document.getElementById('rate-metal').value = settings.rateMetal;
        document.getElementById('rate-slate').value = settings.rateSlate;
        document.getElementById('rate-install').value = settings.rateInstall;
        document.getElementById('mult-steep').value = settings.multSteep;
        document.getElementById('mult-2story').value = settings.mult2Story;
        document.getElementById('mult-3story').value = settings.mult3Story;
    } catch (err) {
        console.error('Error fetching settings:', err);
    }
}

// 3. API POST Actions: Save settings, clear database, logout session
function initDashboardActions() {
    const form = document.getElementById('pricing-settings-form');
    const btnClearLeads = document.getElementById('btn-clear-leads');
    const btnLogout = document.getElementById('btn-logout');

    // Save configurations
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const updatedSettings = {
            rateAsphalt: parseFloat(document.getElementById('rate-asphalt').value) || 1.50,
            rateMetal: parseFloat(document.getElementById('rate-metal').value) || 3.20,
            rateSlate: parseFloat(document.getElementById('rate-slate').value) || 5.80,
            rateInstall: parseFloat(document.getElementById('rate-install').value) || 1.75,
            multSteep: parseFloat(document.getElementById('mult-steep').value) || 1.30,
            mult2Story: parseFloat(document.getElementById('mult-2story').value) || 1.20,
            mult3Story: parseFloat(document.getElementById('mult-3story').value) || 1.40,
            gmapsApiKey: document.getElementById('gmaps-api-key').value.trim(),
            resendApiKey: document.getElementById('resend-api-key').value.trim(),
            contractorEmail: document.getElementById('contractor-email').value.trim()
        };

        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedSettings)
            });

            if (response.ok) {
                alert('Pricing configurations and settings saved successfully!');
                loadLeads(); // refresh statistics recalculations
            } else {
                alert('Error: Failed to save changes.');
            }
        } catch (err) {
            console.error('Error saving settings:', err);
        }
    });

    // Wipe leads
    btnClearLeads.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear all lead records? This cannot be undone.')) {
            try {
                const response = await fetch('/api/leads/clear', { method: 'POST' });
                if (response.ok) {
                    loadLeads();
                } else {
                    alert('Error clearing leads list.');
                }
            } catch (err) {
                console.error('Error wiping leads database:', err);
            }
        }
    });

    // Sign out session
    btnLogout.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/logout', { method: 'POST' });
            if (response.ok) {
                window.location.href = '/login.html';
            }
        } catch (err) {
            console.error('Logout error:', err);
        }
    });
}
