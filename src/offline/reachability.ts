// navigator.onLine só diz que a interface de rede está ativa, não que o servidor
// está acessível (zona sem internet, portal cativo, latência absurda). Por isso
// o probe é uma request real e curta, não a flag do browser.
export async function isReachable(timeoutMs = 4000): Promise<boolean> {
  if (!navigator.onLine) return false;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('/api/health', { method: 'GET', credentials: 'include', signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}