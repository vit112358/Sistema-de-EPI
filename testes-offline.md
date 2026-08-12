# Plano de Testes & Publicação — Suporte Offline (SegurID)

Runbook prático para **(1)** subir o sistema, **(2)** publicá-lo como aplicativo (PWA e nativo Android/iOS) e **(3)** validar, passo a passo, todos os comportamentos offline descritos em `offline.md`.

> **Como usar:** execute as seções na ordem. Cada teste tem **pré-condição**, **passos com comandos** e **resultado esperado**. Marque ✅/❌ na coluna *OK?*. Os comandos são para **PowerShell (Windows)**; quando houver diferença, a versão Bash vem logo abaixo.

> **Importante — o que já existe vs. o que é do plano:** o sistema web atual (login, EPIs, funcionários, entregas, biometria) já funciona e pode ser testado hoje (seções 1 e parte da 2). Os testes **offline** (seção 3, Fases 1–5) só passam **conforme cada fase do `offline.md` for implementada** — a pré-condição de cada bloco indica qual fase ele exige.

---

## 0. Convenções e dois terminais

O sistema roda em **dois processos simultâneos**:

| Terminal | Processo | Porta |
|----------|----------|-------|
| A | Backend (Express + SQLite) | 3000 |
| B | Frontend (Vite) | 5173 (dev) / 4173 (preview) |

Em dev, o Vite faz proxy de `/api/*` → `http://localhost:3000` (`vite.config.ts:12`).

---

## 1. Preparar o ambiente

### 1.1 Pré-requisitos
```powershell
node -v        # esperado: v20+ (Vite 8 / TypeScript 6)
npm -v
git --version
```

### 1.2 Instalar dependências
```powershell
npm install
```

### 1.3 Variáveis de ambiente do backend (OBRIGATÓRIO)
O backend **encerra na hora** se `JWT_SECRET` não estiver definido (`server.ts:14`). Em banco novo, também exige `ADMIN_PASSWORD` para criar o admin do seed (`database.ts:166`).

```powershell
# Terminal A — definir ANTES de subir o backend
$env:JWT_SECRET    = "troque-por-uma-chave-aleatoria-bem-grande"
$env:ADMIN_PASSWORD = "SenhaForte123!"   # mín. 8 caracteres, com número/especial
```
```bash
# Bash (Git Bash / Linux)
export JWT_SECRET="troque-por-uma-chave-aleatoria-bem-grande"
export ADMIN_PASSWORD="SenhaForte123!"
```
> O `bd_epi.sqlite` já vem versionado no repo e provavelmente **já tem** o admin. Nesse caso `ADMIN_PASSWORD` é ignorado — use as credenciais existentes. `JWT_SECRET` é **sempre** necessário.

### 1.4 Subir o backend (Terminal A)
```powershell
npx ts-node src/backend/server.ts
```
**Esperado:** `Backend rodando em http://localhost:3000 (e acessível na rede local)`.

### 1.5 Subir o frontend (Terminal B)
```powershell
npm run dev
```
**Esperado:** Vite servindo em `http://localhost:5173`.

### 1.6 Smoke test do sistema atual

| ID | Objetivo | Passos | Esperado | OK? |
|----|----------|--------|----------|-----|
| S1 | Login | Abrir `http://localhost:5173` → logar com `admin` / sua senha | Entra; se for 1º login do seed, força troca de senha (`trocar_senha=1`) | |
| S2 | Listar dados | Navegar por EPIs, Funcionários, Entregas | Listas carregam sem erro no console | |
| S3 | Criar EPI | Cadastrar um EPI com estoque > 0 | Aparece na lista; persiste após reload | |
| S4 | Criar funcionário | Cadastrar funcionário (e-mail/telefone únicos) | Aparece na lista | |
| S5 | Criar entrega | Nova entrega para o funcionário, 1 item | Entrega criada; **estoque do EPI baixa** (`crud.ts:61`) | |
| S6 | Biometria facial | Cadastrar biometria facial de um funcionário | Captura funciona; descriptor salvo | |
| S7 | Cancelar entrega | Cancelar a entrega de S5 | Estoque **retorna** (`crud.ts:140`) | |

---

## 2. Como subir o sistema em aplicativos

### 2.1 Build de produção
```powershell
npm run build      # tsc -b && vite build  → gera dist/
```
**Esperado:** `dist/` criado, sem erros de TypeScript.

### 2.2 Pré-visualizar a build (necessário para testar PWA)
O Service Worker **não** roda bem no `npm run dev` — os testes da Fase 1 devem ser feitos sobre a **build de produção**.

