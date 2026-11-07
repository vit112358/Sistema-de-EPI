// Feature flag do modo offline (PWA + fallback IndexedDB + sessão em cache).
// Desligada por padrão: só liga com VITE_OFFLINE_ENABLED=true no build (.env / .env.local).
// ponytail: flag de build; se precisar ligar por cliente sem rebuild, vira config servida pelo backend.
export const OFFLINE_ENABLED = import.meta.env.VITE_OFFLINE_ENABLED === 'true';
