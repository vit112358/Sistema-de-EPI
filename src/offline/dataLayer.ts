import { apiFetch } from '../api';
import type { Epi, Funcionario, Entrega, EntregaItem, Biometria, Cargo, Usuario } from '../types';
import { dbDelete, dbGetAll, dbPut, mergeServerData, type StoreName } from './db';
import { isReachable } from './reachability';
import { isTempId, nextTempId } from './ids';
import { enqueue } from './syncQueue';
import { drain } from './syncService';

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

// ── Escritas offline ──────────────────────────────────────────────────────
// Padrão geral: grava otimista no IndexedDB, enfileira a operação (com
// dependsOn quando o corpo referencia um id temporário de outra entidade) e
// dispara drain() (vira no-op se estiver offline — isReachable() barra cedo).

async function ajustarEstoqueOtimista(itens: EntregaItem[], sinal: 1 | -1): Promise<void> {
  const todos = await dbGetAll<Epi>('epis');
  for (const item of itens) {
    const epi = todos.find(e => e.id === item.epi_id);
    if (epi) await dbPut('epis', { ...epi, estoque: Math.max(0, epi.estoque + sinal * item.qtd) });
  }
}

// `entrega.id` já vem atribuído (nextTempId(), NovaEntregaPage) — usado como tempId.
export async function criarEntregaOffline(entrega: Entrega): Promise<void> {
  await dbPut('entregas', entrega);
  await ajustarEstoqueOtimista(entrega.itens, -1);
  const body = {
    funcionario_id: entrega.funcionario_id, funcionario: entrega.funcionario,
    status: entrega.status, tipo_assinatura: entrega.tipo_assinatura,
    confianca: entrega.confianca, data: entrega.data, itens: entrega.itens,
    assinatura_img: entrega.assinatura_img ?? null,
  };
  await enqueue({
    entity: 'entrega', method: 'POST', url: '/api/entregas', body, tempId: entrega.id,
    dependsOn: isTempId(entrega.funcionario_id) ? [entrega.funcionario_id] : undefined,
  });
  drain();
}

// atualizarStatusEntrega (backend) faz update parcial — só manda os campos que ela usa,
// diferente de funcionário/EPI (full-replace).
export async function atualizarStatusEntregaOffline(entrega: Entrega): Promise<void> {
  await dbPut('entregas', entrega);
  if (entrega.status === 'cancelado') await ajustarEstoqueOtimista(entrega.itens, 1);
  const body = {
    status: entrega.status, tipo_assinatura: entrega.tipo_assinatura,
    confianca: entrega.confianca, assinatura_img: entrega.assinatura_img ?? null,
    funcionario: entrega.funcionario,
  };
  await enqueue({ entity: 'entrega', method: 'PUT', url: `/api/entregas/${entrega.id}`, body });
  drain();
}

// Diferente das demais criações: tenta a via online primeiro (preserva a validação
// síncrona de matrícula/e-mail duplicados) e só cai para a fila se estiver offline.
export async function criarFuncionarioOffline(
  funcData: Omit<Funcionario, 'id' | 'biometrias'>,
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const body = { nome: funcData.nome, matricula: funcData.matricula, setor: funcData.setor, cargo: funcData.cargo, email: funcData.email, telefone: funcData.telefone };
  if (await isReachable()) {
    try {
      const res = await apiFetch('/api/funcionarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error || 'Erro ao criar funcionário' };
      await dbPut('funcionarios', { ...funcData, id: data.id, biometrias: [] });
      return { ok: true, id: data.id };
    } catch {
      // cai para a fila offline
    }
  }
  const tempId = nextTempId();
  await dbPut('funcionarios', { ...funcData, id: tempId, biometrias: [] });
  await enqueue({ entity: 'funcionario', method: 'POST', url: '/api/funcionarios', body, tempId });
  drain();
  return { ok: true, id: tempId };
}

export async function atualizarFuncionarioOffline(funcionario: Funcionario): Promise<void> {
  await dbPut('funcionarios', funcionario);
  await enqueue({ entity: 'funcionario', method: 'PUT', url: `/api/funcionarios/${funcionario.id}`, body: funcionario });
  drain();
}

export async function deletarFuncionarioOffline(id: number): Promise<void> {
  await dbDelete('funcionarios', id);
  await enqueue({ entity: 'funcionario', method: 'DELETE', url: `/api/funcionarios/${id}` });
  drain();
}

// `epi.id` já vem atribuído (nextTempId(), EpisPage) — usado como tempId.
export async function criarEpiOffline(epi: Epi): Promise<void> {
  await dbPut('epis', epi);
  const body = { nome: epi.nome, ca: epi.ca, cas_json: epi.cas_json ?? null, categoria: epi.categoria, estoque: epi.estoque, minimo: epi.minimo, validade: epi.validade, img: epi.img, periodicidade: epi.periodicidade, descricao: epi.descricao, norma: epi.norma, fabricante: epi.fabricante };
  await enqueue({ entity: 'epi', method: 'POST', url: '/api/epis', body, tempId: epi.id });
  drain();
}

export async function atualizarEpiOffline(epi: Epi): Promise<void> {
  await dbPut('epis', epi);
  await enqueue({ entity: 'epi', method: 'PUT', url: `/api/epis/${epi.id}`, body: epi });
  drain();
}

export async function deletarEpiOffline(id: number): Promise<void> {
  await dbDelete('epis', id);
  await enqueue({ entity: 'epi', method: 'DELETE', url: `/api/epis/${id}` });
  drain();
}

// Sem id pré-atribuído (BiometriaPage não usa nextTempId ainda) — gerado aqui.
export async function salvarBiometriaOffline(bio: Omit<Biometria, 'id'>): Promise<number> {
  const tempId = nextTempId();
  await dbPut('biometrias', { ...bio, id: tempId });
  await enqueue({
    entity: 'biometria', method: 'POST', url: '/api/biometrias', body: bio, tempId,
    dependsOn: isTempId(bio.funcionario_id) ? [bio.funcionario_id] : undefined,
  });
  drain();
  return tempId;
}

export async function deletarBiometriaOffline(bioId: number): Promise<void> {
  await dbDelete('biometrias', bioId);
  await enqueue({ entity: 'biometria', method: 'DELETE', url: `/api/biometrias/${bioId}` });
  drain();
}