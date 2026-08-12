import { dbDelete, dbGetAll, dbPut, getRealId, setIdMapping, type StoreName } from './db';
import { isReachable } from './reachability';
import { listQueuePending, removeFromQueue, updateOp } from './syncQueue';
import type { Entity, SyncOperation } from './types';

const MAX_ATTEMPTS = 8;
let draining = false;
let needsReauth = false;

const STORE_OF: Partial<Record<Entity, StoreName>> = {
  entrega: 'entregas',
  funcionario: 'funcionarios',
  epi: 'epis',
  cargo: 'cargos',
  biometria: 'biometrias',
};

export function precisaReautenticar(): boolean {
  return needsReauth;
}

export function reautenticado(): void {
  needsReauth = false;
  drain();
}

export async function drain(): Promise<void> {
  if (!('locks' in navigator)) {
    await drainInner();
    return;
  }
  await (navigator as any).locks.request('segurid-sync-drain', { ifAvailable: true }, async (lock: unknown) => {
    if (!lock) return; // outra aba já está drenando
    await drainInner();
  });
}

interface Ctx {
  queue: SyncOperation[];
  handled: Set<string>;
}

async function drainInner(): Promise<void> {
  if (draining || needsReauth) return;
  if (!(await isReachable())) return;
  draining = true;
  try {
    const queue = await listQueuePending();
    const ctx: Ctx = { queue, handled: new Set() };
    const blockedGroups = new Set<string>();

    for (const op of queue) {
      if (ctx.handled.has(op.id)) continue;
      const groupKey = recordKeyOf(op);
      if (blockedGroups.has(groupKey)) continue;
      if (Date.now() < op.nextAttemptAt) { blockedGroups.add(groupKey); continue; }

      if (await coalesce(op, ctx)) continue;

      const resolved = await resolveDeps(op);
      if (!resolved) { blockedGroups.add(groupKey); continue; }

      let res: Response;
      try {
        res = await fetch(resolved.url, {
          method: op.method,
          credentials: 'include',
          headers: {
            ...(resolved.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
            'Idempotency-Key': op.id,
          },
          body: resolved.body !== undefined ? JSON.stringify(resolved.body) : undefined,
        });
      } catch {
        await backoff(op, 'rede indisponível', ctx);
        blockedGroups.add(groupKey);
        continue;
      }

      if (res.status === 401) { needsReauth = true; break; }
      if (res.ok) { await onSuccess(op, res); ctx.handled.add(op.id); continue; }
      if (res.status === 409 || res.status === 400) {
        await toDead(op, await errorMessage(res), ctx);
        continue;
      }
      await backoff(op, `HTTP ${res.status}`, ctx);
      blockedGroups.add(groupKey);
    }
  } finally {
    draining = false;
  }
}

function idFromUrl(url: string): number {
  const m = url.match(/(-?\d+)(?:\/[^/]*)?$/);
  return m ? Number(m[1]) : NaN;
}

function recordKeyOf(op: SyncOperation): string {
  const rid = op.tempId ?? idFromUrl(op.url);
  return `${op.entity}:${rid}`;
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const d = await res.json();
    return d?.error ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

// POST(temp)+DELETE(temp) ainda não sincronizados: cancela ambas (nada vai ao servidor).
// POST(temp)+PUT(temp) ainda não sincronizados: funde o PUT no body do POST, descarta o PUT
// (a POST atualizada só é enviada na próxima passada).
async function coalesce(op: SyncOperation, ctx: Ctx): Promise<boolean> {
  if (op.method !== 'POST' || op.tempId == null) return false;
  const tempId = op.tempId;
  const related = ctx.queue.filter(o =>
    o.id !== op.id && !ctx.handled.has(o.id) && o.entity === op.entity && idFromUrl(o.url) === tempId);

  const del = related.find(o => o.method === 'DELETE');
  if (del) {
    await removeFromQueue(op.id);
    await removeFromQueue(del.id);
    ctx.handled.add(op.id);
    ctx.handled.add(del.id);
    await cascadeCancel(tempId, ctx);
    return true;
  }

  const put = related.find(o => o.method === 'PUT');
  if (put) {
    const merged: SyncOperation = { ...op, body: { ...(op.body as object), ...(put.body as object) } };
    await updateOp(merged);
    await removeFromQueue(put.id);
    ctx.handled.add(put.id);
    return true;
  }

  return false;
}

// Registro que nunca vai existir no servidor: qualquer outra op que dependia dele também é cancelada.
async function cascadeCancel(tempId: number, ctx: Ctx): Promise<void> {
  const dependentes = ctx.queue.filter(o => !ctx.handled.has(o.id) && o.dependsOn?.includes(tempId));
  for (const dep of dependentes) {
    await removeFromQueue(dep.id);
    ctx.handled.add(dep.id);
    if (dep.tempId != null) await cascadeCancel(dep.tempId, ctx);
  }
}

async function resolveDeps(op: SyncOperation): Promise<{ url: string; body: unknown } | null> {
  for (const dep of op.dependsOn ?? []) {
    if ((await getRealId(dep)) == null) return null; // dependência ainda não resolvida
  }
  return { url: await rewriteTempIds(op.url), body: op.body !== undefined ? await rewriteDeep(op.body) : undefined };
}

async function rewriteTempIds(url: string): Promise<string> {
  let out = url;
  for (const m of url.matchAll(/-\d+/g)) {
    const real = await getRealId(Number(m[0]));
    if (real != null) out = out.replace(m[0], String(real));
  }
  return out;
}

async function rewriteDeep(value: unknown): Promise<unknown> {
  if (typeof value === 'number' && value < 0 && Number.isInteger(value)) {
    return (await getRealId(value)) ?? value;
  }
  if (Array.isArray(value)) {
    const out = [];
    for (const v of value) out.push(await rewriteDeep(v));
    return out;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = await rewriteDeep(v);
    return out;
  }
  return value;
}

async function onSuccess(op: SyncOperation, res: Response): Promise<void> {
  if (op.method === 'POST' && op.tempId != null) {
    let realId: number | undefined;
    try {
      const data = await res.json();
      realId = data?.id;
    } catch { /* resposta sem corpo JSON */ }
    if (typeof realId === 'number') {
      await setIdMapping({ tempId: op.tempId, realId, entity: op.entity });
      const store = STORE_OF[op.entity];
      if (store) {
        const row = (await dbGetAll<{ id?: number }>(store)).find(r => r.id === op.tempId);
        if (row) {
          await dbDelete(store, op.tempId);
          await dbPut(store, { ...row, id: realId });
        }
      }
    }
  }
  await removeFromQueue(op.id);
}

async function backoff(op: SyncOperation, reason: string, ctx: Ctx): Promise<void> {
  op.attempts += 1;
  if (op.attempts >= MAX_ATTEMPTS) {
    await toDead(op, reason, ctx);
    return;
  }
  op.nextAttemptAt = Date.now() + Math.min(2 ** op.attempts * 2000, 5 * 60_000);
  op.lastError = reason;
  await updateOp(op);
}

async function toDead(op: SyncOperation, reason: string, ctx: Ctx): Promise<void> {
  op.state = 'dead';
  op.lastError = reason;
  await updateOp(op);
  ctx.handled.add(op.id);
  if (op.tempId != null) await cascadeDead(op.tempId, 'dependência falhou', ctx);
}

async function cascadeDead(tempId: number, reason: string, ctx: Ctx): Promise<void> {
  const dependentes = ctx.queue.filter(o => !ctx.handled.has(o.id) && o.dependsOn?.includes(tempId));
  for (const dep of dependentes) {
    dep.state = 'dead';
    dep.lastError = reason;
    await updateOp(dep);
    ctx.handled.add(dep.id);
    if (dep.tempId != null) await cascadeDead(dep.tempId, reason, ctx);
  }
}

export function registerSyncListeners(): void {
  window.addEventListener('online', () => { drain(); });
  setInterval(() => { drain(); }, 30_000);
}