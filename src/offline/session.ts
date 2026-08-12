// Cache local de sessão para restaurar login após F5 sem servidor (JWT de 8h
// cobre o turno — ver offline.md "Janela offline"). Guarda só claims de
// identidade (id/nome/username/role/trocar_senha) e o exp do token, NUNCA a
// senha nem o token em si — o JWT real continua só no cookie httpOnly, que
// este módulo nem consegue ler.
import type { Usuario } from '../types';

export interface SessionUser extends Usuario { exp: number }

interface CachedSession { user: Usuario; exp: number }

const KEY = 'segurid_session_cache';

export function cacheSession(user: Usuario, exp: number): void {
  const { senha: _s, ...semSenha } = user;
  localStorage.setItem(KEY, JSON.stringify({ user: semSenha, exp } satisfies CachedSession));
  void requestPersistentStorage();
}

// Pede ao browser pra não evictar o IndexedDB sob pressão de espaço (offline.md
// "Fonte da verdade offline"). Sem suporte (ex.: Safari antigo) navigator.storage
// é undefined — no-op.
async function requestPersistentStorage(): Promise<void> {
  if (!navigator.storage?.persist) return;
  const granted = await navigator.storage.persist();
  if (!granted) console.warn('Armazenamento persistente negado — dados offline podem ser apagados pelo navegador sob pressão de espaço.');
}

export function readCachedSession(): CachedSession | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedSession;
    if (!parsed?.user?.id || typeof parsed.exp !== 'number') { clearCachedSession(); return null; }
    if (parsed.exp * 1000 <= Date.now()) { clearCachedSession(); return null; }
    return parsed;
  } catch {
    clearCachedSession();
    return null;
  }
}

export function clearCachedSession(): void {
  localStorage.removeItem(KEY);
}
