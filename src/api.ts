let _onUnauthorized: (() => void) | null = null;

export function onUnauthorized(cb: () => void) { _onUnauthorized = cb; }

export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, { ...init, credentials: 'include' });
  if (res.status === 401) _onUnauthorized?.();
  return res;
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
}