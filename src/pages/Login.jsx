import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import useAppStore from '../store/useAppStore';
import { Lock, Mail, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function Login() {
    const { appTitle, appSubtitle, appLogoSvg } = useAppStore();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) throw authError;

            // Successful login, navigate to dashboard
            if (data.session) {
                navigate('/dashboard');
            }
        } catch (err) {
            console.error('Login error:', err);
            setError(err.message === 'Invalid login credentials' ? 'Email atau Password salah.' : err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden selection:bg-brand-green/30 px-4" style={{ backgroundColor: 'var(--bg-body)' }}>
            {/* Dynamic Background Gradients */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full pointer-events-none mix-blend-screen" style={{ background: 'var(--gradient-bg-1)' }} />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full pointer-events-none mix-blend-screen" style={{ background: 'var(--gradient-bg-2)' }} />

            <div className="w-full max-w-md relative z-10">

                {/* Header */}
                <div className="flex flex-col items-center justify-center mb-8">
                    <img src="/Logo.svg" alt="ARSY JAYA Logo" className="w-[4.4rem] h-[4.4rem] object-contain mb-4 drop-shadow-[0_0_12px_rgba(6,182,212,0.6)]" />
                    <h1 className="text-3xl font-bold tracking-tight t-primary mb-2 uppercase">{appTitle}</h1>
                    <p className="t-muted text-sm font-mono uppercase tracking-widest">{appSubtitle}</p>
                </div>

                {/* Login Form Card */}
                <div className="glass-card p-8 sm:p-10 border-white/10 shadow-2xl relative overflow-hidden">
                    {/* Subtle highlight line at top */}
                    <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-brand-green/50 to-transparent"></div>

                    <h2 className="text-xl font-semibold t-primary mb-6">Portal Masuk</h2>

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-xs font-semibold t-muted uppercase tracking-wider mb-2">Alamat Email</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Mail className="w-5 h-5 text-slate-500" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full border rounded-xl pl-11 pr-4 py-3.5 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green/50 transition-all t-primary"
                                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}
                                    placeholder="karyawan@arsy.co.id"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold t-muted uppercase tracking-wider mb-2">Kata Sandi</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="w-5 h-5 text-slate-500" />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full border rounded-xl pl-11 pr-12 py-3.5 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green/50 transition-all t-primary"
                                    style={{ background: 'var(--bg-input)', borderColor: 'var(--border-glass)' }}
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center t-muted hover:t-primary transition-colors"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-brand-red/10 border border-brand-red/20 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
                                <AlertCircle className="w-4 h-4 text-brand-red shrink-0 mt-0.5" />
                                <p className="text-sm text-brand-red flex-1">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-green hover:bg-cyan-500 text-slate-950 font-bold rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-4 shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_25px_rgba(34,197,94,0.4)] ring-1 ring-white/10"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-t-2 border-r-2 border-slate-950 rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    Masuk Sistem <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center text-xs t-muted">
                        Versi 1.0.0 &copy; {new Date().getFullYear()} Arsy Jaya System
                    </div>
                </div>

            </div>
        </div>
    );
}
