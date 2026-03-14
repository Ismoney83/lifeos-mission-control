import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Disable service worker in production to avoid CSP eval issues with Workbox
      // The app still works fully without SW on GitHub Pages
      devOptions: { enabled: false },
      workbox: {
        // Use InjectManifest mode to avoid eval() in generated SW
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Disable runtime caching that requires eval
        runtimeCaching: [],
      },
      manifest: {
        name: 'Life OS Mission Control',
        short_name: 'Mission Control',
        theme_color: '#0a0a0f',
        background_color: '#0a0a0f',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  base: '/lifeos-mission-control/',
})
