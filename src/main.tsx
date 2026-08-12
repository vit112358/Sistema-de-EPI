import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { registerSyncListeners } from './offline/syncService'

// Registra o Service Worker (gerado pelo vite-plugin-pwa).
// 'prompt' não recarrega sozinho — na Fase 4 isto vira um botão "Atualizar".
registerSW({
  onNeedRefresh() { /* TODO Fase 4: prompt de atualização (aplicar só com a fila de sync vazia) */ },
  onOfflineReady() { /* app pronto para uso offline */ },
})

registerSyncListeners()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
