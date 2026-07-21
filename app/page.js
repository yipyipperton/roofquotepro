'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        propertyType: 'Residential',
        stories: '1',
        roofSize: 2000,
        condition: 'Good',
        service: 'Replacement',
        material: 'Asphalt shingles',
        photos: []
    });

    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [gmapsKey, setGmapsKey] = useState('');

    const autocompleteRef = useRef(null);
    const addressInputRef = useRef(null);

    // Fetch Google Maps key on mount
    useEffect(() => {
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data.gmapsApiKey) {
                    setGmapsKey(data.gmapsApiKey);
                }
            })
            .catch(err => console.error('Error fetching settings:', err));
    }, []);

    // Initialize Google Places Autocomplete
    useEffect(() => {
        if (!gmapsKey || !addressInputRef.current) return;

        const loadScript = () => {
            if (window.google) {
                initAutocomplete();
                return;
            }
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${gmapsKey}&libraries=places`;
            script.async = true;
            script.defer = true;
            script.onload = initAutocomplete;
            document.head.appendChild(script);
        };

        const initAutocomplete = () => {
            if (!window.google || !addressInputRef.current) return;
            autocompleteRef.current = new window.google.maps.places.Autocomplete(addressInputRef.current, {
                types: ['address']
            });

            autocompleteRef.current.addListener('place_changed', () => {
                const place = autocompleteRef.current.getPlace();
                if (place && place.formatted_address) {
                    setFormData(prev => ({ ...prev, address: place.formatted_address }));
                }
            });
        };

        loadScript();
    }, [gmapsKey, step]);

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSliderChange = (e) => {
        setFormData(prev => ({ ...prev, roofSize: parseInt(e.target.value) }));
    };

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setUploading(true);
        setError('');

        const uploadPromises = files.map(async (file) => {
            const data = new FormData();
            data.append('file', file);

            const res = await fetch('/api/upload', {
                method: 'POST',
                body: data
            });

            const result = await res.json();
            if (result.success) {
                return result.url;
            } else {
                throw new Error(result.error || 'Failed to upload photo');
            }
        });

        try {
            const uploadedUrls = await Promise.all(uploadPromises);
            setFormData(prev => ({
                ...prev,
                photos: [...prev.photos, ...uploadedUrls]
            }));
        } catch (err) {
            setError(err.message || 'File upload failed');
        } finally {
            setUploading(false);
        }
    };

    const removePhoto = (index) => {
        setFormData(prev => ({
            ...prev,
            photos: prev.photos.filter((_, i) => i !== index)
        }));
    };

    const validateStep = () => {
        setError('');
        if (step === 1) {
            if (!formData.name.trim()) return 'Please enter your full name.';
            if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) return 'Please enter a valid email address.';
            if (!formData.address.trim()) return 'Please enter your street address.';
        }
        return '';
    };

    const handleNext = () => {
        const validationError = validateStep();
        if (validationError) {
            setError(validationError);
            return;
        }
        setStep(prev => prev + 1);
    };

    const handlePrev = () => {
        setError('');
        setStep(prev => prev - 1);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        try {
            const res = await fetch('/api/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await res.json();
            if (result.success && result.leadId) {
                router.push(`/results/${result.leadId}`);
            } else {
                setError(result.error || 'Failed to submit estimate request');
                setSubmitting(false);
            }
        } catch (err) {
            console.error('Submission error:', err);
            setError('Connection failed. Please try again.');
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#070a13] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
            {/* Header */}
            <header className="border-b border-white/5 bg-[#070a13]/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => setStep(1)}>
                        <svg className="w-7 h-7 text-indigo-500 filter drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                        <span className="font-heading font-bold text-xl tracking-tight">QUOTRA<span className="text-indigo-500">MAX</span></span>
                    </div>
                    <button onClick={() => router.push('/login')} className="text-sm font-medium text-slate-400 hover:text-white transition-colors bg-white/5 border border-white/10 px-4 py-2 rounded-lg">
                        Contractor Login
                    </button>
                </div>
            </header>

            {/* Main Split-Screen Content */}
            <main className="flex-grow max-w-7xl w-full mx-auto px-6 py-12 flex flex-col justify-center">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                    
                    {/* Left Column: Branding and Value Props */}
                    <div className="lg:col-span-7 flex flex-col justify-center py-4">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 w-fit mb-6 uppercase tracking-wider">
                            ⚡ Fast Lead Capture Funnel
                        </span>
                        
                        <h1 className="font-heading text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight text-white mb-6">
                            Get Your Roof Replacement <br />
                            <span className="bg-gradient-to-r from-indigo-400 via-indigo-500 to-emerald-400 bg-clip-text text-transparent">
                                Estimate Online
                            </span>
                        </h1>
                        
                        <p className="text-lg text-slate-400 leading-relaxed mb-8 max-w-xl">
                            Answer a few questions and receive a preliminary estimate from a roofing professional. No sales calls, no hassle, and direct PDF delivery.
                        </p>

                        {/* Trust List */}
                        <ul className="space-y-6 max-w-md mb-8">
                            <li className="flex gap-4 items-start">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                                    ✓
                                </span>
                                <div>
                                    <strong className="block text-slate-200 text-sm font-bold">Speed First Response</strong>
                                    <span className="text-xs text-slate-400">Get a ballpark pricing range instantly instead of waiting days for calls.</span>
                                </div>
                            </li>
                            <li className="flex gap-4 items-start">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                                    ✓
                                </span>
                                <div>
                                    <strong className="block text-slate-200 text-sm font-bold">Direct PDF Delivery</strong>
                                    <span className="text-xs text-slate-400">Receive a detailed materials and labor estimate document directly in your inbox.</span>
                                </div>
                            </li>
                            <li className="flex gap-4 items-start">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                                    ✓
                                </span>
                                <div>
                                    <strong className="block text-slate-200 text-sm font-bold">Secure Data Privacy</strong>
                                    <span className="text-xs text-slate-400">Your details are only shared with the licensed contractor managing your review.</span>
                                </div>
                            </li>
                        </ul>
                    </div>

                    {/* Right Column: The Estimator Wizard Card */}
                    <div className="lg:col-span-5 w-full">
                        <div className="relative border border-white/5 rounded-2xl bg-slate-900/50 backdrop-blur-xl p-8 shadow-2xl overflow-hidden before:absolute before:top-0 before:left-0 before:w-full before:height-[3px] before:bg-gradient-to-r before:from-indigo-500 before:to-emerald-400">
                            
                            {/* Step Indicator */}
                            <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-6">
                                {[1, 2, 3, 4].map((s) => (
                                    <div key={s} className="flex items-center gap-2">
                                        <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                                            step === s ? 'bg-indigo-500 text-white shadow-[0_0_12px_rgba(99,102,241,0.4)]' :
                                            step > s ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' :
                                            'bg-slate-800 border border-white/5 text-slate-500'
                                        }`}>
                                            {step > s ? '✓' : s}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {error && (
                                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-lg">
                                    {error}
                                </div>
                            )}

                            {/* STEP 1: Customer Details */}
                            {step === 1 && (
                                <div>
                                    <h2 className="text-xl font-bold text-white mb-2">Customer & Project Location</h2>
                                    <p className="text-sm text-slate-400 mb-6">Enter your contact details so we can dispatch your report.</p>

                                    <div className="space-y-4">
                                        <div className="flex flex-col gap-2">
                                            <label className="text-xs font-semibold text-slate-400" htmlFor="name">Full Name</label>
                                            <input id="name" type="text" value={formData.name} onChange={handleInputChange} placeholder="John Doe" className="w-full bg-slate-850 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="text-xs font-semibold text-slate-400" htmlFor="email">Email Address</label>
                                            <input id="email" type="email" value={formData.email} onChange={handleInputChange} placeholder="john@example.com" className="w-full bg-slate-850 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="text-xs font-semibold text-slate-400" htmlFor="phone">Phone Number (Optional)</label>
                                            <input id="phone" type="tel" value={formData.phone} onChange={handleInputChange} placeholder="(727) 808-4646" className="w-full bg-slate-850 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
                                        </div>
                                        <div className="flex flex-col gap-2 relative">
                                            <label className="text-xs font-semibold text-slate-400" htmlFor="address">Street Address</label>
                                            <input id="address" ref={addressInputRef} type="text" value={formData.address} onChange={handleInputChange} placeholder="100 Broadway, New York, NY" className="w-full bg-slate-850 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center mt-8 pt-6 border-t border-white/5">
                                        <div></div>
                                        <button onClick={handleNext} className="bg-indigo-500 hover:bg-indigo-650 text-white font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-all shadow-[0_4px_14px_rgba(99,102,241,0.3)]">
                                            Next Step
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: Property Specs */}
                            {step === 2 && (
                                <div>
                                    <h2 className="text-xl font-bold text-white mb-2">Property Parameters</h2>
                                    <p className="text-sm text-slate-400 mb-6">Specify the size and height properties of your building.</p>

                                    <div className="space-y-6">
                                        <div className="flex flex-col gap-2">
                                            <label className="text-xs font-semibold text-slate-400">Property Type</label>
                                            <div className="grid grid-cols-2 gap-4">
                                                <button onClick={() => setFormData(prev => ({ ...prev, propertyType: 'Residential' }))} className={`py-3 rounded-lg border text-sm font-semibold transition-all ${formData.propertyType === 'Residential' ? 'bg-indigo-500/10 border-indigo-500 text-white' : 'bg-slate-850 border-white/5 text-slate-400'}`}>
                                                    🏠 Residential
                                                </button>
                                                <button onClick={() => setFormData(prev => ({ ...prev, propertyType: 'Commercial' }))} className={`py-3 rounded-lg border text-sm font-semibold transition-all ${formData.propertyType === 'Commercial' ? 'bg-indigo-500/10 border-indigo-500 text-white' : 'bg-slate-850 border-white/5 text-slate-400'}`}>
                                                    🏢 Commercial
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <label className="text-xs font-semibold text-slate-400" htmlFor="stories">Building Height</label>
                                            <select id="stories" value={formData.stories} onChange={handleInputChange} className="w-full bg-slate-850 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors">
                                                <option value="1">1 Story</option>
                                                <option value="2">2 Stories</option>
                                                <option value="3">3+ Stories</option>
                                            </select>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <label className="text-xs font-semibold text-slate-400" htmlFor="roofSize">Approximate Roof Size: <span className="text-indigo-400 font-bold">{formData.roofSize.toLocaleString()} sq ft</span></label>
                                            <input type="range" id="roofSize" min="1000" max="6000" step="100" value={formData.roofSize} onChange={handleSliderChange} className="w-full h-2 rounded-lg bg-slate-850 appearance-none cursor-pointer accent-indigo-500" />
                                            <div className="flex justify-between text-[10px] text-slate-500 px-1 font-semibold">
                                                <span>1,000 sq ft</span>
                                                <span>3,500 sq ft</span>
                                                <span>6,000+ sq ft</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center mt-8 pt-6 border-t border-white/5">
                                        <button onClick={handlePrev} className="text-slate-400 hover:text-white text-sm font-semibold flex items-center gap-1 transition-colors">
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                                            Back
                                        </button>
                                        <button onClick={handleNext} className="bg-indigo-500 hover:bg-indigo-650 text-white font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-all shadow-[0_4px_14px_rgba(99,102,241,0.3)]">
                                            Next Step
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: Roof Specs */}
                            {step === 3 && (
                                <div>
                                    <h2 className="text-xl font-bold text-white mb-2">Roof Specifications</h2>
                                    <p className="text-sm text-slate-400 mb-6">Select the wear condition, service, and desired material.</p>

                                    <div className="space-y-6">
                                        <div className="flex flex-col gap-2">
                                            <label className="text-xs font-semibold text-slate-400">Current Roof Condition</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {['Good', 'Fair', 'Poor'].map((cond) => (
                                                    <button key={cond} onClick={() => setFormData(prev => ({ ...prev, condition: cond }))} className={`py-2 rounded-lg border text-xs font-semibold transition-all ${formData.condition === cond ? 'bg-indigo-500/10 border-indigo-500 text-white' : 'bg-slate-850 border-white/5 text-slate-400'}`}>
                                                        {cond}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <label className="text-xs font-semibold text-slate-400">Desired Service</label>
                                            <div className="grid grid-cols-2 gap-4">
                                                {['Repair', 'Replacement'].map((serv) => (
                                                    <button key={serv} onClick={() => setFormData(prev => ({ ...prev, service: serv }))} className={`py-3 rounded-lg border text-sm font-semibold transition-all ${formData.service === serv ? 'bg-indigo-500/10 border-indigo-500 text-white' : 'bg-slate-850 border-white/5 text-slate-400'}`}>
                                                        {serv === 'Repair' ? '🛠️ Repair' : '🔄 Replacement'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <label className="text-xs font-semibold text-slate-400" htmlFor="material">Preferred Roof Material</label>
                                            <select id="material" value={formData.material} onChange={handleInputChange} className="w-full bg-slate-850 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors">
                                                <option value="Asphalt shingles">Asphalt Shingles</option>
                                                <option value="Metal">Standing-Seam Metal</option>
                                                <option value="Tile">Spanish Slate / Clay Tile</option>
                                                <option value="Other">Other / Help me choose</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center mt-8 pt-6 border-t border-white/5">
                                        <button onClick={handlePrev} className="text-slate-400 hover:text-white text-sm font-semibold flex items-center gap-1 transition-colors">
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                                            Back
                                        </button>
                                        <button onClick={handleNext} className="bg-indigo-500 hover:bg-indigo-650 text-white font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-all shadow-[0_4px_14px_rgba(99,102,241,0.3)]">
                                            Next Step
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* STEP 4: Photo Uploads */}
                            {step === 4 && (
                                <div>
                                    <h2 className="text-xl font-bold text-white mb-2">Exterior & Roof Photos</h2>
                                    <p className="text-sm text-slate-400 mb-6">Upload photos of your roof or home exterior for inspection (max 3).</p>

                                    <div className="space-y-6">
                                        <div className="border-2 border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center justify-center bg-slate-850 hover:bg-slate-800 hover:border-indigo-500/40 transition-all cursor-pointer relative">
                                            <input type="file" multiple accept="image/*" disabled={uploading || formData.photos.length >= 3} onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed" />
                                            <svg className="w-10 h-10 text-slate-500 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                                            </svg>
                                            <span className="text-sm font-semibold text-slate-300">
                                                {uploading ? 'Uploading files...' : 'Click to upload files'}
                                            </span>
                                            <span className="text-xs text-slate-500 mt-1">Accepts PNG, JPG, or HEIC (Up to 5MB each)</span>
                                        </div>

                                        {formData.photos.length > 0 && (
                                            <div className="grid grid-cols-3 gap-3">
                                                {formData.photos.map((url, idx) => (
                                                    <div key={url} className="relative aspect-square border border-white/5 rounded-lg overflow-hidden group">
                                                        <img src={url} alt={`Upload preview ${idx}`} className="w-full h-full object-cover" />
                                                        <button onClick={() => removePhoto(idx)} className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold hover:bg-red-600 transition-colors">
                                                            ×
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-between items-center mt-8 pt-6 border-t border-white/5">
                                        <button onClick={handlePrev} className="text-slate-400 hover:text-white text-sm font-semibold flex items-center gap-1 transition-colors" disabled={submitting}>
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                                            Back
                                        </button>
                                        <button onClick={handleSubmit} disabled={submitting || uploading} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-6 py-3 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_14px_rgba(16,185,129,0.3)]">
                                            {submitting ? 'Generating Estimate...' : 'Generate My Estimate'}
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Calculations Disclaimer inside the card footer */}
                            <p className="mt-6 text-[10px] text-slate-500 leading-normal border-t border-white/5 pt-4 text-left">
                                * Disclaimer: The calculations shown are preliminary budget ballparks. Final pricing requires a physical inspection to verify slope pitch, safety accessibility parameters, and material adjustments.
                            </p>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-500 bg-[#070a13]">
                <p>&copy; {new Date().getFullYear()} Quotramax. All rights reserved.</p>
            </footer>
        </div>
    );
}
