# Plano de Implementação — Suporte Offline + Mobile

**Objetivo:** Fazer o sistema funcionar em **zonas sem internet**, com **perda de dados próxima de zero**, e publicá-lo como app nativo iOS/Android via Capacitor.

Esta é uma revisão do plano original. A estrutura em 6 fases foi mantida, mas toda a camada de sincronização foi reescrita em torno de um princípio único: **nenhuma operação feita offline pode ser silenciosamente descartada**. As seções "Princípios de não‑perda de dados", "Modelo de sincronização" e "Resolução de conflitos" são novas e são o coração desta revisão — leia‑as antes das fases.

---

## Premissas (decididas)

| Tema | Decisão | Implicação |
|------|---------|------------|
| **Janela offline** | 1 turno (≤ 8h) | O operador loga **online** no início do turno. O JWT já expira em 8h (`server.ts:100`) e cobre o turno inteiro. Não há login offline nem cache de credenciais. |
| **Sessão expirada durante a sync** | Pausar a fila e pedir re-login | Se mesmo assim aparecer um 401 (turno passou de 8h, sessão revogada em outro dispositivo), o `drain` **para, sinaliza na UI e aguarda novo login** — nunca descarta a fila. |
| **Conflitos** | Last-Write-Wins + log de auditoria | A última escrita a chegar ao servidor vence, mas a versão sobrescrita é **gravada no audit log** e fica recuperável. Detalhes na seção "Resolução de conflitos". |
| **Fonte da verdade offline** | IndexedDB (persistência real, não cache) | Chamar `navigator.storage.persist()` após o login para o browser/WebView não evictar os dados pendentes. |
| **Backend** | Permanece no servidor (`segurid.com.br`) | Capacitor só empacota o frontend numa WebView; as requests continuam indo para a nuvem. |

---

## Princípios de não‑perda de dados

Estes são os **invariantes** que o desenho garante. Cada item das fases existe para sustentar um destes princípios.

1. **Toda mutação offline vira uma operação persistida em disco** (`sync_queue` no IndexedDB) **antes** de afetar a UI. Se o app fechar, recarregar ou crashar, a operação continua lá.
2. **Uma operação só sai da fila em três situações:** (a) o servidor confirmou `2xx`; (b) ela foi *coalescida* com outra (ex.: criar+excluir o mesmo registro temporário — nada precisa ir ao servidor); (c) o usuário, ciente, descartou manualmente uma operação morta.
3. **Falha nunca apaga a operação.** Erros de rede/5xx → re-tentativa com backoff. Erros que não vão melhorar com retry (400/409) → a operação vai para o estado `dead` (carta morta), **visível e exportável**, aguardando ação humana. Nunca um `delete` silencioso.
4. **Idempotência:** toda escrita carrega uma chave única (`Idempotency-Key`). Se a resposta se perder após o servidor já ter gravado, o reenvio **não duplica** (sem entrega/baixa de estoque em dobro).
5. **Nenhum refresh online apaga dado pendente.** Recarregar a lista do servidor **mescla** com os registros locais ainda não sincronizados (ids temporários) em vez de sobrescrever a store inteira.
6. **Reconciliação de IDs:** registros criados offline ganham um `id` temporário negativo; quando sincronizam, o `id` real do servidor é propagado para **todas** as operações e registros que dependiam dele.
7. **Conflito não é perda:** quando o LWW sobrescreve uma versão, a versão antiga é registrada no audit log — ou seja, há histórico recuperável, não descarte.
8. **Persistência garantida:** `navigator.storage.persist()` + alerta se o navegador negar, para o operador saber que está em risco antes de acumular um turno de dados.

---

## Modelo de sincronização (núcleo da revisão)

### IDs temporários

Registros criados offline recebem um `id` **negativo** (`nextTempId()`), nunca colidindo com ids reais do servidor (sempre positivos — `parseId` em `server.ts:221` rejeita `<= 0`). Regra simples em todo o código: **`id < 0` ⇒ ainda não existe no servidor**.

```ts
// src/offline/ids.ts
let _seq = 0;
export function nextTempId(): number {
  // negativo, monotônico e dentro de Number.MAX_SAFE_INTEGER por muitos anos
  return -(Date.now() * 1000 + (_seq++ % 1000));
}
export const isTempId = (id: number | undefined): boolean => typeof id === 'number' && id < 0;
```

### Registro de operação

```ts
export type Entity =
  | 'entrega' | 'funcionario' | 'epi' | 'cargo'
  | 'biometria' | 'biometria_descriptor';

export interface SyncOperation {
  id: string;                 // UUID — também é a Idempotency-Key
  entity: Entity;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;                // pode conter id temporário (ex.: /api/funcionarios/-1718...)
  body?: unknown;             // pode conter ids temporários (funcionario_id, itens[].epi_id, ...)
  tempId?: number;            // para POST: o id temporário que esta op materializa
  dependsOn?: number[];       // ids temporários referenciados em url/body
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;      // backoff
  lastError?: string;
  state: 'pending' | 'inflight' | 'dead';   // 'dead' = precisa de ação humana, NUNCA apagado automaticamente
}
```

### Mapa de IDs (`id_map`)

Store no IndexedDB que sobrevive a reloads:

```ts
interface IdMapping { tempId: number; realId: number; entity: Entity; }
```

Quando um `POST` retorna o id real, grava-se `tempId → realId`. Antes de enviar qualquer operação, **todos** os ids temporários presentes na `url` e no `body` (inclusive aninhados, como `itens[].epi_id`) são reescritos para o id real correspondente.

### Máquina de estados do `drain()`

```
                ┌─────────────── online? (probe real, não navigator.onLine) ──────────────┐
                │ não → encerra (tenta de novo no próximo 'online'/probe)                  │
                ▼                                                                          
  para cada op (ordenada por createdAt), agrupando por (entity, recordId):
    0. skip-de-grupo (corrige B5) ── se QUALQUER op anterior do MESMO (entity, recordId) ainda está
                  pending/em-backoff nesta passada, pula esta também (mantém ordem; evita PUT antigo
                  vencer sobre um PUT/DELETE mais novo que já teria sido aceito)
    1. coalescer  ── POST(temp) seguido de DELETE(temp) ainda não sincronizados → remove AMBAS (nada vai ao servidor)
                  └─ POST(temp) seguido de PUT(temp)    ainda não sincronizados → funde o PUT no body do POST, descarta o PUT
                  └─ CASCATA (corrige B4): ao remover/coalescer uma op com tempId, qualquer OUTRA op na fila cujo
                     dependsOn inclua esse tempId é removida/coalescida junto (referenciava um registro que
                     nunca vai existir no servidor)
    2. resolver deps ── reescreve ids temporários via id_map. Se alguma dep ainda não resolveu → pula a op (mantém na fila)
    3. enviar  ── fetch com header Idempotency-Key: op.id, e ...(await authHeaders())   (NÃO usa apiFetch global — ver nota 401)
    4. classificar a resposta:
         2xx ........ POST → grava id_map[tempId]=realId, atualiza o registro local (temp→real); remove a op da fila
                      (replay idempotente cai aqui também: o backend devolve o 2xx cacheado original — ver nota abaixo)
         401 ........ PARA o drain inteiro; seta flag "precisa re-login"; NÃO incrementa attempts; NÃO descarta
         409 ........ SEMPRE conflito de negócio real (ex.: e-mail/matrícula única) — nunca "replay", o replay
                      idempotente já foi respondido como 2xx pelo middleware do servidor (ver Idempotência) →
                      state='dead'
         400 ........ validação → NUNCA vai passar em retry → state='dead' (com a mensagem do servidor)
         5xx/rede ... attempts++, backoff exponencial; após N tentativas → state='dead' (NÃO apaga)
    5. CASCATA em 'dead' (corrige B4) ── ao marcar uma op como 'dead' (passos 401→não, 409/400/N-tentativas→sim),
                  qualquer outra op na fila cujo dependsOn inclua o tempId desta também vira 'dead' (motivo:
                  "dependência falhou") — nunca fica presa em loop de "pula, pula, pula" invisível no painel
```