```powershell
npm run preview    # serve dist/ em http://localhost:4173
```

> ⚠️ **Proxy no preview:** o `vite.config.ts` só configura proxy de `/api` para o `server` (dev), **não** para o `preview`. Para o preview falar com o backend, adicione:
> ```ts
> // vite.config.ts
> preview: { proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } } }
> ```
> **Alternativa** (testar SW em dev): habilite no plugin `VitePWA({ devOptions: { enabled: true }, ... })`.

### 2.3 PWA — instalar como aplicativo

**Pré-condição:** Fase 1 implementada + contexto seguro (`localhost` **ou** HTTPS — SW não registra em `http://` de rede).

- **Desktop (Chrome/Edge):** abrir o app → ícone **Instalar** (⊕) na barra de endereço → "Instalar". Abre em janela própria.
- **Android (Chrome):** abrir no celular → menu ⋮ → **Adicionar à tela inicial / Instalar app**.
- **iOS (Safari):** **Compartilhar** → **Adicionar à Tela de Início**.

**Acessar do celular na rede local** (precisa de HTTPS para o SW): use o **ngrok** (já liberado em `vite.config.ts:8`):
```powershell
ngrok http 5173
# abra a URL https://....ngrok-free.dev no celular
```

| ID | Objetivo | Passos | Esperado | OK? |
|----|----------|--------|----------|-----|
| P1 | Instalável | Build → preview → abrir no Chrome | Botão "Instalar" aparece | |
| P2 | Abre como app | Instalar e abrir pelo ícone | Abre em janela standalone (sem barra do browser) | |
| P3 | Ícone/nome | Verificar ícone e nome "SegurID" | Conforme `manifest.json` | |

### 2.4 Android nativo (Capacitor) — Fase 5

**Pré-requisitos:** Android Studio + JDK 17 + Android SDK (variável `ANDROID_HOME`).

```powershell
# 1. Instalar Capacitor (uma vez)
npm install @capacitor/core @capacitor/cli
npm install @capacitor/camera @capacitor/network @capacitor/status-bar @capacitor/splash-screen
npx cap init        # appId: br.com.segurid.epi | appName: SegurID | webDir: dist
npx cap add android

# 2. A cada build do frontend
npm run build
npx cap sync        # copia dist/ + plugins para o projeto Android

# 3. Abrir/rodar
npx cap open android   # abre o Android Studio
```
No Android Studio: selecionar um **emulador** ou **dispositivo físico** (com Depuração USB) e clicar **Run ▶**.

**Gerar instaláveis:**
```powershell
# APK de debug (para distribuir manualmente / testar)
cd android; .\gradlew assembleDebug
# saída: android/app/build/outputs/apk/debug/app-debug.apk

# AAB de release (para a Play Store) — requer keystore
keytool -genkeypair -alias segurid -keyalg RSA -keysize 2048 -validity 10000 -keystore segurid.keystore
.\gradlew bundleRelease
# saída: android/app/build/outputs/bundle/release/app-release.aab
```

| ID | Objetivo | Passos | Esperado | OK? |
|----|----------|--------|----------|-----|
| A1 | App abre no Android | Run no emulador | Splash → tela de login | |
| A2 | Câmera | Fazer biometria facial | Permissão pedida; câmera abre (`CAMERA` no Manifest) | |
| A3 | Fala com a API | Login + listar dados | Requests chegam ao backend (ver CORS 2.6) | |
| A4 | APK gerado | `assembleDebug` | `.apk` criado e instalável | |

### 2.5 iOS nativo (Capacitor) — Fase 5

**Pré-requisitos:** macOS + Xcode + CocoaPods (`sudo gem install cocoapods`).

```bash
npx cap add ios
npm run build && npx cap sync
npx cap open ios        # abre o Xcode
```
No Xcode: escolher **Simulator** ou dispositivo real → **Run ▶**. Publicação: **Product → Archive** → upload via **Transporter**.

> No `Info.plist` deve constar `NSCameraUsageDescription`. No primeiro acesso à câmera, chamar `requestCameraPermission()` (Capacitor) antes do `getUserMedia` (`src/camera.ts`).

### 2.6 CORS para os apps nativos (backend)
As requests do Capacitor saem de `capacitor://localhost` (iOS) ou `http://localhost` (Android). Adicionar à allowlist em `server.ts:32`:
```ts
origin === 'capacitor://localhost' ||   // iOS
origin === 'http://localhost'           // Android
```
Sem isso, A3 falha com erro de CORS.

