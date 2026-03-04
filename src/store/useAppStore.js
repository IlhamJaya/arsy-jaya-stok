import { create } from 'zustand';
import { supabase } from '../supabaseClient';

const useAppStore = create((set, get) => ({
    appTitle: 'ARSY JAYA',
    appSubtitle: 'Stock & Tracking Sistem',
    appLogoSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-package"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
    isLoading: true,

    // Theme system
    theme: localStorage.getItem('app_theme') || 'dark',

    initTheme: () => {
        const saved = localStorage.getItem('app_theme') || 'dark';
        document.documentElement.classList.toggle('dark', saved === 'dark');
        document.documentElement.classList.toggle('light', saved === 'light');
        set({ theme: saved });
    },

    toggleTheme: () => {
        const current = get().theme;
        const next = current === 'dark' ? 'light' : 'dark';
        localStorage.setItem('app_theme', next);
        document.documentElement.classList.toggle('dark', next === 'dark');
        document.documentElement.classList.toggle('light', next === 'light');
        set({ theme: next });
    },

    fetchBranding: async () => {
        set({ isLoading: true });
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('app_title, app_subtitle, app_logo_svg')
                .eq('id', 1)
                .single();

            if (error) {
                console.error("Error fetching app branding:", error);
                set({ isLoading: false });
                return;
            }

            if (data) {
                set({
                    appTitle: data.app_title || 'ARSY JAYA',
                    appSubtitle: data.app_subtitle || 'PRO EDITION',
                    appLogoSvg: data.app_logo_svg || '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-package"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
                    isLoading: false
                });
            } else {
                set({ isLoading: false });
            }
        } catch (err) {
            console.error("Zustand appStore error:", err);
            set({ isLoading: false });
        }
    },

    updateBranding: (newBranding) => set((state) => ({ ...state, ...newBranding }))
}));

export default useAppStore;
