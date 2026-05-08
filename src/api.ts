let _token: string | null = sessionStorage.getItem('epi_token');
let _onUnauthorized: (() => void) | null = null;

export function setToken(t: string | null) {
  _token = t;
  t ? sessionStorage.setItem('epi_token', t) : sessionStorage.removeItem('epi_token');
}
export function getToken() { return _token; }
export function onUnauthorized(cb: () => void) { _onUnauthorized = cb; }

export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> ?? {}),
  };
  if (_token) headers['Authorization'] = `Bearer ${_token}`;
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) _onUnauthorized?.();
  return res;
}