### 2.7 Deploy da versão web/PWA (produção)
Resumo do `deploy.sh` (servidor Ubuntu `163.176.188.254`, backend em PM2):
```bash
npx vite build                       # gera dist/
# SCP dist/, src/backend/, package*.json, public/models/ → servidor
# no servidor:
npm install --omit=dev && sudo cp -r dist/* /var/www/html/app/ && pm2 restart backend
```
A PWA fica disponível em `https://segurid.com.br` (HTTPS → SW e instalação funcionam).

---

## 3. Testes da implementação offline (por fase)

> **Ferramentas de simulação** (decore — usadas o tempo todo):
>
> | Simular | Como |
> |---------|------|
> | **Offline** | DevTools → aba **Network** → throttling **Offline**. (Ou derrubar o backend com `Ctrl+C` no Terminal A.) |
> | **Inspecionar dados locais** | DevTools → **Application** → **IndexedDB** → `segurid-offline` (stores `entregas`, `sync_queue`, `id_map`, ...) |
> | **Inspecionar SW/cache** | DevTools → **Application** → **Service Workers** e **Cache Storage** |
> | **Sessão expirada (401)** | No Terminal A, **pare o backend, troque o `JWT_SECRET`** e suba de novo. O cookie atual deixa de validar → 401. |
> | **Conflito (409)** | Criar funcionário com e-mail/matrícula **já existente** (`UNIQUE` no banco). |
> | **Resposta perdida (idempotência)** | Reenviar a mesma requisição com o **mesmo** header `Idempotency-Key` (ver T3.3). |

### Fase 1 — App carrega offline (SW + manifest)
**Pré-condição:** Fase 1 implementada; rodando sobre `npm run build` + `npm run preview`.

| ID | Objetivo | Passos | Esperado | OK? |
|----|----------|--------|----------|-----|
| T1.1 | SW registrado | Application → Service Workers | SW "activated and running" | ✅ |
| T1.2 | Assets em cache | Application → Cache Storage | `index.html`, JS/CSS, ícones presentes | ✅ |
| T1.3 | Abre offline | Network → **Offline** → recarregar (F5) | App abre. Com sessão ativa em cache: restaura o **Dashboard** direto (ver Fase 1.5 abaixo). Sem sessão em cache: tela de **login** aparece (sem "sem internet") | ✅ (caminho com sessão) |
| T1.4 | Modelos faciais | 1º acesso **online** (aquece `/models/`) → depois offline → tela de biometria | Modelos carregam do cache; reconhecimento facial funciona offline | |
| T1.5 | Sem cache de API | Network → ver request `/api/*` | SW **não** serve `/api` do cache (NetworkOnly) | |

### Fase 1.5 — Restauração de sessão ao F5 (fora da numeração de fases, implementada em 2026-08-11)
**Pré-condição:** Fase 1 implementada. Backend com `GET /api/auth/me`. Frontend com `src/offline/session.ts` + mount effect em `App.tsx`.

| ID | Objetivo | Passos | Esperado | OK? |
|----|----------|--------|----------|-----|
| TS.1 | Sessão sobrevive a F5 online | Login online → F5 | Continua no Dashboard, sem re-logar | ✅ |
| TS.2 | Sessão sobrevive a F5 offline | Sessão ativa → Network **Offline** → F5 | Restaura o Dashboard a partir do cache local (`localStorage`) | ✅ |
| TS.3 | Sessão invalidada é respeitada | Trocar `JWT_SECRET` no backend + reiniciar → F5 online | Cai para Landing/Login; cache de sessão é limpo | ✅ |
| TS.4 | Troca de senha obrigatória não repete | Forçar `trocar_senha=1` → logar → trocar senha → F5 | Continua no Dashboard, sem pedir a troca de novo | ✅ |
| TS.5 | Backend fora do ar (não só offline de rede) | Matar o processo do backend → F5 | Mesmo comportamento do TS.2: `isReachable()` falha, restaura do cache. Requests em andamento retornam `502` no Network, mas isso não é `401` — não dispara logout global | ✅ |

### Fase 2 — Dados disponíveis offline (IndexedDB + merge)
**Pré-condição:** Fase 2 implementada.