```ts
// src/offline/syncService.ts (esboço endurecido)
const MAX_ATTEMPTS = 8;
let draining = false;
let needsReauth = false;

export function precisaReautenticar() { return needsReauth; }

export async function drain() {
  // corrige B11: `draining` é variável de módulo, vale só por aba/contexto. PWA instalada + aba do
  // navegador abertas ao mesmo tempo = dois drains simultâneos mandando as MESMAS ops (a Idempotency-Key
  // só protege se o primeiro request já tiver respondido; não há estado "em andamento" no meio do caminho).
  // Web Locks API serializa entre abas/contextos do mesmo browser sem precisar de coordenação manual.
  if (!('locks' in navigator)) { await drainInner(); return; }  // fallback (browsers sem Web Locks): melhor que nada
  await (navigator as any).locks.request('segurid-sync-drain', { ifAvailable: true }, async (lock: any) => {
    if (!lock) return;   // outra aba já está drenando; esta chamada desiste, a próxima trigger tenta de novo
    await drainInner();
  });
}

async function drainInner() {
  if (draining || needsReauth) return;
  if (!(await isReachable())) return;          // probe real (ver abaixo)
  draining = true;
  try {
    const queue = await listQueuePending();    // só state === 'pending', ordenada por createdAt
    for (const op of queue) {
      if (Date.now() < op.nextAttemptAt) continue;
      if (await coalesce(op)) continue;         // pode remover esta e/ou outras ops
      const resolvida = await resolveDeps(op);  // reescreve ids temporários
      if (!resolvida) continue;                 // dep ainda pendente; tenta na próxima passada

      let res: Response;
      try {
        res = await fetch(resolvida.url, {
          method: resolvida.method,
          credentials: 'include',
          headers: {
            ...(resolvida.body ? { 'Content-Type': 'application/json' } : {}),
            'Idempotency-Key': op.id,
          },
          body: resolvida.body ? JSON.stringify(resolvida.body) : undefined,
        });
      } catch {
        await backoff(op, 'rede indisponível');  // 5xx/rede: mantém, agenda retry
        continue;
      }

      if (res.status === 401) { needsReauth = true; break; }          // pausa total, não descarta
      if (res.ok) { await onSuccess(op, resolvida, res); continue; }  // remove + propaga id real
      if (res.status === 409) { await onConflict(op, res); continue; } // replay → sucesso; negócio → dead
      if (res.status === 400) { await toDead(op, res); continue; }     // não retentar
      await backoff(op, `HTTP ${res.status}`);                         // 5xx
    }
  } finally {
    draining = false;
  }
}

export function reautenticado() { needsReauth = false; drain(); }
```

### Probe de conectividade real

`navigator.onLine` só diz que a interface de rede está ativa — **não** que o servidor está acessível. Em zona sem internet é comum ter "barras" de sinal sem rota até a nuvem, portal cativo ou latência absurda. Por isso o drain usa um *probe* real, com timeout curto:

```ts
// src/offline/reachability.ts
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
```

> **Backend:** adicionar uma rota pública e barata `GET /api/health` que responde `200 { ok: true }` **antes** do middleware `autenticar` (`server.ts:198`), para o probe não falhar com 401.

### Nota sobre o 401 e o `apiFetch` global

`apiFetch` (`src/api.ts:5`) dispara `_onUnauthorized()` (logout) em **qualquer** 401. Se o `drain` usasse `apiFetch`, um 401 durante a sync deslogaria o usuário e poderia limpar estado em memória. Por isso o `syncService` usa `fetch` cru com `credentials: 'include'` e trata o 401 localmente (pausa + flag `needsReauth`), preservando a fila e o estado.

### Autenticação em ambiente nativo (Capacitor) — correção necessária

O cookie de sessão (`server.ts:102-108`) é `httpOnly, sameSite: 'strict', secure`. No Capacitor o WebView roda em `capacitor://localhost` (iOS) / `http://localhost` (Android) fazendo requests para o domínio real do backend — isso é **cross-site**, e com `SameSite=strict` o cookie **nunca é enviado**, independente de CORS. Nem `SameSite=None` seria garantia no WKWebView do iOS (ITP bloqueia cookie third-party). Sem correção, o login "funciona" (a resposta chega OK) mas nenhuma request autenticada seguinte carrega sessão — a Fase 5 quebra no primeiro uso.

**Fix — token via header, só na plataforma nativa (web continua 100% cookie httpOnly):**

1. `POST /api/auth/login` passa a incluir o token assinado no corpo da resposta **somente quando o request trouxer o header `X-Client-Platform: native`** (mandado pelo app Capacitor) — evita expor o token a código web via JS.
2. Frontend nativo: logo após o login, salva o token em `@capacitor/preferences` (armazenamento nativo, não é `localStorage`/JS-acessível como o cookie seria). Um helper `authHeaders()` lê esse token quando `Capacitor.isNativePlatform()` e retorna `{ Authorization: 'Bearer <token>' }`; em web retorna `{}` (a sessão continua só no cookie).
3. Middleware `autenticar` (`server.ts:198`) passa a aceitar token tanto via cookie quanto via header `Authorization: Bearer` — checa o header primeiro, cai para o cookie.
4. Todo `fetch` do `drain()`, `fetchWithCache` e `apiFetch` passa a incluir `...(await authHeaders())` nos headers, além do `credentials: 'include'` (inofensivo em native, necessário em web).

```bash
npm install @capacitor/preferences
```

### Idempotência (mudança de backend)

Sem idempotência, uma escrita que o servidor **commitou** mas cuja resposta se **perdeu** (rede caiu no meio) é reenviada no próximo drain → entrega/funcionário/EPI **duplicado** e baixa de estoque em dobro.

Solução: o cliente já gera um UUID por operação; basta enviá-lo no header `Idempotency-Key` e o servidor deduplica.

**Correção B6/B7 — não usar `Map` em memória.** Um `Map` some com qualquer restart do processo (deploy, crash, `pm2 restart` — que já é rotina neste projeto). Cenário real, não teórico: op enviada → servidor comita → resposta se perde na rede → restart do backend antes do próximo drain → cache vazio → retry duplica a entrega e a baixa de estoque. A janela offline de 8h torna isso plausível. Correção: tabela SQLite, chave gravada **na mesma transação** da escrita, e **só cachear 2xx** (um 500 transitório cacheado por 24h transformaria erro passageiro em erro permanente para aquela chave).

