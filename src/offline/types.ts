// Usado a partir da Fase 3 (fila de sincronização). Definido já na Fase 2 porque
// o schema do IndexedDB (sync_queue, id_map) precisa existir desde a v1 do banco.
export type Entity =
  | 'entrega' | 'funcionario' | 'epi' | 'cargo'
  | 'biometria' | 'biometria_descriptor';

export interface SyncOperation {
  id: string;                 // UUID — também é a Idempotency-Key
  entity: Entity;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;                // pode conter id temporário (ex.: /api/funcionarios/-1718...)
  body?: unknown;
  tempId?: number;
  dependsOn?: number[];
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
  state: 'pending' | 'inflight' | 'dead';
}

export interface IdMapping {
  tempId: number;
  realId: number;
  entity: Entity;
}