import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Installable app with a service worker that keeps the app itself (HTML,
    // JS, CSS, icons, fonts) on the device, so StudySync opens offline. Data is
    // not cached here: the notes live in IndexedDB through Yjs, and the few
    // read-only views in lib/offlineCache.js. API and WebSocket traffic always
    // goes to the network.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'StudySync',
        short_name: 'StudySync',
        description: 'A shared study room: live notes, a chat that keeps the answers, and an AI tutor that reads your notes.',
        start_url: '/dashboard',
        scope: '/',
        display: 'standalone',
        background_color: '#0b0b0d',
        theme_color: '#0b0b0d',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // The main bundle is over Workbox's 2 MiB default
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // Any page (/dashboard, /spaces/:id, ...) opens from the cached shell
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/yjs/, /^\/socket\.io/, /^\/uploads\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // Off in `vite dev`: a service worker there caches modules that are
      // still being edited. Test offline loading with `npm run build && npm run preview`.
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: true, // Listen on all interfaces (0.0.0.0) for LAN access
  },
})