```sql
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key        TEXT PRIMARY KEY,
  status     INTEGER NOT NULL,
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

```ts
// server.ts — middleware aplicado às rotas de escrita (POST/PUT/PATCH/DELETE)
async function idempotente(req, res, next) {
  const key = req.header('Idempotency-Key');
  if (!key) return next();
  const hit = await buscarIdempotencyKey(key);              // crud.ts: SELECT status, body FROM idempotency_keys WHERE key = ?
  if (hit) return res.status(hit.status).json(JSON.parse(hit.body));  // replay → devolve o resultado ORIGINAL (nunca 409 aqui — ver B8)
  const _json = res.json.bind(res);
  res.json = (body: unknown) => {
    if (res.statusCode < 300) {                             // só 2xx entra no cache — 4xx/5xx nunca
      salvarIdempotencyKey(key, res.statusCode, JSON.stringify(body)).catch(() => {}); // fire-and-forget, não bloqueia a resposta
    }
    return _json(body);
  };
  next();
}
// limpeza periódica (ex.: cron/setInterval diário): DELETE FROM idempotency_keys WHERE created_at < ?  (janela de 24h-7d)
```

> Continua válido só para single-instance (uma tabela local por processo). Multi-instância exigiria a tabela compartilhada (Postgres/Redis) — fora do escopo atual, mas a troca de `Map`→SQLite já resolve o caso real de restart de processo único.

### Persistência de armazenamento

```ts
// chamar logo após login bem-sucedido
export async function garantirPersistencia() {
  if (navigator.storage?.persist) {
    const ok = await navigator.storage.persist();
    if (!ok) {
      // alerta na UI: "Armazenamento não garantido — sincronize antes de fechar o app"
    }
  }
}
```

### Leitura sem clobber de pendências (corrigido)

`fetchWithCache` (Fase 2) **não** pode sobrescrever a store inteira com o que vem do servidor. Isso cobre dois casos, não só um:

1. **Registros criados offline** (`id < 0`, ainda não subiram) → preservar integralmente, como antes.
2. **Registros existentes (`id > 0`) com edição pendente na fila** (PUT/PATCH ainda não sincronizado) → a versão do servidor por si só é mais velha que a edição local. Sobrescrever sem reaplicar o patch faz a tela "desfazer" a edição do operador até o sync subir — isso inclui o **estoque otimista** (`criarEntregaOffline` decrementa `estoque` localmente; um refresh sem essa reaplicação devolve o estoque antigo do servidor e o operador pode revender o item que já entregou).

```ts
async function mergeServerData<T extends { id?: number }>(store: Entity, serverRows: T[]) {
  const db = await getDb();
  const tx = db.transaction([store, 'sync_queue'], 'readwrite');
  const storeTx = tx.objectStore(store);
  const locais: T[] = await storeTx.getAll();
  const pendentesCriados = locais.filter(r => isTempId((r as any).id));   // id<0, nunca apagar

  const opsPendentes: SyncOperation[] = (await tx.objectStore('sync_queue').getAll())
    .filter(o => o.state === 'pending' && o.entity === store && (o.method === 'PUT' || o.method === 'PATCH'));

  await storeTx.clear();
  for (const r of serverRows) {
    // reaplica por cima do dado do servidor qualquer PUT/PATCH pendente deste registro (pode haver mais de um)
    const patch = opsPendentes
      .filter(o => idDaUrl(o.url) === (r as any).id)
      .reduce((acc, o) => ({ ...acc, ...(o.body as object) }), r as object);
    await storeTx.put(patch);
  }
  for (const p of pendentesCriados) await storeTx.put(p);   // registros criados offline
  await tx.done;
}
```

> Depende de `atualizar*Offline` enviar o **corpo completo** do registro no PUT (ver correção B9 abaixo) — senão o "patch" reaplicado aqui também estaria incompleto.

---

## Resolução de conflitos (explicação detalhada)

> Você pediu para **entender** este ponto. Esta seção explica o que é um conflito aqui, quais casos existem, a política escolhida e por que ela é segura no seu cenário.

### O que é um conflito, neste sistema

Um conflito acontece quando **o mesmo registro** é alterado em dois lugares antes de sincronizar — tipicamente um operador offline edita um funcionário/EPI que, enquanto isso, foi editado por outro operador online (ou por outro dispositivo offline). Quando a fila do operador offline finalmente sobe, as duas versões competem.

### Os três casos possíveis

| Caso | Exemplo | O que acontece |
|------|---------|----------------|
| **Edição × Edição** | Dois operadores mudam o telefone do mesmo funcionário | A última escrita a **chegar** ao servidor vence (LWW). |
| **Edição × Exclusão** | Um edita o funcionário; o outro o exclui | Depende da ordem de chegada. Se a exclusão chega antes, o `PUT` posterior recria/erra; tratamos o `PUT` órfão como `dead` (ação humana). |
| **Criação × Criação** | Dois dispositivos cadastram "o mesmo" funcionário (mesma matrícula/e-mail) | O 2º `POST` bate na restrição `UNIQUE` do banco → o servidor responde **409** → a op vai para `dead` com a mensagem ("e-mail já cadastrado"), para o operador decidir. **Não** há perda: o dado fica na carta morta. |

> **Estoque é exceção e não sofre LWW.** A baixa de estoque é **transacional e aditiva** no servidor (`crud.ts:61` — `estoque = MAX(0, estoque - qtd)`; cancelamento devolve com `estoque + qtd`). Duas entregas offline do mesmo EPI **ambas** se aplicam quando sincronizam. O único risco é "vender" a última unidade duas vezes (dois dispositivos, offline, mesmo item) — o servidor **trava em 0** e isso é sinalizado no audit log. Bloquear a entrega em campo seria pior que o problema, então **permitimos a venda a descoberto e marcamos** (ver Fase 3, estoque otimista).

### Política escolhida: Last-Write-Wins **+ log de auditoria**

LWW puro perde a versão sobrescrita silenciosamente. Para atender "mínima perda de dados", endurecemos: **antes** de aplicar um `PUT`/`PATCH` que sobrescreve, o servidor grava no audit log a versão anterior.

Isso exige três peças novas, todas pequenas. Código abaixo segue o padrão real de `crud.ts` (sqlite3 com callback embrulhado em Promise, `db.get` para single-row).

**(a) `crud.ts` — leituras single-row que hoje não existem** (`listarFuncionarios`/`listarEpis` são paginadas e caras demais para isso):

```ts
// READ single-row — usado pelo log de sobrescrita e pela restauração.
// Não inclui biometrias: o PUT /api/funcionarios não as toca, então o snapshot {de} não precisa delas.
export function buscarFuncionario(id: number): Promise<Funcionario | undefined> {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM funcionarios WHERE id = ?`, [id], (err, row: any) => {
      if (err) reject(err); else resolve(row);
    });
  });
}

export function buscarEpi(id: number): Promise<Epi | undefined> {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM epis WHERE id = ?`, [id], (err, row: any) => {
      if (err) reject(err); else resolve(row);
    });
  });
}

