// ---------------------------------------------------------------
// vite.config.ts
// Vite builds and serves the website. This file sets up:
//   - React
//   - the dev proxy: /api/... requests go to the Express server (port 3001)
//   - the PWA: an installable app that works offline (vite-plugin-pwa)
//   - splitting big libraries into their own files for faster loads
//   - Vitest (the test runner)
// ---------------------------------------------------------------

/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // new versions install themselves quietly
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Ooru: Bengaluru city guide',
        short_name: 'Ooru',
        description: 'Colleges, PGs, food, bus and metro, and a day planner for Bengaluru.',
        theme_color: '#5f3fc4',
        background_color: '#f6f8f4',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The app shell (HTML, JS, CSS, icons) is saved for offline use
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // Listings + ratings: try the network first, fall back to the saved copy offline
            urlPattern: ({ url }) => url.pathname === '/api/listings' || url.pathname === '/api/reviews/summary',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-data',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 4, maxAgeSeconds: 7 * 24 * 3600 },
            },
          },
          {
            // Map tiles you've already looked at stay available offline (kept small, per OSM's usage policy)
            urlPattern: ({ url }) => url.hostname === 'tile.openstreetmap.org',
            handler: 'CacheFirst',
            options: { cacheName: 'map-tiles', expiration: { maxEntries: 300, maxAgeSeconds: 7 * 24 * 3600 } },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fonts', expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 3600 } },
          },
        ],
      },
    }),
  ],

  server: {
    // While developing, send /api requests to the Express server
    proxy: { '/api': 'http://localhost:3001' },
  },

  build: {
    rollupOptions: {
      output: {
        // Put big libraries in their own files. They change rarely, so
        // browsers can keep them cached between updates of our own code.
        manualChunks(id) {
          if (id.includes('node_modules/leaflet')) return 'leaflet'
          if (id.includes('node_modules/animejs')) return 'anime'
          if (id.includes('node_modules/zod')) return 'zod'
          if (/node_modules\/(react|react-dom|react-router|scheduler)/.test(id)) return 'react'
        },
      },
    },
  },

  test: {
    include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'shared/**/*.test.ts'],
    environment: 'node',
  },
})
