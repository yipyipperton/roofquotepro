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

    // Date/Time Scheduler States
    const [showScheduler, setShowScheduler] = useState(false);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedTime, setSelectedTime] = useState('');
    const [appointmentDetails, setAppointmentDetails] = useState(null);

    // Get today's date formatted as YYYY-MM-DD for the min date attribute
    const todayStr = new Date().toISOString().split('T')[0];

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
                if (data.status === 'Inspection Scheduled' || data.appointment) {
                    setScheduled(true);
                    if (data.appointment) {
                        setAppointmentDetails(data.appointment);
                    }
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

    const handleConfirmAppointment = async (e) => {
        e.preventDefault();
        if (!selectedDate || !selectedTime) {
            alert('Please select both a date and time slot.');
            return;
        }

        setScheduling(true);
        const appointmentObj = { date: selectedDate, time: selectedTime };

        try {
            const res = await fetch(`/api/leads/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appointment: appointmentObj })
            });
            const result = await res.json();
            if (result.success) {
                setScheduled(true);
                setAppointmentDetails(appointmentObj);
                setShowScheduler(false);
            } else {
                alert('Failed to schedule appointment. Please try again.');
            }
        } catch (e) {
            console.error('Error scheduling inspection:', e);
            alert('Connection failed. Please check network.');
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
    const avgPrice = Math.round((estimate.minPrice + estimate.maxPrice) / 2);

    // Calculate percentages for custom progress bar breakdown
    const totalParts = estimate.breakdown.materials + estimate.breakdown.labor + estimate.breakdown.fees;
    const pctMat = Math.round((estimate.breakdown.materials / totalParts) * 100);
    const pctLab = Math.round((estimate.breakdown.labor / totalParts) * 100);
    const pctFee = Math.round((estimate.breakdown.fees / totalParts) * 100);

    return (
        <div className="min-h-screen bg-[#070a13] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
            
            {/* Header */}
            <header className="border-b border-white/5 bg-[#070a13]/80 backdrop-blur-md sticky top-0 z-40">
                <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => router.push('/')}>
                        <svg className="w-7 h-7 text-indigo-500 filter drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                        <span className="font-heading font-extrabold text-2xl tracking-tight text-white">QUOTRA<span className="text-indigo-500">MAX</span></span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 uppercase tracking-widest">
                        Quote Issued
                    </span>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-grow max-w-5xl w-full mx-auto px-6 py-12">
                
                {/* Status Alert Bar */}
                <div className="mb-8 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl flex items-start gap-3 shadow-lg">
                    <span className="text-lg">📄</span>
                    <div>
                        <strong>Your Ballpark Estimate Report has been generated!</strong> A copy of the pricing breakdown has been sent to <strong>{lead.email}</strong>.
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* Left Column: Overhauled Visual Cost Card */}
                    <div className="lg:col-span-7 space-y-6">
                        <div className="border border-white/10 rounded-2xl bg-[#0d1222]/80 backdrop-blur-2xl p-8 shadow-2xl overflow-hidden relative before:absolute before:top-0 before:left-0 before:w-full before:height-[4px] before:bg-gradient-to-r before:from-indigo-500 before:to-emerald-400">
                            <span className="text-xs font-bold text-indigo-400 tracking-widest uppercase">Project Cost Valuation</span>
                            <h2 className="text-2xl font-black text-white mt-1 mb-8">Ballpark Estimate Report</h2>

                            {/* Circular Cost Ring Gauge Showcase */}
                            <div className="flex flex-col items-center justify-center p-6 border border-white/5 bg-[#12182c]/40 rounded-2xl mb-8 relative">
                                <div className="absolute inset-0 bg-radial-gradient from-indigo-500/5 to-transparent rounded-2xl pointer-events-none"></div>
                                <div className="w-48 h-48 rounded-full border-4 border-indigo-500/10 border-t-indigo-500 border-r-emerald-400 flex flex-col items-center justify-center text-center shadow-[0_0_30px_rgba(99,102,241,0.1)] relative">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Avg Budget</span>
                                    <span className="text-3xl font-black text-white mt-1">${avgPrice.toLocaleString()}</span>
                                    <span className="text-[9px] text-slate-400 mt-2 px-4 uppercase tracking-wider">{lead.material}</span>
                                </div>
                                <div className="text-center mt-6">
                                    <span className="text-xs font-bold text-slate-400 block mb-1">PRELIMINARY PRICE RANGE</span>
                                    <div className="text-2xl font-black text-emerald-400 select-all tracking-tight">
                                        ${estimate.minPrice.toLocaleString()} - ${estimate.maxPrice.toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            {/* Cost Breakdown Progress Bars Graph */}
                            <div className="space-y-5 mb-8">
                                <h3 className="text-xs font-bold text-slate-450 uppercase tracking-widest border-b border-white/5 pb-2">Ballpark Itemized Breakdown</h3>
                                
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-400">Premium Materials Cost</span>
                                        <span className="font-bold text-slate-200">${estimate.breakdown.materials.toLocaleString()} ({pctMat}%)</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pctMat}%` }}></div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-400">Crew Rigging & Installation Labor</span>
                                        <span className="font-bold text-slate-200">${estimate.breakdown.labor.toLocaleString()} ({pctLab}%)</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-purple-500 rounded-full" style={{ width: `${pctLab}%` }}></div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-400">Permits, Safety, & Disposal Fees</span>
                                        <span className="font-bold text-slate-200">${estimate.breakdown.fees.toLocaleString()} ({pctFee}%)</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pctFee}%` }}></div>
                                    </div>
                                </div>
                            </div>

                            {/* Results Core CTAs */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/5 pt-6">
                                <button onClick={handleDownloadPDF} className="w-full bg-[#12182c] hover:bg-[#161e38] text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 border border-white/10 transition-colors text-sm">
                                    ⬇️ Download Cost PDF
                                </button>
                                
                                {scheduled ? (
                                    <div className="flex flex-col gap-1 w-full">
                                        <button disabled className="w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold py-3.5 px-4 rounded-xl flex flex-col items-center justify-center gap-0.5 cursor-not-allowed">
                                            <span className="text-xs font-bold">✓ Inspection Scheduled!</span>
                                            {appointmentDetails && (
                                                <span className="text-[9px] font-medium text-emerald-300">
                                                    {new Date(appointmentDetails.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} @ {appointmentDetails.time}
                                                </span>
                                            )}
                                        </button>
                                        <button onClick={() => setShowScheduler(true)} className="text-[10px] text-slate-500 hover:text-white underline text-center mt-1.5 transition-colors">
                                            Reschedule appointment time slot
                                        </button>
                                    </div>
                                ) : (
                                    <button onClick={() => setShowScheduler(true)} className="w-full bg-indigo-500 hover:bg-indigo-650 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm shadow-[0_4px_14px_rgba(99,102,241,0.2)]">
                                        📆 Schedule Site Inspection
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Parameters and Scheduler Modal */}
                    <div className="lg:col-span-5 space-y-6">
                        
                        {/* Interactive Scheduler Card inline toggle */}
                        {showScheduler && (
                            <div className="border border-indigo-500/30 rounded-2xl bg-[#0f1428] p-6 shadow-2xl relative overflow-hidden before:absolute before:top-0 before:left-0 before:w-full before:height-[3px] before:bg-indigo-500">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Select Inspection Date & Time</h3>
                                    <button onClick={() => setShowScheduler(false)} className="text-slate-500 hover:text-white font-bold text-lg">×</button>
                                </div>

                                <form onSubmit={handleConfirmAppointment} className="space-y-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider" htmlFor="selectedDate">Choose Date</label>
                                        <input type="date" id="selectedDate" min={todayStr} required value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full bg-[#161c33] border border-white/10 rounded-xl px-3.5 py-3 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Choose Time Slot</label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {[
                                                { label: '🌅 Morning (9:00 AM - 11:00 AM)', val: 'Morning (9AM-11AM)' },
                                                { label: '☀️ Midday (11:00 AM - 1:00 PM)', val: 'Midday (11AM-1PM)' },
                                                { label: '🕒 Afternoon (1:00 PM - 3:00 PM)', val: 'Afternoon (1PM-3PM)' },
                                                { label: '🌆 Late Afternoon (3:00 PM - 5:00 PM)', val: 'Late Afternoon (3PM-5PM)' }
                                            ].map((slot) => (
                                                <button key={slot.val} type="button" onClick={() => setSelectedTime(slot.val)} className={`px-4 py-2.5 rounded-xl border text-left text-xs font-semibold transition-all ${selectedTime === slot.val ? 'bg-indigo-500/10 border-indigo-500 text-white' : 'bg-[#161c33] border-white/5 text-slate-400 hover:border-white/10'}`}>
                                                    {slot.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <button type="submit" disabled={scheduling} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors text-xs shadow-[0_4px_12px_rgba(16,185,129,0.2)] mt-2">
                                        {scheduling ? 'Scheduling...' : 'Confirm Appointment Slot'}
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* Project Context Parameters */}
                        <div className="border border-white/10 rounded-2xl bg-[#0d1222]/80 backdrop-blur-2xl p-6 shadow-2xl">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-white/5 pb-2 mb-4">Project Parameters</h3>
                            <ul className="space-y-3.5 text-xs">
                                <li className="flex justify-between items-center">
                                    <span className="text-slate-450">Estimated Area:</span>
                                    <span className="font-bold text-slate-200">{lead.size.toLocaleString()} sq ft</span>
                                </li>
                                <li className="flex justify-between items-center">
                                    <span className="text-slate-450">Stories Elevation:</span>
                                    <span className="font-bold text-slate-200">{lead.stories} Story</span>
                                </li>
                                <li className="flex justify-between items-center">
                                    <span className="text-slate-450">Condition Profile:</span>
                                    <span className="font-bold text-slate-200">{lead.condition}</span>
                                </li>
                                <li className="flex justify-between items-center">
                                    <span className="text-slate-450">Material Style:</span>
                                    <span className="font-bold text-slate-200">{lead.material}</span>
                                </li>
                                <li className="flex justify-between items-center">
                                    <span className="text-slate-450">Target Service:</span>
                                    <span className="font-bold text-slate-200">{lead.service}</span>
                                </li>
                            </ul>
                        </div>

                        {/* Technical Factors explanation */}
                        <div className="border border-white/10 rounded-2xl bg-[#0d1222]/80 backdrop-blur-2xl p-6 shadow-2xl">
                            <h3 className="text-xs font-bold text-slate-450 uppercase tracking-widest border-b border-white/5 pb-2 mb-4">Pricing Factors Detected</h3>
                            <ul className="space-y-3">
                                {estimate.factors.map((factor, idx) => (
                                    <li key={idx} className="text-[11px] text-slate-400 leading-relaxed flex gap-2 items-start">
                                        <span className="text-indigo-400 mt-0.5">•</span>
                                        {factor}
                                    </li>
                                ))}
                            </ul>
                        </div>



                    </div>
                </div>
            </main>

            {/* persistent footer login links */}
            <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-500 bg-[#070a13] mt-12 flex flex-col gap-2 items-center">
                <p>&copy; {new Date().getFullYear()} Quotramax. All rights reserved.</p>
                <p className="text-[11px] text-slate-400">
                    Are you a contractor?{' '}
                    <span onClick={() => router.push('/login')} className="text-indigo-400 hover:underline hover:text-indigo-300 cursor-pointer font-bold">
                        Contractor Sign In Portal
                    </span>
                </p>
            </footer>
        </div>
    );
}