export function buscarAuditLog(id: number): Promise<any | undefined> {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM audit_log WHERE id = ?`, [id], (err, row: any) => {
      if (err) reject(err); else resolve(row);
    });
  });
}
```

**(b) `server.ts` — log de sobrescrita nos dois PUTs.** Vale para `PUT /api/funcionarios/:id` (`server.ts:407`) **e** `PUT /api/epis/:id` (`server.ts:468`) — o LWW se aplica igualmente a funcionários e EPIs:

```ts
// dentro do try do PUT /api/funcionarios/:id (idem para epis, com buscarEpi/'epi_sobrescrito')
const anterior = await buscarFuncionario(id);
if (!anterior) return res.status(404).json({ error: 'Funcionário não encontrado' });
// ↑ este 404 também materializa o caso Edição × Exclusão da tabela acima: PUT órfão → dead
await atualizarFuncionario(id, req.body);
const a = actor(req);
await registrarAuditoria(
  'funcionario_sobrescrito', 'funcionario', id,
  JSON.stringify({ de: anterior, para: req.body }),   // versão descartada fica recuperável
  a.id, a.username,
);
```

**(c) `server.ts` — restauração em 1 clique: `POST /api/audit-log/:id/restaurar`** (`soAdmin`). Reaplica o campo `de` de um evento `*_sobrescrito` e **audita a própria restauração** (com `audit_ref` apontando para o evento original), para que a restauração seja ela mesma reversível e rastreável:

```ts
const RESTAURAVEIS: Record<string, { buscar: (id: number) => Promise<any>,
                                     atualizar: (id: number, dados: any) => Promise<void>,
                                     acaoLog: string }> = {
  funcionario: { buscar: buscarFuncionario, atualizar: atualizarFuncionario, acaoLog: 'funcionario_restaurado' },
  epi:         { buscar: buscarEpi,         atualizar: atualizarEpi,         acaoLog: 'epi_restaurado' },
};

app.post('/api/audit-log/:id/restaurar', soAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'ID inválido' });
  try {
    const log = await buscarAuditLog(id);
    if (!log) return res.status(404).json({ error: 'Registro de auditoria não encontrado' });
    if (!log.acao.endsWith('_sobrescrito') || !(log.entidade in RESTAURAVEIS))
      return res.status(400).json({ error: 'Este evento de auditoria não é restaurável' });

    const { buscar, atualizar, acaoLog } = RESTAURAVEIS[log.entidade];
    const { de } = JSON.parse(log.detalhe);
    const atual = await buscar(log.entidade_id);
    if (!atual) return res.status(410).json({ error: 'Registro original foi excluído' });

    await atualizar(log.entidade_id, de);              // reaplica a versão sobrescrita
    const a = actor(req);
    await registrarAuditoria(acaoLog, log.entidade, log.entidade_id,
      JSON.stringify({ de: atual, para: de, audit_ref: id }), a.id, a.username);
    res.json({ success: true });
  } catch (e: any) {
    if (String(e?.message).includes('UNIQUE'))         // snapshot antigo pode colidir com dado novo
      return res.status(409).json({ error: 'Restauração conflita com dado atual (UNIQUE): ' + e.message });
    res.status(500).json({ error: 'Erro ao restaurar' });
  }
});
```

**(d) UI (pequena, na tela de auditoria `soAdmin` já existente):** nas linhas com ação `*_sobrescrito`, em vez de exibir o JSON cru de `detalhe`, renderizar um **diff campo a campo** (só os campos onde `de[k] !== para[k]`, como `campo: valor antigo → valor novo`) e um botão **"Restaurar versão anterior"** que confirma e chama o endpoint acima. É um componente de ~30 linhas (map sobre `Object.keys(de)`) + um `apiFetch` — sem estado novo, sem rota nova no front.

Resultado: **o "perdedor" do LWW não some e a recuperação não é mais manual** — o admin vê o diff legível na tela de auditoria e restaura com um clique; a restauração gera seu próprio evento de auditoria (`*_restaurado` com `audit_ref`), então nada se perde nem fica sem rastro, inclusive restaurações equivocadas (que podem ser restauradas de volta pelo mesmo mecanismo).

### Por que isso é suficiente no seu caso

- Geralmente há **1 operador por turno** → edição concorrente do mesmo registro é rara.
- Quando ocorre, o resultado é determinístico (LWW por ordem de chegada) e **auditável** (versão antiga preservada).
- Criação duplicada é barrada pelo banco (`UNIQUE`) e tratada como carta morta, não como sobrescrita.

### Quando isto **não** bastaria (upgrade futuro)

Se edição concorrente do mesmo registro virar rotina (vários operadores no mesmo dia), o caminho é:
1. Adicionar coluna `updated_at` (ou `version`) em `funcionarios`/`epis`.
2. O cliente envia o `updated_at` que tinha ao editar; o servidor detecta divergência (conflito real) em vez de sobrescrever cego.
3. UI de resolução (manter meu / manter do servidor / mesclar campo a campo).

Isto está **fora** do escopo atual (decisão: LWW + log), mas o `updated_at` é barato de adicionar desde já e deixa a porta aberta.

---

## Matriz de cenários (todas as possibilidades)

Tabela-resumo do comportamento garantido em cada situação de campo:

| Cenário | Comportamento |
|---------|---------------|
| App aberto sem internet | Carrega do IndexedDB (assets via SW, dados via Fase 2). |
| Criar entrega/funcionário/EPI offline | Vira registro otimista (`id < 0`) + op na fila. UI igual ao online. |
| Fechar/recarregar o app com fila pendente | Fila e dados persistem no IndexedDB; sincronizam ao voltar a rede. |
| Crash/bateria no meio de um envio | Idempotency-Key evita duplicar no reenvio. |
| Resposta perdida após servidor gravar | Replay idempotente → tratado como sucesso, sem duplicar. |
| Voltar online | `probe` confirma servidor → `drain()` sobe a fila em ordem, remapeando ids. |
| Sessão expirou (>8h) | 401 → fila **pausa**, UI pede re-login, sincroniza após autenticar. Nada perdido. |
| Erro de validação (400) | Op vira `dead`, visível, com a mensagem do servidor. Nunca somem. |
| Duplicidade (409, e-mail/matrícula) | Op vira `dead` para decisão humana. |
| Edição concorrente do mesmo registro | LWW + versão antiga no audit log, restaurável em 1 clique pelo admin (`POST /api/audit-log/:id/restaurar`). |
| Última unidade vendida 2× offline | Estoque trava em 0; evento marcado no audit log. |
| Excluir registro criado offline (ainda não sincronizado) | Coalescido: POST+DELETE se cancelam, nada vai ao servidor. |
| Navegador tenta evictar IndexedDB | `storage.persist()` impede; se negado, UI alerta o operador. |

---

## Fases

### Fase 1 — PWA: app carrega offline (assets)
**✅ Implementado e testado (2026-08-11)** — SW ativo, assets em cache, app abre offline.

**Entrega:** O app abre sem internet. Se houver sessão ativa em cache (ver "Restauração de sessão" abaixo), o Dashboard é restaurado direto; senão, a tela de login aparece. (Dados ainda dependem das fases seguintes.)

**Extra não previsto no plano original, implementado junto (fecha buraco achado testando esta fase):** restauração de sessão ao F5 — `GET /api/auth/me` + cache de claims em `localStorage` + fallback automático quando o backend está offline/inalcançável (inclusive `502` de backend fora do ar, tratado igual a offline). Detalhes em `testes-offline.md`.

#### Pacotes
```bash
npm install -D vite-plugin-pwa
npm install workbox-window
```

#### `public/manifest.json`
```json
{
  "name": "SegurID — Gestão de EPIs",
  "short_name": "SegurID",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f1117",
  "theme_color": "#0f1117",
  "icons": [
    { "src": "/favicon.svg", "sizes": "any", "type": "image/svg+xml" },
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```
Criar também `public/icon-192.png` e `public/icon-512.png`.

#### `vite.config.ts`
```ts
import { VitePWA } from 'vite-plugin-pwa'

plugins: [
  react(),
  VitePWA({
    registerType: 'prompt',           // NÃO 'autoUpdate': não recarregar o app no meio de um turno com fila pendente
    workbox: {
      navigateFallback: 'index.html', // SPA sem router → toda navegação cai no index offline
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      runtimeCaching: [
        {
          // Modelos do face-api.js (grandes) — precisam estar em cache para biometria facial offline
          urlPattern: /\/models\/.*/,
          handler: 'CacheFirst',
          options: { cacheName: 'face-models', expiration: { maxAgeSeconds: 60*60*24*30 } },
        },
        {
          // API NUNCA é cacheada pelo SW: a verdade offline é o IndexedDB, não respostas HTTP velhas
          urlPattern: /\/api\/.*/,
          handler: 'NetworkOnly',
        },
      ],
    },
    manifest: false, // usamos public/manifest.json manual
  }),
]
```

> **Modelos faciais offline:** se o primeiro uso for offline, os modelos em `/models/` não estarão em cache e a biometria facial não funciona. Mitigação: fazer um "aquecimento" online no primeiro login (carregar os modelos uma vez) **ou** precachear os modelos no build. Documentar para o operador: *primeiro login do dispositivo deve ser com internet*.

#### `index.html` (no `<head>`)
```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#0f1117" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

#### `src/main.tsx`
```ts
import { registerSW } from 'virtual:pwa-register'
const updateSW = registerSW({
  onNeedRefresh() { /* mostrar botão "Atualizar" — só aplicar quando a fila estiver vazia */ },
  onOfflineReady() { /* opcional: toast "pronto para uso offline" */ },
})
```

#### Esforço: 6–10h

---

### Fase 2 — IndexedDB: dados disponíveis offline (com merge)
**Entrega:** Offline, o usuário vê os dados do último acesso online (EPIs, funcionários, entregas, cargos, biometrias).

#### `src/offline/db.ts`
```ts
import { openDB, IDBPDatabase } from 'idb'
import type { Epi, Funcionario, Entrega, Cargo, Usuario, Biometria } from '../types'
import type { SyncOperation, Entity } from './types'

const DB_NAME = 'segurid-offline'
const DB_VERSION = 1

export async function getDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('epis',         { keyPath: 'id' })
      db.createObjectStore('funcionarios', { keyPath: 'id' })
      db.createObjectStore('entregas',     { keyPath: 'id' })
      db.createObjectStore('cargos',       { keyPath: 'id' })
      db.createObjectStore('usuarios',     { keyPath: 'id' })
      db.createObjectStore('biometrias',   { keyPath: 'id' })
      db.createObjectStore('sync_queue',   { keyPath: 'id' })       // SyncOperation
      db.createObjectStore('id_map',       { keyPath: 'tempId' })   // tempId → realId
    },
  })
}
// + helpers tipados: dbGetAll, dbPut, dbDelete, dbClear, mergeServerData (ver "Leitura sem clobber")
```

```bash
npm install idb
```

#### `src/offline/dataLayer.ts` — leituras
```ts
import { dbGetAll, mergeServerData } from './db'
import { isReachable } from './reachability'

