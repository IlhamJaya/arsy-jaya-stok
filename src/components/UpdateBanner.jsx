import React from 'react';
import { RefreshCw } from 'lucide-react';

export default function UpdateBanner({ onUpdate, onDismiss }) {
    return (
        <div className="fixed top-0 left-0 right-0 z-[200] bg-accent-base/95 backdrop-blur-md text-white px-4 py-3 flex items-center justify-center gap-4 shadow-lg animate-in slide-in-from-top duration-300">
            <RefreshCw className="w-5 h-5 animate-spin-slow" />
            <p className="text-sm font-medium">Versi terbaru tersedia!</p>
            <button
                onClick={onUpdate}
                className="px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-bold transition-colors border border-white/20"
            >
                Update Sekarang
            </button>
            <button
                onClick={onDismiss}
                className="px-3 py-1.5 hover:bg-white/10 rounded-lg text-sm transition-colors opacity-70 hover:opacity-100"
            >
                Nanti
            </button>
        </div>
    );
}
