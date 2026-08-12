import { apiFetch } from '../api';
import type { Epi, Funcionario, Entrega, Cargo, Usuario } from '../types';
import { dbGetAll, mergeServerData, type StoreName } from './db';
import { isReachable } from './reachability';

// Usa apiFetch (não fetch cru): num 401 aqui é sessão inválida de verdade e o
// logout automático (App.tsx -> onUnauthorized) deve disparar, diferente do
// drain() da Fase 3, que precisa sobreviver a um 401 transitório sem deslogar.
async function fetchWithCache<T extends { id?: number }>(url: string, store: StoreName): Promise<T[]> {
  if (await isReachable()) {
    try {
      const res = await apiFetch(url);
      if (res.ok) {
        const data: T[] = await res.json();
        if (Array.isArray(data)) {
          await mergeServerData(store, data);
          return dbGetAll<T>(store);
        }
      }
    } catch {
      // cai no fallback local
    }
  }
  return dbGetAll<T>(store);
}

export const getEntregas     = () => fetchWithCache<Entrega>('/api/entregas', 'entregas');
export const getFuncionarios = () => fetchWithCache<Funcionario>('/api/funcionarios', 'funcionarios');
export const getCargos       = () => fetchWithCache<Cargo>('/api/cargos', 'cargos');
export const getEpis         = () => fetchWithCache<Epi>('/api/epis', 'epis');
export const getUsuarios     = () => fetchWithCache<Usuario>('/api/users', 'usuarios');