async function fetchWithCache<T extends { id?: number }>(url: string, store): Promise<T[]> {
  if (await isReachable()) {
    try {
      const res = await fetch(url, { credentials: 'include' })
      if (res.ok) {
        const data: T[] = await res.json()
        if (Array.isArray(data)) { await mergeServerData(store, data); return dbGetAll(store) } // merge, não overwrite
      }
    } catch { /* cai no fallback local */ }
  }
  return dbGetAll(store)
}

export const getEntregas     = () => fetchWithCache<Entrega>    ('/api/entregas',     'entregas')
export const getFuncionarios = () => fetchWithCache<Funcionario>('/api/funcionarios', 'funcionarios')
export const getCargos       = () => fetchWithCache<Cargo>      ('/api/cargos',       'cargos')
export const getEpis         = () => fetchWithCache<Epi>        ('/api/epis',         'epis')
export const getUsuarios     = () => fetchWithCache<Usuario>    ('/api/users',        'usuarios')
```

#### `src/App.tsx` — substituir o `useEffect` de carga (linhas 96–116)
```ts
import { getEntregas, getFuncionarios, getCargos, getEpis, getUsuarios } from './offline/dataLayer'

const [e, f, c, ep, u] = await Promise.all([
  getEntregas(), getFuncionarios(), getCargos(), getEpis(), getUsuarios(),
])
setEntregas(e); setFuncionarios(f); setCargos(c); setEpis(ep); setUsers(u)
```

#### Esforço: 12–16h

---

### Fase 3 — Sync queue à prova de perda (escrita offline)
**Entrega:** Toda mutação offline (criar entrega, editar funcionário, salvar biometria, etc.) é persistida, sincroniza ao voltar a rede com remapeamento de ids, idempotência e tratamento de erro sem descarte.

> **Atenção — refator maior que o original.** Os handlers atuais (`handleSetEntregas` `App.tsx:120`, `handleSetFuncionarios` `:168`, `handleSetEpis` `:228`) detectam create/update/delete por **diferença de tamanho de array** e dedup em memória (`entregasEnviadasRef`, etc.). Isso **não sobrevive a reload** nem funciona offline. Eles devem ser trocados por chamadas **explícitas** de create/update/delete no `dataLayer`. O id temporário negativo + o UUID da op substituem os `*EnviadosRef`.

#### `src/offline/syncQueue.ts`
```ts
import { dbGetAll, dbPut, dbDelete } from './db'
import type { SyncOperation } from './types'
import { v4 as uuidv4 } from 'uuid'

export async function enqueue(op: Omit<SyncOperation, 'id'|'createdAt'|'attempts'|'nextAttemptAt'|'state'>) {
  const item: SyncOperation = { ...op, id: uuidv4(), createdAt: Date.now(), attempts: 0, nextAttemptAt: 0, state: 'pending' }
  await dbPut('sync_queue', item)
  return item.id
}
export async function listQueue()        { return (await dbGetAll('sync_queue')).sort((a,b)=>a.createdAt-b.createdAt) }
export async function listQueuePending() { return (await listQueue()).filter(o => o.state === 'pending') }
export async function listDead()         { return (await listQueue()).filter(o => o.state === 'dead') }
export async function removeFromQueue(id: string) { await dbDelete('sync_queue', id) }
export async function updateOp(op: SyncOperation) { await dbPut('sync_queue', op) }
```
```bash
npm install uuid && npm install -D @types/uuid
```

#### `src/offline/syncService.ts`
Implementa `drain()`, `isReachable()` (importado), `coalesce()`, `resolveDeps()`, `onSuccess()`, `onConflict()`, `toDead()`, `backoff()` e o controle de `needsReauth` — conforme a seção "Máquina de estados do `drain()`".

```ts
export function registerSyncListeners() {
  window.addEventListener('online', () => drain())
  setInterval(() => drain(), 30_000)   // também tenta periodicamente (probe é barato)
}
```

#### `src/offline/dataLayer.ts` — escritas
```ts
import { enqueue } from './syncQueue'
import { drain } from './syncService'
import { dbPut, dbDelete, dbGetAll } from './db'
import { nextTempId } from './ids'

// ENTREGA (inclui baixa de estoque otimista local)
export async function criarEntregaOffline(entrega: Omit<Entrega,'id'>) {
  const tempId = nextTempId()
  await dbPut('entregas', { ...entrega, id: tempId, _pending: true })
  // estoque otimista: reflete a baixa localmente para o operador não revender o que já entregou
  for (const it of entrega.itens) {
    const epi = (await dbGetAll('epis')).find(e => e.id === it.epi_id)
    if (epi) await dbPut('epis', { ...epi, estoque: Math.max(0, epi.estoque - it.qtd) })
  }
  const deps = [entrega.funcionario_id, ...entrega.itens.map(i => i.epi_id)].filter(id => id < 0)
  await enqueue({ entity:'entrega', method:'POST', url:'/api/entregas', body: entrega, tempId, dependsOn: deps })
  drain()
}

