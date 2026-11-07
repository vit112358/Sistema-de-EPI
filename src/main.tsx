import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { registerSyncListeners } from './offline/syncService'
import { OFFLINE_ENABLED } from './offline/flag'

if (OFFLINE_ENABLED) {
  // Registra o Service Worker (gerado pelo vite-plugin-pwa).
  // 'prompt' não recarrega sozinho — na Fase 4 isto vira um botão "Atualizar".
  registerSW({
    onNeedRefresh() { /* TODO Fase 4: prompt de atualização (aplicar só com a fila de sync vazia) */ },
    onOfflineReady() { /* app pronto para uso offline */ },
  })
} else {
  // flag desligada: remove SW/caches que um build anterior (ex.: demo) tenha instalado no navegador
  navigator.serviceWorker?.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {})
  caches?.keys().then(ks => ks.forEach(k => caches.delete(k))).catch(() => {})
}

// sempre ativo: as escritas ainda passam pela fila, então o retry não pode depender da flag
registerSyncListeners()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
