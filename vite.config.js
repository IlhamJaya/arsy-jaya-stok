import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Plugin: otomatis generate version.json saat build
function versionPlugin() {
  return {
    name: 'version-json',
    buildStart() {
      const version = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
      const versionData = JSON.stringify({ version, buildTime: new Date().toISOString() }, null, 2);
      fs.writeFileSync(path.resolve(__dirname, 'public/version.json'), versionData);
      console.log(`✅ version.json generated: ${version}`);
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    versionPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['Logo.svg'],
      manifest: {
        name: 'ARSY JAYA - Stock & Tracking',
        short_name: 'ARSY JAYA',
        description: 'Sistem manajemen stok dan tracking produksi Arsy Jaya',
        theme_color: '#020617',
        background_color: '#020617',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'Logo.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'Logo.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Cache app shell & static assets (exclude version.json)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['**/version.json'],
        navigateFallbackDenylist: [/\/version\.json/],
        runtimeCaching: [
          {
            // Network-first for Supabase API calls (always get fresh data)
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 1 day
              },
              networkTimeoutSeconds: 10,
            },
          },
          {
            // Cache Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
      },
    }),
  ],
})