export async function atualizarStatusEntregaOffline(id: number, patch: Partial<Entrega>) {
  const atual = (await dbGetAll('entregas')).find(e => e.id === id)
  if (!atual) return
  const completo = { ...atual, ...patch }               // registro INTEIRO, não o patch
  await dbPut('entregas', completo)
  // corrige B9: server.ts faz UPDATE full-replace (todas as colunas) e validarEntrega/validarFuncionario/
  // validarEpi exigem corpo completo — mandar só `patch` no PUT ou dá 400 (campos obrigatórios ausentes)
  // ou, nos campos opcionais, ANULA colunas no banco (silenciosamente, sem erro). O body enviado tem que
  // ser o snapshot completo do registro, com o patch já mesclado por cima.
  await enqueue({ entity:'entrega', method:'PUT', url:`/api/entregas/${id}`, body: completo, dependsOn: id < 0 ? [id] : [] })
  drain()
}

// FUNCIONÁRIO / EPI / CARGO seguem o MESMO padrão (corrigido, B9):
//   criar*Offline     → tempId + dbPut(_pending) + enqueue(POST, tempId)
//   atualizar*Offline → carrega o registro completo do IndexedDB, mescla o patch em memória,
//                       dbPut do objeto completo, e enqueue(PUT, body: <objeto completo>, dependsOn se tempId)
//                       — NUNCA enfileirar um Partial<T> cru como body
//   deletar*Offline   → dbDelete + enqueue(DELETE, dependsOn se tempId)  // coalesce trata o caso temp

// BIOMETRIA (dupla cadeia de dependência: funcionário e a própria biometria)
export async function salvarBiometriaOffline(bio: Omit<Biometria,'id'>) {
  const tempId = nextTempId()
  await dbPut('biometrias', { ...bio, id: tempId, _pending: true })
  await enqueue({ entity:'biometria', method:'POST', url:'/api/biometrias', body: bio, tempId,
                  dependsOn: bio.funcionario_id < 0 ? [bio.funcionario_id] : [] })
  drain()
}
export async function atualizarDescriptorOffline(biometriaId: number, descriptor_json: string) {
  // depende do id REAL da biometria → dependsOn se ainda for temp
  await enqueue({ entity:'biometria_descriptor', method:'PATCH',
                  url:`/api/biometrias/${biometriaId}/descriptor`, body:{ descriptor_json },
                  dependsOn: biometriaId < 0 ? [biometriaId] : [] })
  drain()
}
```

#### `src/App.tsx` — handlers de mutação
Trocar os `apiFetch` diretos dos handlers (`:129`, `:151`, `:176`, `:189`, `:201`, `:213`, `:236`, `:249`) por chamadas explícitas do `dataLayer` (`criarEntregaOffline`, `atualizarStatusEntregaOffline`, `criar/atualizar/deletarFuncionarioOffline`, `criar/atualizar/deletarEpiOffline`, `salvarBiometriaOffline`, `atualizarDescriptorOffline`). Remover os `*EnviadosRef` (substituídos pela fila).

`src/main.tsx`:
```ts
import { registerSyncListeners } from './offline/syncService'
registerSyncListeners()
```

#### Backend (mudanças para suportar a Fase 3)
1. **`GET /api/health`** público (antes do `autenticar`) para o probe.
2. **Middleware `idempotente`** nas rotas de escrita (ver "Idempotência").
3. **Log de sobrescrita** nos `PUT` de funcionários e EPIs + `buscarFuncionario`/`buscarEpi`/`buscarAuditLog` em `crud.ts` (ver "Resolução de conflitos", itens a–b).
4. **Restauração:** `POST /api/audit-log/:id/restaurar` (`soAdmin`) + diff e botão "Restaurar" na tela de auditoria (ver "Resolução de conflitos", itens c–d).
5. **Flag de venda a descoberto:** em `criarEntrega` (`crud.ts:61`), registrar no audit log quando uma baixa levaria o estoque a < 0 (hoje é clampeado por `MAX(0,...)`).

#### Esforço: 45–65h *(revisado — inclui as correções B1/B3/B4/B5/B6/B7/B9/B10/B11: auth nativa por header, merge reaplicando pendências, cascata de `dead`, ordem por registro no backoff, idempotência em SQLite, PUT com corpo completo, `buscar*` single-row + endpoint de restauração do audit log, Web Locks entre abas)*

> Nota: com 1 operador por turno, conflito real será raro — se o prazo apertar, coalesce/cascata podem ser simplificados numa 1ª versão; decisão do time, não deste plano.

---

### Fase 4 — Indicador visual + carta morta
**Entrega:** Badge de status (online/offline + nº de operações pendentes) **e** um painel das operações `dead` que precisam de ação humana.

#### `src/components/OfflineBadge.tsx`
```tsx
import { useEffect, useState } from 'react'
import { listQueuePending, listDead } from '../offline/syncQueue'
import { precisaReautenticar } from '../offline/syncService'
import { isReachable } from '../offline/reachability'

export function OfflineBadge() {
  const [online, setOnline] = useState(navigator.onLine)
  const [pend, setPend] = useState(0)
  const [dead, setDead] = useState(0)
  const [reauth, setReauth] = useState(false)

  useEffect(() => {
    const update = async () => {
      setOnline(await isReachable())
      setPend((await listQueuePending()).length)
      setDead((await listDead()).length)
      setReauth(precisaReautenticar())
    }
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    const iv = setInterval(update, 5000); update()
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); clearInterval(iv) }
  }, [])

  if (online && pend === 0 && dead === 0 && !reauth) return null
  // ... renderiza: offline | "sincronizando N" | "sessão expirou — faça login" | "M operações precisam de atenção"
  return /* badge fixo no canto */ null
}
```

- **Painel de carta morta:** lista as ops `dead` com a mensagem do servidor e ações: *re-tentar*, *editar e re-tentar*, *exportar JSON* (backup manual), *descartar* (com confirmação explícita — único descarte permitido).
- **Re-login:** quando `precisaReautenticar()`, abrir o fluxo de login; ao logar, chamar `reautenticado()` para retomar o drain.

#### Esforço: 6–8h *(original 3–4h; +carta morta e re-login)*

---

### Fase 5 — Capacitor: app nativo iOS/Android
**Entrega:** Builds instaláveis (`.aab`/`.apk` e `.ipa`). O código React é reaproveitado integralmente — Capacitor roda o mesmo HTML/JS numa WebView nativa.

#### Setup (roda inteiro no Windows)
```bash
npm install @capacitor/core @capacitor/android @capacitor/ios
npm install -D @capacitor/cli
npm install @capacitor/camera @capacitor/network @capacitor/status-bar @capacitor/splash-screen @capacitor/preferences
npx cap init "SegurID" br.com.segurid.epi --web-dir dist
npx cap add android
npx cap add ios   # funciona no Windows: gera a pasta ios/ e avisa "skipping pod install"
                  # (o pod install roda no runner macOS do CI — ver "Build iOS" abaixo)
```

> A pasta `ios/` gerada **deve ser commitada** — é ela que o CI em nuvem builda. A `android/` também (exceto keystore/senhas, ver Build Android).

#### `capacitor.config.ts`
```ts
import type { CapacitorConfig } from '@capacitor/cli'
const config: CapacitorConfig = {
  appId: 'br.com.segurid.epi',
  appName: 'SegurID',
  webDir: 'dist',                    // saída do `vite build` (padrão do vite.config.ts atual)
  // SÓ para dev com hot-reload (aponta para o Vite na LAN). NUNCA commitar habilitado:
  // server: { url: 'http://192.168.x.x:5173', cleartext: true },
  plugins: {
    SplashScreen: { launchShowDuration: 1500, backgroundColor: '#0f1117' },
    StatusBar:    { style: 'Dark', backgroundColor: '#0f1117' },
  },
}
export default config
```

> No Android (Capacitor 6) a WebView roda em `https://localhost` (`androidScheme` padrão `'https'`); no iOS, em `capacitor://localhost`. Isso importa para o CORS (abaixo) e explica por que cookie `SameSite=strict` não funciona no nativo (já resolvido pela auth via header, seção "Autenticação em ambiente nativo").

