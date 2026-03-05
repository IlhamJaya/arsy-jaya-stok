import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

export default function PWAInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        // Check if already dismissed in this session
        if (sessionStorage.getItem('pwa-prompt-dismissed')) return;

        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setIsVisible(false);
        }
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setIsVisible(false);
        setIsDismissed(true);
        sessionStorage.setItem('pwa-prompt-dismissed', '1');
    };

    if (!isVisible || isDismissed) return null;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] w-[calc(100%-2rem)] max-w-sm animate-in slide-in-from-bottom-4 duration-300">
            <div
                className="glass-card p-4 flex items-center gap-4 shadow-2xl border"
                style={{ borderColor: 'var(--border-glass)' }}
            >
                {/* Icon */}
                <div className="p-2.5 bg-accent-base/10 text-accent-base rounded-xl border border-accent-base/20 shrink-0">
                    <Smartphone className="w-5 h-5" />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold t-primary leading-tight">Pasang di HP Anda</p>
                    <p className="text-xs t-secondary mt-0.5 leading-tight">Akses lebih cepat seperti aplikasi native</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={handleInstall}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-base t-on-accent text-xs font-bold rounded-lg hover:brightness-110 transition-all"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Pasang
                    </button>
                    <button
                        onClick={handleDismiss}
                        className="p-1.5 t-muted hover:t-primary rounded-lg transition-colors"
                        aria-label="Tutup"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
