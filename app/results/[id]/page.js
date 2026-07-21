'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function Results() {
    const { id } = useParams();
    const router = useRouter();
    const [lead, setLead] = useState(null);
    const [loading, setLoading] = useState(true);
    const [scheduling, setScheduling] = useState(false);
    const [scheduled, setScheduled] = useState(false);
    const [contractor, setContractor] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!id) return;

        // Fetch lead details
        fetch(`/api/leads/${id}`)
            .then(res => {
                if (!res.ok) throw new Error('Estimate not found');
                return res.json();
            })
            .then(data => {
                setLead(data);
                if (data.status === 'Inspection Scheduled') {
                    setScheduled(true);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setError('Failed to load estimate details.');
                setLoading(false);
            });

        // Fetch public contractor details
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => setContractor(data))
            .catch(err => console.error('Error loading contractor settings:', err));
    }, [id]);

    const handleDownloadPDF = () => {
        window.open(`/api/leads/${id}/pdf`, '_blank');
    };

    const handleScheduleInspection = async () => {
        setScheduling(true);
        try {
            const res = await fetch(`/api/leads/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scheduleInspection: true })
            });
            const result = await res.json();
            if (result.success) {
                setScheduled(true);
            }
        } catch (e) {
            console.error('Error scheduling inspection:', e);
        } finally {
            setScheduling(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#070a13] text-slate-100 flex flex-col items-center justify-center font-sans">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm font-semibold text-slate-400">Loading Your Estimate Report...</span>
                </div>
            </div>
        );
    }

    if (error || !lead) {
        return (
            <div className="min-h-screen bg-[#070a13] text-slate-100 flex flex-col items-center justify-center font-sans px-6 text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Error Loading Report</h2>
                <p className="text-sm text-slate-400 mb-6">{error || 'The estimate request could not be found.'}</p>
                <button onClick={() => router.push('/')} className="bg-indigo-500 hover:bg-indigo-650 text-white font-bold px-6 py-3 rounded-lg transition-colors">
                    Back to Home
                </button>
            </div>
        );
    }

    const { estimate } = lead;

    return (
        <div className="min-h-screen bg-[#070a13] text-slate-100 flex flex-col font-sans">
            {/* Header */}
            <header className="border-b border-white/5 bg-[#070a13]/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/')}>
                        <svg className="w-7 h-7 text-indigo-500 filter drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                        <span className="font-heading font-bold text-xl tracking-tight">QUOTRA<span className="text-indigo-500">MAX</span></span>
                    </div>
                    <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                        Lead ID: {lead.id}
                    </span>
                </div>
            </header>

            {/* Results Body */}
            <main className="flex-grow max-w-5xl w-full mx-auto px-6 py-12">
                
                {/* Visual Alert Notification banner */}
                <div className="mb-8 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl flex items-center gap-3">
                    <span className="text-lg">📄</span>
                    <div>
                        <strong>Estimate Dispatched!</strong> A detailed PDF report has been compiled and emailed to <strong>{lead.email}</strong>.
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* Left Panel: Estimate Card Details */}
                    <div className="lg:col-span-7 space-y-6">
                        <div className="border border-white/5 rounded-2xl bg-slate-900/50 backdrop-blur-xl p-8 shadow-2xl overflow-hidden relative before:absolute before:top-0 before:left-0 before:w-full before:height-[3px] before:bg-gradient-to-r before:from-indigo-500 before:to-emerald-400">
                            <span className="text-xs font-semibold text-indigo-400 tracking-widest uppercase">Your Custom Roof Estimate</span>
                            <h2 className="text-2xl font-bold text-white mt-1 mb-6">Estimate for <span className="text-indigo-300 font-extrabold">{lead.address}</span></h2>

                            {/* Estimated Price Range display */}
                            <div className="bg-slate-850/60 border border-white/5 p-6 rounded-xl mb-6">
                                <span className="text-xs font-bold text-slate-500 block mb-1">PRELIMINARY BUDGET RANGE</span>
                                <div className="text-3xl sm:text-4xl font-extrabold text-emerald-400 select-all">
                                    ${estimate.minPrice.toLocaleString()} - ${estimate.maxPrice.toLocaleString()}
                                </div>
                                <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
                                    * Note: This calculation is a preliminary ballpark estimate. Actual pricing varies based on exact slope pitch measurements and tear-off configuration checks.
                                </p>
                            </div>

                            {/* Cost itemization breakdown */}
                            <div className="space-y-4 mb-8">
                                <h3 className="text-sm font-bold text-slate-300 tracking-wide uppercase border-b border-white/5 pb-2">Estimated Cost Breakdown</h3>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-400">Premium Materials</span>
                                    <span className="font-semibold text-slate-200">${estimate.breakdown.materials.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-400">Professional Installation Labor</span>
                                    <span className="font-semibold text-slate-200">${estimate.breakdown.labor.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-400">Permits, Debris & Safety Fees</span>
                                    <span className="font-semibold text-slate-200">${estimate.breakdown.fees.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-base font-bold border-t border-dashed border-white/10 pt-3">
                                    <span className="text-slate-300">Estimated Total (Avg)</span>
                                    <span className="text-emerald-400">${lead.price.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* CTAs */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button onClick={handleDownloadPDF} className="w-full bg-slate-800 hover:bg-slate-750 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 border border-white/10 transition-colors">
                                    ⬇️ Download Quote PDF
                                </button>
                                
                                {scheduled ? (
                                    <button disabled className="w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed">
                                        ✓ Inspection Scheduled!
                                    </button>
                                ) : (
                                    <button onClick={handleScheduleInspection} disabled={scheduling} className="w-full bg-indigo-500 hover:bg-indigo-650 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-[0_4px_14px_rgba(99,102,241,0.2)]">
                                        {scheduling ? 'Scheduling...' : '📆 Request Inspection'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Factors & Next steps */}
                    <div className="lg:col-span-5 space-y-6">
                        
                        {/* Pricing Factors */}
                        <div className="border border-white/5 rounded-2xl bg-slate-900/50 backdrop-blur-xl p-6 shadow-2xl">
                            <h3 className="text-sm font-bold text-slate-300 tracking-wide uppercase border-b border-white/5 pb-2 mb-4">Pricing Factors Detected</h3>
                            <ul className="space-y-3">
                                {estimate.factors.map((factor, idx) => (
                                    <li key={idx} className="text-xs text-slate-400 leading-relaxed flex gap-2 items-start">
                                        <span className="text-indigo-400 mt-0.5">•</span>
                                        {factor}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Next Steps */}
                        <div className="border border-white/5 rounded-2xl bg-slate-900/50 backdrop-blur-xl p-6 shadow-2xl">
                            <h3 className="text-sm font-bold text-slate-300 tracking-wide uppercase border-b border-white/5 pb-2 mb-4">Recommended Next Steps</h3>
                            <ul className="space-y-3">
                                {estimate.nextSteps.map((stepText, idx) => (
                                    <li key={idx} className="text-xs text-slate-400 leading-relaxed flex gap-2 items-start">
                                        <span className="text-emerald-400 mt-0.5">✓</span>
                                        {stepText}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Contractor branding / contact card */}
                        <div className="border border-white/5 rounded-2xl bg-slate-900/50 backdrop-blur-xl p-6 shadow-2xl text-center">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Contractor Information</h4>
                            <span className="font-heading font-extrabold text-lg text-white block mb-1">QUOTRAMAX SERVICES</span>
                            <span className="text-xs text-indigo-400 font-bold block mb-4">Licensed & Insured Local Crew</span>
                            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                                Need immediate assistance? Reach our coordinator directly.
                            </p>
                            <a href={`mailto:${contractor?.contractorEmail || 'isaaqabukar1@gmail.com'}`} className="block w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-semibold text-slate-200 transition-colors">
                                ✉️ Email Coordinator
                            </a>
                        </div>

                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-500 bg-[#070a13] mt-12">
                <p>&copy; {new Date().getFullYear()} Quotramax. All rights reserved.</p>
            </footer>
        </div>
    );
}
