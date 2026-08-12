import { openDB, type IDBPDatabase } from 'idb';
import type { IdMapping, SyncOperation } from './types';
import { isTempId } from './ids';

export type StoreName = 'epis' | 'funcionarios' | 'entregas' | 'cargos' | 'usuarios' | 'biometrias' | 'sync_queue' | 'id_map';

const DB_NAME = 'segurid-offline';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('epis', { keyPath: 'id' });
        db.createObjectStore('funcionarios', { keyPath: 'id' });
        db.createObjectStore('entregas', { keyPath: 'id' });
        db.createObjectStore('cargos', { keyPath: 'id' });
        db.createObjectStore('usuarios', { keyPath: 'id' });
        db.createObjectStore('biometrias', { keyPath: 'id' });
        db.createObjectStore('sync_queue', { keyPath: 'id' }); // SyncOperation — usado a partir da Fase 3
        db.createObjectStore('id_map', { keyPath: 'tempId' }); // IdMapping — usado a partir da Fase 3
      },
    });
  }
  return dbPromise;
}

export async function dbGetAll<T>(store: StoreName): Promise<T[]> {
  return (await getDb()).getAll(store);
}

export async function dbPut(store: StoreName, value: unknown): Promise<void> {
  await (await getDb()).put(store, value);
}

export async function dbDelete(store: StoreName, id: IDBValidKey): Promise<void> {
  await (await getDb()).delete(store, id);
}

export async function getRealId(tempId: number): Promise<number | undefined> {
  const row = (await (await getDb()).get('id_map', tempId)) as IdMapping | undefined;
  return row?.realId;
}

export async function setIdMapping(mapping: IdMapping): Promise<void> {
  await dbPut('id_map', mapping);
}

function idFromUrl(url: string): number {
  const m = url.match(/\/(-?\d+)(?:\/[^/]*)?$/);
  return m ? Number(m[1]) : NaN;
}

// Nunca sobrescreve a store inteira: preserva registros criados offline (id<0)
// e reaplica por cima qualquer PUT/PATCH ainda pendente na fila, para um refresh
// online não "desfazer" uma edição/baixa de estoque feita offline.
export async function mergeServerData<T extends { id?: number }>(store: StoreName, serverRows: T[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction([store, 'sync_queue'], 'readwrite');
  const storeTx = tx.objectStore(store);
  const locais: T[] = await storeTx.getAll();
  const pendentesCriados = locais.filter(r => isTempId(r.id));

  const opsPendentes = ((await tx.objectStore('sync_queue').getAll()) as SyncOperation[])
    .filter(o => o.state === 'pending' && (o.method === 'PUT' || o.method === 'PATCH'));

  await storeTx.clear();
  for (const row of serverRows) {
    const patch = opsPendentes
      .filter(o => idFromUrl(o.url) === (row as { id?: number }).id)
      .reduce((acc, o) => ({ ...acc, ...(o.body as object) }), row as object);
    await storeTx.put(patch);
  }
  for (const r of pendentesCriados) await storeTx.put(r);
  await tx.done;
}