#### URL base da API no nativo (obrigatório — sem isso nada funciona)

Hoje **todas** as requests usam caminho relativo (`/api/...`): `apiFetch` (`src/api.ts:5-6`) chama `fetch(url)` direto, e o Vite dev proxy resolve para `localhost:3000`. **Esse proxy não existe no app empacotado** — dentro da WebView, `/api/...` resolveria para `https://localhost/api/...` (o próprio app) e falharia sempre. Correção:

```ts
// src/apiBase.ts (novo)
import { Capacitor } from '@capacitor/core'

// Em web: '' (relativo — dev proxy/nginx continuam funcionando exatamente como hoje).
// Em nativo: URL absoluta do backend de produção, sobrescrevível por env no build.
export const API_BASE = Capacitor.isNativePlatform()
  ? (import.meta.env.VITE_API_BASE ?? 'https://segurid.com.br')
  : ''
export const apiUrl = (path: string) => `${API_BASE}${path}`
```

Pontos de aplicação (todos os lugares que fazem `fetch` de `/api/...`):
1. `apiFetch` e `logout` (`src/api.ts`) → `fetch(apiUrl(url), ...)`.
2. `isReachable()` (Fase 3) → `fetch(apiUrl('/api/health'), ...)`.
3. `fetchWithCache` (Fase 2) e o `drain()` (Fase 3) → idem. **A `sync_queue` continua gravando URLs relativas** (`/api/entregas`); o `apiUrl()` é aplicado só na hora do envio — assim a fila não fica amarrada a um domínio se a URL do backend mudar entre o enqueue e o drain.

Build nativo apontando para staging: `VITE_API_BASE=https://stg.segurid.com.br npm run build && npx cap sync`.

#### Câmera no iOS (`src/camera.ts`)
```ts
import { Capacitor } from '@capacitor/core'
import { Camera } from '@capacitor/camera'
export async function requestCameraPermission() {
  if (Capacitor.isNativePlatform()) {
    const perm = await Camera.requestPermissions({ permissions: ['camera'] })
    if (perm.camera !== 'granted') throw new Error('Câmera negada pelo sistema')
  }
}
```
Chamar antes de iniciar o stream nos componentes de biometria (`faceApi.ts` usa `getUserMedia`, ok no WebView Android; iOS exige a permissão explícita).

#### CORS para WebView (`server.ts:32`)
Adicionar à allowlist de origem:
```ts
origin === 'capacitor://localhost' ||   // iOS Capacitor
origin === 'https://localhost' ||       // Android Capacitor (androidScheme 'https', padrão v6)
origin === 'http://localhost'           // Android com androidScheme 'http' (fallback)
```

#### Reachability/Network no nativo
Opcional: usar `@capacitor/network` para reagir a mudanças de conectividade mais rápido que o evento `online` do browser, mas o `isReachable()` (probe real) continua sendo a fonte de verdade para o drain.

#### Build Android — APK/AAB assinado, 100% no Windows

Pré-requisitos: JDK 17 + Android SDK (o Android Studio instala ambos, mas o build em si é linha de comando — não precisa abrir o Studio).

**1. Keystore (uma vez, guardar para sempre — perder = não conseguir mais atualizar o app na Play):**
```powershell
keytool -genkeypair -v -keystore segurid-release.keystore -alias segurid `
  -keyalg RSA -keysize 2048 -validity 10000
```

**2. `android/keystore.properties` (NÃO commitar — adicionar ao `.gitignore` junto com o `.keystore`):**
```properties
storeFile=..\\..\\segurid-release.keystore
storePassword=***
keyAlias=segurid
keyPassword=***
```

**3. `android/app/build.gradle` — signing config:**
```groovy
def keystoreProps = new Properties()
def keystoreFile = rootProject.file('keystore.properties')
if (keystoreFile.exists()) keystoreProps.load(new FileInputStream(keystoreFile))

