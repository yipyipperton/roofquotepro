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

        // Suppress Google Maps native authentication failure alert popups
        window.gm_authFailure = () => {
            console.warn("Google Maps API auth check failed. Gracefully falling back to manual typing.");
        };

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

    const handleSelectOption = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        // Limit uploads to 3 images max
        if (formData.photos.length + files.length > 3) {
            setError('You can upload a maximum of 3 photos.');
            return;
        }

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
            
            {/* Nav */}
            <header className="border-b border-white/5 bg-[#070a13]/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setStep(1)}>
                        <svg className="w-7 h-7 text-indigo-500 filter drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                        <span className="font-heading font-extrabold text-2xl tracking-tight text-white">QUOTRA<span className="text-indigo-500">MAX</span></span>
                    </div>
                    <button onClick={() => router.push('/login')} className="text-xs font-semibold text-slate-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-lg">
                        Contractor Dashboard
                    </button>
                </div>
            </header>

            {/* Split Screen Container */}
            <main className="flex-grow max-w-7xl w-full mx-auto px-6 py-12 flex flex-col justify-center">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                    
                    {/* Left Panel: Pitch Copy */}
                    <div className="lg:col-span-6 flex flex-col justify-center py-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 w-fit mb-6 uppercase tracking-widest">
                            ⚡ Ballpark Estimate in 60 Seconds
                        </span>
                        
                        <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] text-white mb-6">
                            Calculate Your <br />
                            New Roof Cost <br />
                            <span className="bg-gradient-to-r from-indigo-400 via-indigo-500 to-emerald-400 bg-clip-text text-transparent filter drop-shadow-[0_0_12px_rgba(99,102,241,0.2)]">
                                Instantly Online.
                            </span>
                        </h1>
                        
                        <p className="text-base sm:text-lg text-slate-400 leading-relaxed mb-8 max-w-lg">
                            Answer 4 quick questions about your property specifications to generate a professional regional preliminary materials and labor estimate report.
                        </p>

                        {/* Checklist Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-lg">
                            <div className="flex gap-3 items-start">
                                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-bold">✓</span>
                                <div>
                                    <strong className="block text-slate-200 text-sm font-bold">No High-Pressure Calls</strong>
                                    <span className="text-[11px] text-slate-400">Review preliminary numbers privately before scheduling site visits.</span>
                                </div>
                            </div>
                            <div className="flex gap-3 items-start">
                                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-bold">✓</span>
                                <div>
                                    <strong className="block text-slate-200 text-sm font-bold">Detailed Cost PDF</strong>
                                    <span className="text-[11px] text-slate-400">Receive a downloadable cost summary report listing materials, labor, and safety fees.</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Overhauled Premium Wizard Card */}
                    <div className="lg:col-span-6 w-full">
                        <div className="relative border border-white/10 rounded-2xl bg-[#0d1222]/80 backdrop-blur-2xl p-8 shadow-2xl overflow-hidden before:absolute before:top-0 before:left-0 before:w-full before:height-[4px] before:bg-gradient-to-r before:from-indigo-500 before:via-purple-500 before:to-emerald-400">
                            
                            {/* Animated Step Header & Progress bar */}
                            <div className="mb-8">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                                        Step {step} of 4: <span className="text-indigo-400">
                                            {step === 1 ? 'Customer & Location' :
                                             step === 2 ? 'Property Parameters' :
                                             step === 3 ? 'Roof Specifications' :
                                             'Upload Visual Assets'}
                                        </span>
                                    </span>
                                    <span className="text-xs font-bold text-slate-500">{Math.round((step / 4) * 100)}% Complete</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500 ease-out" style={{ width: `${(step / 4) * 100}%` }}></div>
                                </div>
                            </div>

                            {error && (
                                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-300 text-xs rounded-xl font-medium text-center">
                                    ⚠️ {error}
                                </div>
                            )}

                            {/* STEP 1: Customer Details */}
                            {step === 1 && (
                                <div className="space-y-5">
                                    <div>
                                        <h2 className="text-xl font-extrabold text-white">Owner & Location Details</h2>
                                        <p className="text-xs text-slate-400 mt-1">Provide your contact info so we can route your custom budget report.</p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex flex-col gap-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider" htmlFor="name">Full Name</label>
                                            <input id="name" type="text" value={formData.name} onChange={handleInputChange} placeholder="John Doe" className="w-full bg-[#12182c] border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors text-white placeholder-slate-650" />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider" htmlFor="email">Email Address</label>
                                            <input id="email" type="email" value={formData.email} onChange={handleInputChange} placeholder="john@example.com" className="w-full bg-[#12182c] border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors text-white placeholder-slate-650" />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider" htmlFor="phone">Phone Number (Optional)</label>
                                            <input id="phone" type="tel" value={formData.phone} onChange={handleInputChange} placeholder="(727) 808-4646" className="w-full bg-[#12182c] border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors text-white placeholder-slate-650" />
                                        </div>
                                        <div className="flex flex-col gap-2 relative">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider" htmlFor="address">Project Street Address</label>
                                            <input id="address" ref={addressInputRef} type="text" value={formData.address} onChange={handleInputChange} placeholder="Type address (Google search active)" className="w-full bg-[#12182c] border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors text-white placeholder-slate-650" />
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center mt-8 pt-6 border-t border-white/5">
                                        <div></div>
                                        <button onClick={handleNext} className="bg-indigo-500 hover:bg-indigo-650 text-white font-bold px-6 py-3.5 rounded-xl flex items-center gap-2 transition-all shadow-[0_4px_14px_rgba(99,102,241,0.3)] hover:shadow-[0_4px_20px_rgba(99,102,241,0.5)]">
                                            Next Step
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: Property Parameters */}
                            {step === 2 && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-xl font-extrabold text-white">Property Parameters</h2>
                                        <p className="text-xs text-slate-400 mt-1">Specify building category and story elevation parameters.</p>
                                    </div>

                                    <div className="space-y-5">
                                        {/* Property Type Grid */}
                                        <div className="flex flex-col gap-2.5">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Property Type</label>
                                            <div className="grid grid-cols-2 gap-4">
                                                <button onClick={() => handleSelectOption('propertyType', 'Residential')} className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${formData.propertyType === 'Residential' ? 'bg-indigo-500/10 border-indigo-500 text-white shadow-[0_0_12px_rgba(99,102,241,0.15)]' : 'bg-[#12182c] border-white/5 text-slate-400 hover:border-white/15'}`}>
                                                    <span className="text-2xl">🏠</span>
                                                    <span className="text-xs font-bold">Residential Home</span>
                                                </button>
                                                <button onClick={() => handleSelectOption('propertyType', 'Commercial')} className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${formData.propertyType === 'Commercial' ? 'bg-indigo-500/10 border-indigo-500 text-white shadow-[0_0_12px_rgba(99,102,241,0.15)]' : 'bg-[#12182c] border-white/5 text-slate-400 hover:border-white/15'}`}>
                                                    <span className="text-2xl">🏢</span>
                                                    <span className="text-xs font-bold">Commercial Building</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Stories Toggle Row */}
                                        <div className="flex flex-col gap-2.5">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Story Height Elevation</label>
                                            <div className="grid grid-cols-3 gap-3">
                                                {['1', '2', '3'].map((num) => (
                                                    <button key={num} onClick={() => handleSelectOption('stories', num)} className={`py-3.5 rounded-xl border text-xs font-bold transition-all ${formData.stories === num ? 'bg-indigo-500/10 border-indigo-500 text-white' : 'bg-[#12182c] border-white/5 text-slate-400 hover:border-white/15'}`}>
                                                        {num === '3' ? '3+ Stories' : `${num} Story`}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Custom Range Slider */}
                                        <div className="flex flex-col gap-2.5 pt-2">
                                            <div className="flex justify-between items-center">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider" htmlFor="roofSize">Approximate Roof Size</label>
                                                <span className="text-sm font-extrabold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-lg">{formData.roofSize.toLocaleString()} sq ft</span>
                                            </div>
                                            <input type="range" id="roofSize" min="1000" max="6000" step="100" value={formData.roofSize} onChange={handleSliderChange} className="w-full h-2 rounded-lg bg-slate-800 appearance-none cursor-pointer accent-indigo-500 mt-2" />
                                            <div className="flex justify-between text-[10px] text-slate-500 font-bold px-1 mt-1">
                                                <span>1,000 SQ FT</span>
                                                <span>3,500 SQ FT</span>
                                                <span>6,000+ SQ FT</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center mt-8 pt-6 border-t border-white/5">
                                        <button onClick={handlePrev} className="text-slate-400 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors">
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                                            Back
                                        </button>
                                        <button onClick={handleNext} className="bg-indigo-500 hover:bg-indigo-650 text-white font-bold px-6 py-3.5 rounded-xl flex items-center gap-2 transition-all shadow-[0_4px_14px_rgba(99,102,241,0.3)]">
                                            Next Step
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: Roof Specs (Custom Premium Grid overhaul) */}
                            {step === 3 && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-xl font-extrabold text-white">Roof Specifications</h2>
                                        <p className="text-xs text-slate-400 mt-1">Provide information about your target service and material styles.</p>
                                    </div>

                                    <div className="space-y-5">
                                        {/* Condition Cards */}
                                        <div className="flex flex-col gap-2.5">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Wear Condition</label>
                                            <div className="grid grid-cols-3 gap-3">
                                                {['Good', 'Fair', 'Poor'].map((cond) => (
                                                    <button key={cond} onClick={() => handleSelectOption('condition', cond)} className={`py-3.5 rounded-xl border text-xs font-bold transition-all ${formData.condition === cond ? 'bg-indigo-500/10 border-indigo-500 text-white shadow-[0_0_10px_rgba(99,102,241,0.1)]' : 'bg-[#12182c] border-white/5 text-slate-400 hover:border-white/15'}`}>
                                                        {cond}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Service Scope selector cards */}
                                        <div className="flex flex-col gap-2.5">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Desired Service Scope</label>
                                            <div className="grid grid-cols-2 gap-4">
                                                <button onClick={() => handleSelectOption('service', 'Repair')} className={`p-4 rounded-xl border text-left flex flex-col gap-1 transition-all ${formData.service === 'Repair' ? 'bg-indigo-500/10 border-indigo-500 text-white shadow-[0_0_12px_rgba(99,102,241,0.15)]' : 'bg-[#12182c] border-white/5 text-slate-400 hover:border-white/15'}`}>
                                                    <span className="text-base font-bold text-slate-200">🛠️ Localized Repair</span>
                                                    <span className="text-[10px] text-slate-400 leading-normal">Fix leaks, structural patches, or minor wear and tear areas.</span>
                                                </button>
                                                <button onClick={() => handleSelectOption('service', 'Replacement')} className={`p-4 rounded-xl border text-left flex flex-col gap-1 transition-all ${formData.service === 'Replacement' ? 'bg-indigo-500/10 border-indigo-500 text-white shadow-[0_0_12px_rgba(99,102,241,0.15)]' : 'bg-[#12182c] border-white/5 text-slate-400 hover:border-white/15'}`}>
                                                    <span className="text-base font-bold text-slate-200">🔄 Complete Replacement</span>
                                                    <span className="text-[10px] text-slate-400 leading-normal">Full shingle or metal panels tear-off and brand new install.</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Material Selection cards grid */}
                                        <div className="flex flex-col gap-2.5">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Preferred Material Styling</label>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {[
                                                    { value: 'Asphalt shingles', label: '🏠 Architectural Asphalt', desc: 'Standard protection' },
                                                    { value: 'Metal', label: '🛡️ Standing-Seam Metal', desc: 'Premium metal sheeting' },
                                                    { value: 'Tile', label: '🧱 Spanish Slate & Clay Tile', desc: 'Luxury ceramic profiles' },
                                                    { value: 'Other', label: '❓ Other Style / Undecided', desc: 'Consult with inspector' }
                                                ].map((mat) => (
                                                    <button key={mat.value} onClick={() => handleSelectOption('material', mat.value)} className={`p-3 rounded-xl border text-left flex flex-col gap-0.5 transition-all ${formData.material === mat.value ? 'bg-indigo-500/10 border-indigo-500 text-white shadow-[0_0_12px_rgba(99,102,241,0.15)]' : 'bg-[#12182c] border-white/5 text-slate-400 hover:border-white/15'}`}>
                                                        <span className="text-xs font-bold text-slate-200">{mat.label}</span>
                                                        <span className="text-[9px] text-slate-500">{mat.desc}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center mt-8 pt-6 border-t border-white/5">
                                        <button onClick={handlePrev} className="text-slate-400 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors">
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                                            Back
                                        </button>
                                        <button onClick={handleNext} className="bg-indigo-500 hover:bg-indigo-650 text-white font-bold px-6 py-3.5 rounded-xl flex items-center gap-2 transition-all shadow-[0_4px_14px_rgba(99,102,241,0.3)]">
                                            Next Step
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* STEP 4: Photo Uploads (Upgraded visually) */}
                            {step === 4 && (
                                <div className="space-y-6">
                                    <div>
                                        <h2 className="text-xl font-extrabold text-white">Visual Assets Upload</h2>
                                        <p className="text-xs text-slate-400 mt-1">Upload up to 3 photos of your roof or building exterior for pre-inspection audit.</p>
                                    </div>

                                    <div className="space-y-5">
                                        <div className="border-2 border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center justify-center bg-[#12182c] hover:bg-[#151c34] hover:border-indigo-500/30 transition-all cursor-pointer relative">
                                            <input type="file" multiple accept="image/*" disabled={uploading || formData.photos.length >= 3} onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed" />
                                            <svg className="w-10 h-10 text-slate-500 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                                            </svg>
                                            <span className="text-sm font-semibold text-slate-350">
                                                {uploading ? '📡 Uploading photos...' : 'Click to select / upload photos'}
                                            </span>
                                            <span className="text-[10px] text-slate-500 mt-1">Supports PNG, JPG, or HEIC (Max 3, 5MB each)</span>
                                        </div>

                                        {formData.photos.length > 0 && (
                                            <div className="grid grid-cols-3 gap-4">
                                                {formData.photos.map((url, idx) => (
                                                    <div key={url} className="relative aspect-square border border-white/10 rounded-xl overflow-hidden group shadow-lg">
                                                        <img src={url} alt={`Upload preview ${idx}`} className="w-full h-full object-cover" />
                                                        <button onClick={() => removePhoto(idx)} className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold hover:bg-red-650 transition-colors shadow-md">
                                                            ×
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-between items-center mt-8 pt-6 border-t border-white/5">
                                        <button onClick={handlePrev} className="text-slate-400 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors" disabled={submitting}>
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                                            Back
                                        </button>
                                        <button onClick={handleSubmit} disabled={submitting || uploading} className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-6 py-3.5 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_14px_rgba(16,185,129,0.3)]">
                                            {submitting ? 'Generating Estimate...' : 'Generate My Estimate'}
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Calculations Disclaimer */}
                            <p className="mt-6 text-[10px] text-slate-550 leading-normal border-t border-white/5 pt-4 text-left">
                                * Disclaimer: The calculations shown are preliminary budget estimates. Final pricing requires a physical inspection to verify slope pitch, access configuration, and material adjustments.
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