| ID | Objetivo | Passos | Esperado | OK? |
|----|----------|--------|----------|-----|
| T2.1 | IndexedDB populado | Logar online → Application → IndexedDB → `segurid-offline` | Stores `epis`, `funcionarios`, `entregas`, `cargos` com dados | |
| T2.2 | Leitura offline | Derrubar backend (Ctrl+C no Terminal A) → recarregar app | Listas aparecem (vindas do IndexedDB), sem erro fatal | |
| T2.3 | `persist()` | Após login, no console: `await navigator.storage.persisted()` | Retorna `true` (armazenamento persistente garantido) | |
| T2.4 | Merge não apaga pendente | (requer Fase 3) criar 1 registro offline → voltar online → refresh | Registro pendente (`id<0`) **continua** na lista após o refresh | |

### Fase 3 — Escrita offline (sync queue à prova de perda)
**Pré-condição:** Fase 3 implementada (inclui backend: `/api/health`, middleware idempotente, log de sobrescrita).

#### T3.1 — Criar entrega offline e sincronizar
1. App logado e online. Anote o estoque atual de um EPI.
2. DevTools → Network → **Offline**.
3. Criar uma nova entrega desse EPI (qtd 1).
4. Application → IndexedDB → `sync_queue`: deve haver **1 operação** `POST /api/entregas`. A entrega aparece na UI com `id` **negativo**.
5. Network → **Online** (ou religar backend). Aguardar o `drain` (≤30s ou evento `online`).
6. **Esperado:** `sync_queue` esvazia; a entrega no servidor (recarregar com backend) tem `id` real positivo; **estoque baixou exatamente 1**.

#### T3.2 — Dependência (remap de id temporário)
1. Offline.
2. Criar **um funcionário novo** (ganha `id` negativo, ex.: `-1718…`).
3. Criar **uma entrega para esse funcionário** (ainda offline).
4. Inspecionar `sync_queue`: a op da entrega tem `body.funcionario_id` **negativo** e `dependsOn` com esse id.
5. Voltar online → aguardar `drain`.
6. **Esperado:** o funcionário sobe primeiro (recebe id real, ex.: `42`); a entrega sobe com `funcionario_id: 42` (remapeado via `id_map`); **nenhum erro de FK**, nenhuma entrega órfã.

#### T3.3 — Idempotência (resposta perdida não duplica)
Teste no **backend direto** (sem CORS, pois requests sem `Origin` são aceitos — `server.ts:34`):
```powershell
# 1) Login mantendo a sessão (cookie) em $s
$body = @{ username='admin'; senha='<sua-senha-admin>' } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:3000/api/auth/login -Method Post -Body $body -ContentType 'application/json' -SessionVariable s | Out-Null

# 2) Mesma entrega, MESMA Idempotency-Key, enviada DUAS vezes
$key  = [guid]::NewGuid().ToString()
$ent  = @{ funcionario_id=1; funcionario='Teste Idem'; status='assinado'; data='2026-06-17';
           itens=@(@{ epi_id=1; nome='Capacete'; img=''; qtd=1 }) } | ConvertTo-Json
$h = @{ 'Idempotency-Key' = $key }
Invoke-RestMethod -Uri http://localhost:3000/api/entregas -Method Post -Body $ent -ContentType 'application/json' -Headers $h -WebSession $s
Invoke-RestMethod -Uri http://localhost:3000/api/entregas -Method Post -Body $ent -ContentType 'application/json' -Headers $h -WebSession $s
```
**Esperado:** as duas chamadas retornam o **mesmo `id`**; apenas **uma** entrega é criada; o **estoque baixa só uma vez**. (Sem o middleware idempotente, criaria duas — teste falha.)

#### T3.4 — Crash / reload com fila pendente
1. Offline → criar 3 operações (1 EPI, 1 funcionário, 1 entrega).
2. **Fechar a aba** (ou F5) com a fila cheia.
3. Reabrir o app (ainda offline) → Application → IndexedDB → `sync_queue`.
4. **Esperado:** as 3 operações **continuam lá** (persistência em disco). Ao voltar online, todas sincronizam.

#### T3.5 — Erro permanente (400/409) vira "carta morta", não some
1. Garanta que existe um funcionário com e-mail `x@x.com`.
2. Offline → criar **outro** funcionário com o mesmo e-mail `x@x.com`.
3. Voltar online → aguardar `drain`.
4. **Esperado:** o servidor responde **409**; a operação vai para estado **`dead`** (visível no painel de carta morta da Fase 4), com a mensagem "e-mail já cadastrado". **Não** é apagada e **não** entra em loop de rettry.

