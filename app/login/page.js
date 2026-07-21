'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const result = await res.json();
            if (result.success) {
                router.push('/admin');
            } else {
                setError(result.error || 'Invalid credentials');
                setLoading(false);
            }
        } catch (err) {
            console.error('Login request error:', err);
            setError('Connection failed. Please try again.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#070a13] text-slate-100 flex flex-col justify-center items-center font-sans px-6">
            <div className="w-full max-w-md">
                
                {/* Brand */}
                <div className="flex flex-col items-center gap-2 mb-8 cursor-pointer" onClick={() => router.push('/')}>
                    <svg className="w-10 h-10 text-indigo-500 filter drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    <span className="font-heading font-extrabold text-2xl tracking-tight mt-1 text-white">QUOTRA<span className="text-indigo-500">MAX</span></span>
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Contractor Dashboard Portal</span>
                </div>

                {/* Login Card */}
                <div className="relative border border-white/5 rounded-2xl bg-slate-900/50 backdrop-blur-xl p-8 shadow-2xl overflow-hidden before:absolute before:top-0 before:left-0 before:w-full before:height-[3px] before:bg-gradient-to-r before:from-indigo-500 before:to-emerald-400">
                    <h2 className="text-xl font-bold text-white mb-6 text-center">Secure Sign In</h2>

                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-lg text-center">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-semibold text-slate-400" htmlFor="username">Username</label>
                            <input id="username" type="text" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="w-full bg-slate-850 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors text-white" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-semibold text-slate-400" htmlFor="password">Password</label>
                            <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full bg-slate-850 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors text-white" />
                        </div>

                        <button type="submit" disabled={loading} className="w-full mt-6 bg-indigo-500 hover:bg-indigo-650 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-[0_4px_14px_rgba(99,102,241,0.3)]">
                            {loading ? 'Authenticating...' : 'Sign In'}
                        </button>
                    </form>
                </div>

                <div className="mt-8 text-center">
                    <span onClick={() => router.push('/')} className="text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer flex items-center justify-center gap-1">
                        ← Back to Intake Portal
                    </span>
                </div>

            </div>
        </div>
    );
}