android {
    signingConfigs {
        release {
            storeFile file(keystoreProps['storeFile'])
            storePassword keystoreProps['storePassword']
            keyAlias keystoreProps['keyAlias']
            keyPassword keystoreProps['keyPassword']
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

**4. Build:**
```powershell
npm run build; npx cap sync android
cd android
.\gradlew bundleRelease     # → android/app/build/outputs/bundle/release/app-release.aab (Play Store)
.\gradlew assembleRelease   # → android/app/build/outputs/apk/release/app-release.apk (instalar direto no aparelho p/ teste)
```

Teste em aparelho físico: habilitar depuração USB e `adb install app-release.apk` (ou `npx cap run android` para debug com logs).

#### Build iOS — CI em nuvem, sem Mac (ambiente de dev é Windows)

`npx cap open ios`/`xcodebuild` exigem macOS; o `.ipa` sai de um runner macOS na nuvem. **Serviço escolhido: Codemagic** (em vez do GitHub Actions genérico citado antes), por um motivo decisivo: **ele gerencia a assinatura iOS automaticamente via App Store Connect API key** — cria certificado e provisioning profile sozinho, sem nunca precisar de um Mac para exportar `.p12`/Keychain. No GitHub Actions puro, montar os secrets de assinatura sem um Mac é o passo mais doloroso (CSR via openssl, conversão `.cer`→`.p12` manual); fica como alternativa, não como caminho principal.

**Passos (uma vez):**
1. Conta Apple Developer ativa (US$99/ano) e app registrado no App Store Connect com bundle id `br.com.segurid.epi`.
2. App Store Connect → Users and Access → **Integrations** → gerar API key (role **App Manager**); baixar o `.p8` (só pode baixar 1 vez), anotar Key ID e Issuer ID.
3. Codemagic (tem free tier com minutos de macOS) → conectar o repo Git → Team settings → cadastrar a API key (`.p8` + Key ID + Issuer ID) como integração `app_store_connect`.
4. Commitar `codemagic.yaml` na raiz:

```yaml
workflows:
  ios-release:
    name: iOS release (TestFlight)
    instance_type: mac_mini_m2
    integrations:
      app_store_connect: segurid-asc-key      # nome da API key cadastrada no passo 3
    environment:
      ios_signing:
        distribution_type: app_store          # Codemagic cria cert + profile via API key
        bundle_identifier: br.com.segurid.epi
      node: 20
      xcode: latest
      cocoapods: default
    scripts:
      - npm ci
      - npm run build                          # VITE_API_BASE já no ambiente, se staging
      - npx cap sync ios                       # roda o pod install que o Windows pulou
      - xcode-project use-profiles             # injeta a assinatura gerenciada no projeto
      - xcode-project build-ipa --workspace ios/App/App.xcworkspace --scheme App
    artifacts:
      - build/ios/ipa/*.ipa
    publishing:
      app_store_connect:
        auth: integration
        submit_to_testflight: true             # .ipa vai direto para o TestFlight
```

5. Rodar o workflow → testar no aparelho via **TestFlight** (é também a única forma de testar em iPhone real sem Mac — não há sideload).

**Honestidade sobre o limite:** sem Mac, todo ciclo de debug iOS passa pelo CI + TestFlight (~15–25 min por iteração) e não há Safari remote inspector para a WebView. Problemas específicos de WKWebView serão mais lentos de diagnosticar — planejar o grosso dos testes no Android (idêntico em 95%: mesma WebView de Chromium do dia a dia) e usar o iOS para validação final.

#### face-api.js e IndexedDB dentro do Capacitor

- É a mesma engine de browser (WebView), então **face-api.js, `getUserMedia` e IndexedDB funcionam sem mudança**. Melhor ainda: os modelos de `/models/` são empacotados dentro do app (`dist/` → assets nativos), carregam do disco sem rede — a ressalva "primeiro login precisa de internet" da Fase 1 **não se aplica ao app nativo**.
- **Ressalva iOS (1 linha de cautela):** o WKWebView pode evictar IndexedDB sob pressão de disco mesmo com `navigator.storage.persist()` (que no iOS é menos garantido que no Chrome). Mitigação já embutida no desenho: janela offline de 1 turno + alerta do `garantirPersistencia()` + badge de pendências — não acumular dias de fila no aparelho.

#### Permissões nativas
**Android** (`AndroidManifest.xml`): `CAMERA`, `INTERNET`, `ACCESS_NETWORK_STATE`.
**iOS** (`Info.plist`): `NSCameraUsageDescription` = "Câmera utilizada para reconhecimento facial na entrega de EPIs".

#### Esforço: 22–34h, dividido em:
- **Capacitor + Android assinado:** 14–20h *(setup, `apiBase`/URL absoluta, auth nativa B1 via header/Preferences, permissões, keystore + gradle, testes em aparelho físico)*
- **iOS via CI em nuvem (Codemagic):** 8–14h *(conta/API key/integração, `codemagic.yaml`, primeira build verde — a primeira sempre quebra em algo de assinatura ou pods —, validação via TestFlight)*

---

### Fase 6 — Publicação nas lojas
**Entrega:** App no Google Play e App Store.

- **Android — Google Play:** conta Developer (US$25, único) → upload do `.aab` já assinado na Fase 5 (`gradlew bundleRelease`) → ficha da loja (screenshots, política de privacidade — obrigatória por usar câmera) → revisão 1–3 dias.
- **iOS — App Store:** conta Developer (US$99/ano) → o pipeline Codemagic da Fase 5 já entrega no TestFlight → promover a build à App Store no App Store Connect → revisão 1–5 dias.

**Atenção (Apple):** descrever no formulário o uso de reconhecimento facial com o texto correto — a versão anterior deste plano dizia "não há coleta de dados biométricos armazenados externamente", o que é **falso**: `crud.ts` grava `imagem_base64` e `descriptor_json` no servidor. Texto correto a declarar: *"biometria facial (imagem e descritor) utilizada para confirmar identidade do funcionário no recebimento de EPIs; os dados são enviados e armazenados no servidor interno da empresa (não em serviço de terceiros), não compartilhados externamente."*

#### Esforço: 8–16h + tempo de revisão das lojas

---

## Resumo de esforço por fase

| Fase | Descrição | Esforço |
|------|-----------|---------|
| 1 | Service Worker + manifest (app carrega offline) | 6–10h |
| 2 | IndexedDB + dataLayer reads com merge | 12–16h |
| 3 | Sync queue à prova de perda (ids, idempotência, biometria, backend, correções B1/B3–B11) | 45–65h |
| 4 | Indicador online/offline + carta morta + re-login | 6–8h |
| 5 | Capacitor: setup + Android assinado (14–20h) + iOS via Codemagic (8–14h) | 22–34h |
| 6 | Publicação nas lojas | 8–16h |
| **Total** | | **~99–149h** |

---

## Estrutura de arquivos ao final

```
src/
  offline/
    db.ts           — IndexedDB: stores, helpers, mergeServerData (sem clobber)
    types.ts        — SyncOperation, Entity, IdMapping
    ids.ts          — nextTempId(), isTempId()
    reachability.ts — isReachable() (probe real, não navigator.onLine)
    dataLayer.ts    — reads (merge) + writes offline (enqueue + dbPut + estoque otimista)
    syncQueue.ts    — CRUD da store sync_queue (+ listDead, listQueuePending)
    syncService.ts  — drain() máquina de estados, coalesce, resolveDeps, idempotência, needsReauth
  apiBase.ts        — API_BASE/apiUrl(): URL absoluta do backend quando nativo (Capacitor)
  camera.ts         — requestCameraPermission() (Capacitor)
  components/
    OfflineBadge.tsx — status + painel de carta morta + re-login
  App.tsx           — modificado: dataLayer nos handlers; remove *EnviadosRef
  main.tsx          — modificado: registerSW + registerSyncListeners + garantirPersistencia
  api.ts            — modificado: apiFetch/logout usam apiUrl() + authHeaders()
  faceApi.ts, types.ts — praticamente sem mudanças
  backend/server.ts — +/api/health, +middleware idempotente, +log de sobrescrita, +flag venda a descoberto, +CORS Capacitor
capacitor.config.ts — novo
codemagic.yaml      — novo (build iOS em nuvem)
android/ ios/       — gerados pelo Capacitor (commitados; keystore.properties e .keystore fora do git)
public/             — manifest.json, icon-192.png, icon-512.png
vite.config.ts      — vite-plugin-pwa (registerType 'prompt', navigateFallback, NetworkOnly /api)
```

---

## Dependências novas
```json
{
  "dependencies": {
    "idb": "^8.x", "uuid": "^9.x", "workbox-window": "^7.x",
    "@capacitor/core": "^6.x", "@capacitor/android": "^6.x", "@capacitor/ios": "^6.x",
    "@capacitor/camera": "^6.x", "@capacitor/network": "^6.x", "@capacitor/preferences": "^6.x",
    "@capacitor/status-bar": "^6.x", "@capacitor/splash-screen": "^6.x"
  },
  "devDependencies": {
    "vite-plugin-pwa": "^0.20.x", "@capacitor/cli": "^6.x", "@types/uuid": "^9.x"
  }
}
```

---

## Ordem recomendada + roteiro de testes (foco em não‑perda)

Implementar em fases, testando cada uma. Os testes abaixo cobrem explicitamente os modos de perda de dados:

1. **Fase 1** → DevTools > Application > Service Worker: SW registrado, assets em cache; recarregar offline abre o app.
2. **Fase 2** → logar online, derrubar o backend, recarregar → dados aparecem do IndexedDB; confirmar que registros `_pending` **não** somem após um refresh online.
3. **Fase 3** (testes de não‑perda):
   - Criar entrega offline → ver `sync_queue` no IndexedDB → religar → confirmar que chegou e o estoque bateu.
   - **Dependência:** criar funcionário offline **e** uma entrega para ele offline → sincronizar → a entrega deve apontar para o id **real** do funcionário (remap).
   - **Idempotência:** simular resposta perdida (matar a aba logo após o POST sair) → ao voltar, **não** duplica.
   - **Crash:** criar várias ops offline → fechar o app → reabrir → fila intacta → sincroniza.
   - **400/409:** forçar um e-mail duplicado offline → ao sincronizar, op vira `dead` (não some, não fica em loop).
   - **401:** adiantar o relógio / revogar sessão → ao sincronizar, fila **pausa** e UI pede login; após logar, retoma.
   - **Coalesce:** criar e excluir o mesmo funcionário offline → nada vai ao servidor.
4. **Fase 4** → badge aparece offline e some após sync; painel de carta morta lista as ops `dead` com ações.
5. **Fase 5** → testar em Android físico primeiro (é onde há debug rápido via `adb`/Chrome inspect); iOS só via build Codemagic + TestFlight em aparelho real (não há simulador sem Mac).
6. **Fase 6** → só após os testes de dispositivo real aprovados.