#### T3.6 — Sessão expirada (401) pausa a fila, não descarta
1. Offline → criar 2 operações.
2. No Terminal A: parar o backend, **trocar `$env:JWT_SECRET`** por outro valor, subir de novo.
3. Voltar online → aguardar `drain`.
4. **Esperado:** primeiro 401 → o `drain` **para**; a UI sinaliza "sessão expirou — faça login"; a `sync_queue` **continua intacta** (nada descartado, `attempts` não disparado).
5. Fazer login de novo → o `drain` retoma e sobe as 2 operações.

#### T3.7 — Coalescing (criar + excluir offline = nada vai ao servidor)
1. Offline → criar um funcionário novo (id negativo).
2. Ainda offline → **excluir** esse mesmo funcionário.
3. Inspecionar `sync_queue`.
4. Voltar online → aguardar `drain`.
5. **Esperado:** as operações POST+DELETE se **cancelam** localmente; **nenhuma** request vai ao servidor; o funcionário nunca existiu lá.

#### T3.8 — Estoque otimista offline
1. Online: EPI com estoque 5.
2. Offline → criar entrega de 2 unidades.
3. **Esperado:** a UI mostra estoque **3** imediatamente (baixa otimista local), evitando que o operador revenda o que já entregou.
4. Voltar online → após sync, o estoque reflete o servidor.

#### T3.9 — Conflito de edição (LWW + log de auditoria)
1. Dois "lados": navegador 1 (online) e navegador 2 (vai ficar offline). Ambos com o mesmo funcionário aberto.
2. Navegador 2 → offline → editar o telefone → "A".
3. Navegador 1 → online → editar o telefone → "B".
4. Navegador 2 → voltar online → sincronizar.
5. **Esperado:** vence a **última escrita a chegar** (LWW). A versão sobrescrita fica registrada no **audit log** (`/api/audit-log`, ação `*_sobrescrito`) — recuperável, não perdida.

### Fase 4 — Indicador visual + carta morta + re-login
**Pré-condição:** Fase 4 implementada.

| ID | Objetivo | Passos | Esperado | OK? |
|----|----------|--------|----------|-----|
| T4.1 | Badge offline | Network → Offline | Badge "Offline" aparece | |
| T4.2 | Contador de fila | Criar 2 ops offline | Badge mostra "2 pendentes" | |
| T4.3 | Some após sync | Voltar online | Badge mostra "sincronizando…" e depois **some** | |
| T4.4 | Painel carta morta | Forçar um 409 (T3.5) | Op aparece no painel com mensagem + ações (re-tentar/editar/exportar/descartar) | |
| T4.5 | Re-login | Forçar 401 (T3.6) | Badge pede login; ao logar, fila retoma | |

### Fase 5 — Validação no aparelho (Android/iOS)
**Pré-condição:** Fases 1–4 + Capacitor (Fase 5).

> No app nativo, os assets já vêm embutidos (o SW da Fase 1 é menos crítico); o que importa no campo são as **Fases 2–4** (dados + fila offline).

| ID | Objetivo | Passos | Esperado | OK? |
|----|----------|--------|----------|-----|
| T5.1 | Modo avião | Ativar modo avião no aparelho → operar | App funciona; cria entregas offline | |
| T5.2 | Persistência real | Criar ops offline → **fechar o app** → reabrir | Fila intacta (IndexedDB sobrevive) | |
| T5.3 | Sync ao reconectar | Desativar modo avião | Fila sobe sozinha; badge some | |
| T5.4 | Câmera offline | Biometria facial em modo avião | Funciona (modelos em cache local) | |
| T5.5 | Bateria/kill | Matar o app no meio de um envio → reabrir online | Sem duplicação (idempotência) | |

---

## 4. Checklist final de aprovação

| Bloco | Status |
|-------|--------|
| 1. Ambiente sobe (backend + frontend + login) | ☐ |
| 2.1–2.3 Build + PWA instalável | ☐ |
| 2.4 App Android roda e fala com a API | ☐ |
| 2.5 App iOS roda (se macOS disponível) | ☐ |
| Fase 1 (T1.1–T1.5) | ☑ parcial — T1.1–T1.3 ✅, T1.4–T1.5 não testados |
| Fase 1.5 — Restauração de sessão (TS.1–TS.5) | ✅ |
| Fase 2 (T2.1–T2.4) | ☐ |
| Fase 3 (T3.1–T3.9) — **núcleo de não-perda** | ☐ |
| Fase 4 (T4.1–T4.5) | ☐ |
| Fase 5 (T5.1–T5.5) — aparelho real | ☐ |

**Critério de "pronto para campo":** todos os testes da **Fase 3** passam (é onde mora a garantia de não perder dados) **+** T5.1, T5.2, T5.3, T5.5 no aparelho real.