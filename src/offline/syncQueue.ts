import { dbDelete, dbGetAll, dbPut } from './db';
import type { SyncOperation } from './types';

export async function enqueue(
  op: Omit<SyncOperation, 'id' | 'createdAt' | 'attempts' | 'nextAttemptAt' | 'state'>,
): Promise<string> {
  const item: SyncOperation = {
    ...op,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    attempts: 0,
    nextAttemptAt: 0,
    state: 'pending',
  };
  await dbPut('sync_queue', item);
  return item.id;
}

export async function listQueue(): Promise<SyncOperation[]> {
  return (await dbGetAll<SyncOperation>('sync_queue')).sort((a, b) => a.createdAt - b.createdAt);
}

export async function listQueuePending(): Promise<SyncOperation[]> {
  return (await listQueue()).filter(o => o.state === 'pending');
}

export async function listDead(): Promise<SyncOperation[]> {
  return (await listQueue()).filter(o => o.state === 'dead');
}

export async function removeFromQueue(id: string): Promise<void> {
  await dbDelete('sync_queue', id);
}

export async function updateOp(op: SyncOperation): Promise<void> {
  await dbPut('sync_queue', op);
}