import React from 'react';
import { RefreshCw, X, Sparkles } from 'lucide-react';

export default function UpdateBanner({ onUpdate, onDismiss }) {
    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] animate-in slide-in-from-top-5 duration-500">
            <div
                className="mx-auto max-w-xl mt-4 px-5 py-3.5 rounded-2xl shadow-2xl border flex items-center gap-4"
                style={{
                    background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(34,197,94,0.15))',
                    borderColor: 'rgba(6,182,212,0.3)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                }}
            >
                {/* Icon */}
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent-base/20 shrink-0">
                    <Sparkles className="w-5 h-5 text-accent-base" />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold t-primary">Pembaruan Tersedia! 🎉</p>
                    <p className="text-xs t-secondary mt-0.5">Versi terbaru sudah siap. Klik untuk memperbarui.</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={onUpdate}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg"
                        style={{
                            background: 'linear-gradient(135deg, #06b6d4, #22c55e)',
                            boxShadow: '0 4px 15px rgba(34,197,94,0.3)',
                        }}
                    >
                        <RefreshCw className="w-4 h-4" />
                        Update
                    </button>
                    <button
                        onClick={onDismiss}
                        className="p-1.5 rounded-lg t-muted hover:t-primary hover:bg-white/10 transition-all"
                        title="Nanti saja"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
