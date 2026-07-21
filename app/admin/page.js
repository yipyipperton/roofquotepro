'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Admin() {
    const router = useRouter();
    const [leads, setLeads] = useState([]);
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('leads'); // 'leads' or 'settings'
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [selectedLead, setSelectedLead] = useState(null);

    // Settings form states
    const [settingsForm, setSettingsForm] = useState({
        rateAsphalt: 3.60,
        rateMetal: 5.80,
        rateSlate: 8.50,
        rateInstall: 1.75,
        mult2Story: 1.20,
        mult3Story: 1.40,
        contractorEmail: '',
        gmapsApiKey: '',
        resendApiKey: '',
        adminUsername: '',
        adminPassword: ''
    });
    const [savingSettings, setSavingSettings] = useState(false);
    const [settingsSuccess, setSettingsSuccess] = useState(false);
    const [settingsError, setSettingsError] = useState('');

    useEffect(() => {
        // Fetch leads (which acts as auth check)
        fetch('/api/leads')
            .then(res => {
                if (res.status === 401) {
                    router.push('/login');
                    throw new Error('Unauthorized');
                }
                return res.json();
            })
            .then(data => {
                setLeads(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
            });

        // Fetch settings
        fetch('/api/settings')
            .then(res => {
                if (res.status === 401) return null;
                return res.json();
            })
            .then(data => {
                if (data) {
                    setSettings(data);
                    setSettingsForm({
                        rateAsphalt: data.rateAsphalt || 3.60,
                        rateMetal: data.rateMetal || 5.80,
                        rateSlate: data.rateSlate || 8.50,
                        rateInstall: data.rateInstall || 1.75,
                        mult2Story: data.mult2Story || 1.20,
                        mult3Story: data.mult3Story || 1.40,
                        contractorEmail: data.contractorEmail || '',
                        gmapsApiKey: data.gmapsApiKey || '',
                        resendApiKey: data.resendApiKey || '',
                        adminUsername: data.adminUsername || '',
                        adminPassword: '' // Blank for security
                    });
                }
            })
            .catch(err => console.error(err));
    }, [router]);

    const handleLogout = async () => {
        await fetch('/api/logout', { method: 'POST' });
        router.push('/login');
    };

    const handleStatusChange = async (leadId, newStatus) => {
        try {
            const res = await fetch(`/api/leads/${leadId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            const result = await res.json();
            if (result.success) {
                setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
                if (selectedLead && selectedLead.id === leadId) {
                    setSelectedLead(prev => ({ ...prev, status: newStatus }));
                }
            }
        } catch (e) {
            console.error('Error patching lead status:', e);
        }
    };

    const handleSettingsSave = async (e) => {
        e.preventDefault();
        setSavingSettings(true);
        setSettingsSuccess(false);
        setSettingsError('');

        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settingsForm)
            });
            const result = await res.json();
            if (result.success) {
                setSettingsSuccess(true);
                // Clear password input field after successful write
                setSettingsForm(prev => ({ ...prev, adminPassword: '' }));
            } else {
                setSettingsError(result.error || 'Failed to save settings');
            }
        } catch (err) {
            console.error(err);
            setSettingsError('Connection failed.');
        } finally {
            setSavingSettings(false);
        }
    };

    const handleSettingsInputChange = (e) => {
        const { id, value } = e.target;
        setSettingsForm(prev => ({
            ...prev,
            [id]: e.target.type === 'number' ? parseFloat(value) : value
        }));
    };

    const handleClearLeads = async () => {
        if (!confirm('Are you absolutely sure you want to clear ALL leads? This cannot be undone.')) return;

        try {
            const res = await fetch('/api/leads/clear', { method: 'POST' });
            const result = await res.json();
            if (result.success) {
                setLeads([]);
                setSelectedLead(null);
            }
        } catch (e) {
            console.error(e);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#070a13] text-slate-100 flex flex-col items-center justify-center font-sans">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm font-semibold text-slate-400">Opening Dashboard Panel...</span>
                </div>
            </div>
        );
    }

    // Filter leads
    const filteredLeads = leads.filter(lead => {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
            lead.name.toLowerCase().includes(query) ||
            lead.email.toLowerCase().includes(query) ||
            lead.address.toLowerCase().includes(query) ||
            lead.id.toLowerCase().includes(query);

        const matchesStatus = statusFilter === 'All' || lead.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    // KPI Metrics
    const totalLeadsCount = leads.length;
    const newLeadsCount = leads.filter(l => l.status === 'New').length;
    const scheduledCount = leads.filter(l => l.status === 'Inspection Scheduled').length;
    const wonCount = leads.filter(l => l.status === 'Won').length;
    const winRate = totalLeadsCount > 0 ? Math.round((wonCount / totalLeadsCount) * 100) : 0;

    return (
        <div className="min-h-screen bg-[#070a13] text-slate-100 flex flex-col font-sans">
            
            {/* Nav */}
            <header className="border-b border-white/5 bg-[#070a13]/80 backdrop-blur-md sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <svg className="w-7 h-7 text-indigo-500 filter drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                        <span className="font-heading font-bold text-xl tracking-tight text-white">QUOTRA<span className="text-indigo-500">MAX</span></span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 border border-white/5 rounded px-2 py-0.5 ml-2">Console</span>
                    </div>

                    <div className="flex items-center gap-6">
                        <nav className="flex gap-1 bg-slate-900/80 p-1 rounded-lg border border-white/5">
                            <button onClick={() => setActiveTab('leads')} className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'leads' ? 'bg-indigo-500 text-white shadow-[0_0_12px_rgba(99,102,241,0.3)]' : 'text-slate-400 hover:text-white'}`}>
                                Leads List
                            </button>
                            <button onClick={() => setActiveTab('settings')} className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'settings' ? 'bg-indigo-500 text-white shadow-[0_0_12px_rgba(99,102,241,0.3)]' : 'text-slate-400 hover:text-white'}`}>
                                Pricing Rates
                            </button>
                        </nav>

                        <button onClick={handleLogout} className="text-xs font-medium text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1.5">
                            🚪 Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Dashboard Workspace */}
            <main className="flex-grow max-w-7xl w-full mx-auto px-6 py-10">

                {activeTab === 'leads' && (
                    <div className="space-y-8">
                        
                        {/* KPI Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="border border-white/5 rounded-xl bg-slate-900/40 p-5 shadow-lg">
                                <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider mb-2">Total Leads</span>
                                <div className="text-3xl font-extrabold text-white">{totalLeadsCount}</div>
                            </div>
                            <div className="border border-white/5 rounded-xl bg-slate-900/40 p-5 shadow-lg">
                                <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider mb-2">New Requests</span>
                                <div className="text-3xl font-extrabold text-indigo-400">{newLeadsCount}</div>
                            </div>
                            <div className="border border-white/5 rounded-xl bg-slate-900/40 p-5 shadow-lg">
                                <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider mb-2">Inspections Scheduled</span>
                                <div className="text-3xl font-extrabold text-amber-400">{scheduledCount}</div>
                            </div>
                            <div className="border border-white/5 rounded-xl bg-slate-900/40 p-5 shadow-lg">
                                <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider mb-2">Conversion Win Rate</span>
                                <div className="text-3xl font-extrabold text-emerald-400">{winRate}%</div>
                            </div>
                        </div>

                        {/* Search & Filter Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/35 border border-white/5 p-4 rounded-xl">
                            <div className="relative flex-grow max-w-md">
                                <input type="text" placeholder="Search by name, address, email, or quote ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-slate-850/80 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-indigo-500 text-white transition-colors" />
                                <span className="absolute left-3 top-3.5 text-slate-500 text-xs">🔍</span>
                            </div>

                            <div className="flex gap-4 items-center">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Status:</span>
                                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-850 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-white">
                                        <option value="All">All Statuses</option>
                                        <option value="New">New</option>
                                        <option value="Contacted">Contacted</option>
                                        <option value="Inspection Scheduled">Inspection Scheduled</option>
                                        <option value="Won">Won</option>
                                        <option value="Lost">Lost</option>
                                    </select>
                                </div>
                                <button onClick={handleClearLeads} className="text-xs font-semibold text-slate-500 hover:text-red-400 transition-colors border border-white/5 hover:border-red-500/20 bg-slate-850/40 px-3 py-2 rounded-lg">
                                    🗑️ Clear Database
                                </button>
                            </div>
                        </div>

                        {/* Lead Management Table */}
                        <div className="border border-white/5 rounded-xl bg-slate-900/20 overflow-hidden shadow-2xl">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/5 bg-slate-900/50 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                            <th className="py-4 px-6">Quote ID</th>
                                            <th className="py-4 px-6">Customer Name</th>
                                            <th className="py-4 px-6">Address</th>
                                            <th className="py-4 px-6">Scope / Material</th>
                                            <th className="py-4 px-6">Est. Total</th>
                                            <th className="py-4 px-6">Lead Status</th>
                                            <th className="py-4 px-6">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                                        {filteredLeads.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className="py-12 text-center text-slate-500 font-semibold">
                                                    No lead estimate requests found matching criteria.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredLeads.map((lead) => (
                                                <tr key={lead.id} onClick={() => setSelectedLead(lead)} className="hover:bg-white/[0.02] cursor-pointer transition-colors">
                                                    <td className="py-4 px-6 font-mono font-semibold text-slate-400">{lead.id}</td>
                                                    <td className="py-4 px-6 font-bold text-white">
                                                        {lead.name}
                                                        <span className="block text-[10px] font-normal text-slate-400 mt-1">{lead.email}</span>
                                                    </td>
                                                    <td className="py-4 px-6 text-slate-300 max-w-[200px] truncate">{lead.address}</td>
                                                    <td className="py-4 px-6">
                                                        <span className="font-semibold block">{lead.service}</span>
                                                        <span className="text-[10px] text-slate-500 block mt-0.5">{lead.material}</span>
                                                    </td>
                                                    <td className="py-4 px-6 font-bold text-emerald-400">${lead.price.toLocaleString()}</td>
                                                    <td className="py-4 px-6" onClick={(e) => e.stopPropagation()}>
                                                        <select value={lead.status} onChange={(e) => handleStatusChange(lead.id, e.target.value)} className={`px-2.5 py-1.5 rounded-lg font-bold border text-[10px] outline-none focus:border-indigo-500 cursor-pointer ${
                                                            lead.status === 'New' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' :
                                                            lead.status === 'Contacted' ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' :
                                                            lead.status === 'Inspection Scheduled' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                                                            lead.status === 'Won' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                                            'bg-slate-800 border-white/5 text-slate-400'
                                                        }`}>
                                                            <option value="New">New</option>
                                                            <option value="Contacted">Contacted</option>
                                                            <option value="Inspection Scheduled">Inspection Scheduled</option>
                                                            <option value="Won">Won</option>
                                                            <option value="Lost">Lost</option>
                                                        </select>
                                                        {lead.status === 'Inspection Scheduled' && lead.appointment && (
                                                            <span className="block text-[9px] font-bold text-amber-400 mt-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-center truncate max-w-[120px]">
                                                                📅 {lead.appointment.date}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-6 text-slate-500">
                                                        {new Date(lead.date).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="max-w-2xl mx-auto">
                        <div className="border border-white/5 rounded-2xl bg-slate-900/50 backdrop-blur-xl p-8 shadow-2xl overflow-hidden relative before:absolute before:top-0 before:left-0 before:w-full before:height-[3px] before:bg-gradient-to-r before:from-indigo-500 before:to-emerald-400">
                            <h2 className="text-xl font-bold text-white mb-2">Estimate Pricing Calculator Rates</h2>
                            <p className="text-sm text-slate-400 mb-8">Update base rates and safety height multipliers calibrated to your local crew pricing specs.</p>

                            {settingsSuccess && (
                                <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-lg text-center font-semibold">
                                    ✓ Calculator settings saved successfully.
                                </div>
                            )}

                            {settingsError && (
                                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-lg text-center">
                                    {settingsError}
                                </div>
                            )}

                            <form onSubmit={handleSettingsSave} className="space-y-6">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-white/5 pb-2">Base Material Styles (Per Sq Ft)</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs text-slate-400" htmlFor="rateAsphalt">Asphalt Shingles</label>
                                        <input id="rateAsphalt" type="number" step="0.01" value={settingsForm.rateAsphalt} onChange={handleSettingsInputChange} className="bg-slate-850 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs text-slate-400" htmlFor="rateMetal">Standing Metal</label>
                                        <input id="rateMetal" type="number" step="0.01" value={settingsForm.rateMetal} onChange={handleSettingsInputChange} className="bg-slate-850 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs text-slate-400" htmlFor="rateSlate">Slate / Clay Tile</label>
                                        <input id="rateSlate" type="number" step="0.01" value={settingsForm.rateSlate} onChange={handleSettingsInputChange} className="bg-slate-850 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs text-slate-400 font-bold" htmlFor="rateInstall">Base Install Labor Rate</label>
                                        <input id="rateInstall" type="number" step="0.01" value={settingsForm.rateInstall} onChange={handleSettingsInputChange} className="bg-slate-850 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs text-slate-400 font-bold" htmlFor="contractorEmail">Alert Receiver Email</label>
                                        <input id="contractorEmail" type="email" value={settingsForm.contractorEmail} onChange={handleSettingsInputChange} className="bg-slate-850 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white" />
                                    </div>
                                </div>

                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-white/5 pb-2 pt-4">Safety Height Multipliers</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs text-slate-400" htmlFor="mult2Story">2 Story Height Multiplier</label>
                                        <input id="mult2Story" type="number" step="0.01" value={settingsForm.mult2Story} onChange={handleSettingsInputChange} className="bg-slate-850 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs text-slate-400" htmlFor="mult3Story">3 Story Height Multiplier</label>
                                        <input id="mult3Story" type="number" step="0.01" value={settingsForm.mult3Story} onChange={handleSettingsInputChange} className="bg-slate-850 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white" />
                                    </div>
                                </div>

                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-white/5 pb-2 pt-4">Admin Security Portal Update</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs text-slate-400" htmlFor="adminUsername">Admin Username</label>
                                        <input id="adminUsername" type="text" value={settingsForm.adminUsername} onChange={handleSettingsInputChange} className="bg-slate-850 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white" />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs text-slate-400" htmlFor="adminPassword">New Password (Leave blank to keep current)</label>
                                        <input id="adminPassword" type="password" value={settingsForm.adminPassword} onChange={handleSettingsInputChange} placeholder="Update password" className="bg-slate-850 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white" />
                                    </div>
                                </div>

                                <button type="submit" disabled={savingSettings} className="w-full bg-indigo-500 hover:bg-indigo-650 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-[0_4px_14px_rgba(99,102,241,0.3)] mt-6">
                                    {savingSettings ? 'Saving Settings...' : 'Save Calculator Config'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

            </main>

            {/* Lead Details Modal Overlay Drawer */}
            {selectedLead && (
                <div className="fixed inset-0 bg-[#070a13]/85 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setSelectedLead(null)}>
                    <div className="border border-white/15 bg-slate-900 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setSelectedLead(null)} className="absolute top-4 right-4 text-slate-500 hover:text-white font-bold text-2xl transition-colors">
                            ×
                        </button>
                        
                        <div className="p-8 space-y-6">
                            
                            {/* Lead Header */}
                            <div>
                                <span className="text-[10px] font-bold text-indigo-400 border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 rounded uppercase tracking-wider">{selectedLead.id}</span>
                                <h3 className="text-2xl font-bold text-white mt-2">{selectedLead.name}</h3>
                                <p className="text-xs text-slate-400 mt-1">Submitted on {new Date(selectedLead.date).toLocaleString()}</p>
                            </div>

                            <hr className="border-white/5" />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                                
                                {/* Info block */}
                                <div className="space-y-4">
                                    <h4 className="font-bold text-slate-300 uppercase tracking-widest text-[10px]">Contact Info & Target</h4>
                                    <div>
                                        <span className="text-slate-500 block">Email Address:</span>
                                        <a href={`mailto:${selectedLead.email}`} className="text-indigo-400 font-semibold hover:underline block">{selectedLead.email}</a>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 block">Phone Number:</span>
                                        <span className="text-slate-200 block font-semibold">{selectedLead.phone || 'Not provided'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 block">Physical Address:</span>
                                        <span className="text-slate-200 block font-semibold leading-relaxed">{selectedLead.address}</span>
                                    </div>
                                </div>

                                {/* Details block */}
                                <div className="space-y-4">
                                    <h4 className="font-bold text-slate-300 uppercase tracking-widest text-[10px]">Roof Parameters</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <span className="text-slate-500 block">Size:</span>
                                            <span className="text-slate-200 font-semibold">{selectedLead.size.toLocaleString()} sq ft</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 block">Material:</span>
                                            <span className="text-slate-200 font-semibold">{selectedLead.material}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 block">Height Stories:</span>
                                            <span className="text-slate-200 font-semibold">{selectedLead.stories} Story</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 block">Service Scope:</span>
                                            <span className="text-slate-200 font-semibold">{selectedLead.service}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 block">Condition:</span>
                                            <span className="text-slate-200 font-semibold">{selectedLead.condition}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 block">Property:</span>
                                            <span className="text-slate-200 font-semibold">{selectedLead.propertyType}</span>
                                        </div>
                                    </div>
                                </div>

                            </div>

                            {/* Scheduled Appointment Alert inside modal */}
                            {selectedLead.status === 'Inspection Scheduled' && selectedLead.appointment && (
                                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-center gap-3 text-amber-400">
                                    <span className="text-xl">📅</span>
                                    <div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-500">Scheduled Inspection Appointment</span>
                                        <strong className="text-sm">{new Date(selectedLead.appointment.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                                        <span className="block text-xs font-semibold mt-0.5 text-slate-300">{selectedLead.appointment.time}</span>
                                    </div>
                                </div>
                            )}

                            {/* Estimate Range Summary */}
                            <div className="bg-slate-850 border border-white/5 p-4 rounded-xl flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Estimated Price Range</span>
                                    <span className="text-xl font-bold text-emerald-400">${selectedLead.estimate?.minPrice.toLocaleString()} - ${selectedLead.estimate?.maxPrice.toLocaleString()}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Lead Status</span>
                                    <select value={selectedLead.status} onChange={(e) => handleStatusChange(selectedLead.id, e.target.value)} className="bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500 cursor-pointer mt-1">
                                        <option value="New">New</option>
                                        <option value="Contacted">Contacted</option>
                                        <option value="Inspection Scheduled">Inspection Scheduled</option>
                                        <option value="Won">Won</option>
                                        <option value="Lost">Lost</option>
                                    </select>
                                </div>
                            </div>

                            {/* Uploaded Photos Grid */}
                            {selectedLead.photos && selectedLead.photos.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="font-bold text-slate-300 uppercase tracking-widest text-[10px]">Uploaded Roof & Exterior Photos</h4>
                                    <div className="grid grid-cols-3 gap-3">
                                        {selectedLead.photos.map((url, idx) => (
                                            <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="relative aspect-square border border-white/5 rounded-lg overflow-hidden block hover:opacity-80 transition-opacity">
                                                <img src={url} alt={`Client upload ${idx}`} className="w-full h-full object-cover" />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Footer Actions */}
                            <div className="flex justify-between items-center border-t border-white/5 pt-6">
                                <a href={`/api/leads/${selectedLead.id}/pdf`} target="_blank" className="bg-slate-800 hover:bg-slate-750 text-white text-xs font-bold py-2.5 px-4 rounded-lg flex items-center gap-1.5 border border-white/10 transition-colors">
                                    ⬇️ Download PDF Quote Copy
                                </a>
                                <button onClick={() => setSelectedLead(null)} className="bg-indigo-500 hover:bg-indigo-650 text-white text-xs font-bold py-2.5 px-6 rounded-lg transition-colors shadow-[0_4px_14px_rgba(99,102,241,0.2)]">
                                    Close Review
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* Footer */}
            <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-500 bg-[#070a13]">
                <p>&copy; {new Date().getFullYear()} Quotramax. All rights reserved.</p>
            </footer>
        </div>
    );
}
