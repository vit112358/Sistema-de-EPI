import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Proxy do /api reutilizado em dev (server) e na pré-visualização da build (preview).
// O preview é onde os testes da PWA rodam, então também precisa enxergar o backend.
const apiProxy = {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt': não recarrega o app sozinho. Na Fase 4 isto vira um botão
      // "Atualizar" que só aplica a nova versão quando a fila de sync estiver vazia.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: false, // usamos o public/manifest.json manual
      workbox: {
        // SPA sem router: qualquer navegação cai no index.html (servido do cache offline)
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // O bundle inclui face-api.js (grande); subimos o limite para ele entrar no precache.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            // Modelos do face-api.js (grandes) — cacheados em runtime para biometria offline.
            urlPattern: /\/models\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'face-models',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // A API NUNCA é servida do cache: a verdade offline é o IndexedDB (fases 2+).
            urlPattern: /\/api\/.*/,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    allowedHosts: ['localhost', '127.0.0.1', 'gushiest-dorris-obsolescently.ngrok-free.dev'],
    proxy: apiProxy,
  },
  preview: {
    proxy: apiProxy,
  },
})