import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['localhost', '127.0.0.1', 'gushiest-dorris-obsolescently.ngrok-free.dev'],
    proxy: {
      // Todas as requisições que começarem com '/api'
      // serão redirecionadas para o backend no localhost:3000
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // Opcional: Se o seu backend não espera o prefixo '/api',
        // você pode removê-lo reescrevendo a URL:
        // rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
