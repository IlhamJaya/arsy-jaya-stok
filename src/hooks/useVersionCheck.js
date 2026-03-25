import { useState, useEffect, useCallback } from 'react';

const POLL_INTERVAL = 5 * 60 * 1000; // 5 menit

export default function useVersionCheck() {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [currentVersion, setCurrentVersion] = useState(null);

    const checkVersion = useCallback(async () => {
        try {
            // Bypass cache sepenuhnya
            const res = await fetch('/version.json?t=' + Date.now(), {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });
            if (!res.ok) return;

            const data = await res.json();
            const serverVersion = data.version;

            if (!currentVersion) {
                // Pertama kali load, simpan versi awal
                setCurrentVersion(serverVersion);
            } else if (serverVersion !== currentVersion) {
                // Versi berubah → ada update!
                setUpdateAvailable(true);
            }
        } catch {
            // Gagal fetch version.json (misal offline) — abaikan
        }
    }, [currentVersion]);

    const applyUpdate = useCallback(() => {
        window.location.reload();
    }, []);

    useEffect(() => {
        // Cek saat pertama mount
        checkVersion();

        // Polling berkala
        const interval = setInterval(checkVersion, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [checkVersion]);

    return { updateAvailable, applyUpdate };
}
