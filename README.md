# SegurID — Sistema de Gestão de EPIs

Sistema para controle de Equipamentos de Proteção Individual (EPIs): estoque, entregas, assinatura biométrica (facial, digital, manuscrita) e rastreabilidade completa via log de auditoria.

**Produção:** https://segurid.com.br — modelo multi-cliente: cada empresa acessa via `slug.segurid.com.br`, com banco e processo PM2 isolados.

---

## Stack

| Camada     | Tecnologia                        |
|-----------|-----------------------------------|
| Frontend  | React 19 + TypeScript + Vite      |
| Backend   | Express 5 + TypeScript (ts-node)  |
| Banco     | SQLite 3 (arquivo local)          |
| Auth      | JWT via cookie httpOnly           |
| Biometria | face-api.js (TensorFlow.js)       |
| PDF       | jsPDF                             |
| Deploy    | Oracle Cloud (Ubuntu 22.04) + nginx + PM2 |

---

## Rodar localmente

### Pré-requisitos
- Node.js 20+
- npm

### Instalar
```bash
npm install
```

### Variáveis de ambiente obrigatórias
Crie um arquivo `.env` na raiz (nunca comite):
```env
JWT_SECRET=sua-chave-secreta-longa
ADMIN_PASSWORD=SenhaAdmin@1
```

### Iniciar

```bash
# Terminal 1 — frontend (HMR em :5173)
npm run dev

# Terminal 2 — backend (:3000)
npx ts-node src/backend/server.ts
```

O Vite faz proxy de `/api/*` → `localhost:3000`.

### Outros comandos
```bash
npm run build    # TypeScript check + bundle Vite
npm run lint     # ESLint
npm run preview  # Preview do build de produção
```

---

## Arquitetura

```
src/
├── main.tsx                    # Entry React
├── App.tsx                     # Estado global, roteamento por tabs
├── api.ts                      # apiFetch (credentials: include) + logout
├── types.ts                    # Interfaces TypeScript compartilhadas
├── helpers.ts                  # fmtDate, fmtDateStr, addDays, daysUntil, declarações EPI
├── faceApi.ts                  # face-api.js wrapper (descriptors, EAR, landmarks)
│
├── components/
│   ├── LoginPage.tsx
│   ├── TrocarSenhaPage.tsx     # Troca obrigatória de senha no primeiro login
│   ├── Dashboard.tsx
│   ├── EpisPage.tsx
│   ├── FuncionariosPage.tsx
│   ├── EntregasPage.tsx
│   ├── NovaEntregaPage.tsx     # Fluxo de entrega + assinatura biométrica
│   ├── BiometriaPage.tsx       # Cadastro facial e digital com face-api.js
│   ├── CancelarEntregaPage.tsx
│   ├── RelatorioTrocaPage.tsx
│   ├── EpisPorFuncionarioPage.tsx
│   ├── CadastroUsuariosPage.tsx
│   ├── AuditLogPage.tsx
│   ├── DateInput.tsx           # Input de data dd/mm/aaaa com calendário em pt-BR
│   └── ConfirmDialog.tsx
│
└── backend/
    ├── server.ts               # Express — todos os endpoints REST
    ├── database.ts             # Schema SQLite + migrations + seed admin
    └── crud.ts                 # Funções de acesso ao banco
```

### Banco de dados (SQLite)

| Tabela          | Descrição                                      |
|-----------------|------------------------------------------------|
| `usuarios`      | Usuários do sistema com bcrypt + trocar_senha  |
| `funcionarios`  | Cadastro de funcionários                       |
| `cargos`        | Tabela de cargos                               |
| `epis`          | Estoque de EPIs                                |
| `entregas`      | Registros de entrega com status e assinatura   |
| `entrega_itens` | Itens de cada entrega                          |
| `biometrias`    | Dados biométricos (facial/digital)             |
| `audit_log`     | Log imutável de todas as operações             |
| `login_attempts`| Tentativas de login para rate limiting         |

---

## API REST

A documentação completa está em [`openapi.yaml`](./openapi.yaml) no formato OpenAPI 3.0.

Para visualizar com Swagger UI:
```bash
npx @redocly/cli preview-docs openapi.yaml
# ou abra em https://editor.swagger.io e cole o conteúdo do arquivo
```

### Resumo dos endpoints

| Método   | Rota                              | Perfil mínimo   | Descrição                        |
|----------|-----------------------------------|-----------------|----------------------------------|
| POST     | `/api/auth/login`                 | público         | Login (cookie httpOnly)          |
| POST     | `/api/auth/logout`                | público         | Logout + revogação de JTI        |
| POST     | `/api/auth/change-password`       | autenticado     | Troca de senha obrigatória       |
| GET      | `/api/entregas`                   | qualquer        | Listar entregas                  |
| POST     | `/api/entregas`                   | operador/admin  | Criar entrega                    |
| PUT      | `/api/entregas/:id`               | operador/admin  | Assinar / cancelar entrega       |
| GET      | `/api/funcionarios`               | qualquer        | Listar funcionários              |
| POST     | `/api/funcionarios`               | operador/admin  | Criar funcionário                |
| PUT      | `/api/funcionarios/:id`           | operador/admin  | Atualizar funcionário            |
| DELETE   | `/api/funcionarios/:id`           | operador/admin  | Excluir funcionário              |
| GET      | `/api/epis`                       | qualquer        | Listar EPIs                      |
| POST     | `/api/epis`                       | operador/admin  | Criar EPI                        |
| PUT      | `/api/epis/:id`                   | operador/admin  | Atualizar EPI                    |
| DELETE   | `/api/epis/:id`                   | operador/admin  | Excluir EPI                      |
| GET      | `/api/cargos`                     | qualquer        | Listar cargos                    |
| POST     | `/api/cargos`                     | operador/admin  | Criar cargo                      |
| PUT      | `/api/cargos/:id`                 | operador/admin  | Atualizar cargo                  |
| DELETE   | `/api/cargos/:id`                 | operador/admin  | Excluir cargo                    |
| POST     | `/api/biometrias`                 | operador/admin  | Registrar biometria              |
| GET      | `/api/biometrias/:id/imagem`      | operador/admin  | Buscar imagem base64             |
| PATCH    | `/api/biometrias/:id/descriptor`  | operador/admin  | Atualizar descriptor facial      |
| DELETE   | `/api/biometrias/:id`             | operador/admin  | Excluir biometria                |
| GET      | `/api/users`                      | admin           | Listar usuários                  |
| POST     | `/api/users`                      | admin           | Criar usuário                    |
| PUT      | `/api/users/:id`                  | admin           | Atualizar usuário                |
| DELETE   | `/api/users/:id`                  | admin           | Excluir usuário                  |
| GET      | `/api/audit-log`                  | admin           | Log de auditoria paginado        |

### Autenticação

Todas as rotas (exceto login e logout) exigem o cookie `epi_session` enviado automaticamente pelo browser com `credentials: 'include'`.

```http
POST /api/auth/login
Content-Type: application/json

{ "username": "admin", "senha": "MinhaSenh@1" }
```

Resposta:
```json
{ "id": 1, "nome": "Administrador", "username": "admin", "role": "admin", "trocar_senha": 0 }
```
Cookie `epi_session` (httpOnly, SameSite=Strict, 8h) é definido automaticamente.

---

## Segurança

| Medida                         | Implementação                                              |
|--------------------------------|------------------------------------------------------------|
| Autenticação                   | JWT (8h) em cookie httpOnly — sem localStorage             |
| Revogação de tokens            | Mapa `jti → expiry` em memória, limpeza horária            |
| Senhas                         | bcrypt (cost 10) + migração automática de plain-text       |
| Política de senha              | Mínimo 8 chars + 1 número ou símbolo especial              |
| Troca obrigatória              | Flag `trocar_senha` no JWT — bloqueia app até trocar       |
| Rate limiting                  | Login: 5/15min · Troca de senha: 5/5min                   |
| Autorização                    | Middleware por rota (`soAdmin`, `soOperadorOuAdmin`)        |
| Validação de input             | Funções `validar*` em todas as rotas POST/PUT              |
| CORS                           | Whitelist: localhost:5173 + segurid.com.br + *.segurid.com.br |
| Payload máximo                 | 2 MB (biometrias base64)                                   |
| Log de auditoria               | Toda operação mutável registrada com usuário e timestamp   |
| Proteção de exclusão           | Funcionário com entrega pendente não pode ser excluído     |

---

## Deploy

### Atualizar cliente existente
```bash
bash deploy.sh               # build + deploy completo
bash deploy.sh --skip-build  # só envia arquivos (sem rebuild)
```

O script envia `dist/`, `src/backend/`, `package.json` via SCP e reinicia o PM2 do cliente principal (`backend`, porta 3000).

### Provisionar novo cliente
```bash
bash provision.sh <slug> <porta>
# Exemplo: bash provision.sh acme 3001
# Segundo cliente: bash provision.sh beta 3002

# Se o build já foi feito:
bash provision.sh acme 3001 --skip-build
```

O script cria automaticamente:
1. Diretório isolado `/home/ubuntu/app-<slug>/` com banco SQLite próprio
2. Frontend estático em `/var/www/html/<slug>/`
3. Processo PM2 `backend-<slug>` na porta indicada
4. Virtual host nginx para `<slug>.segurid.com.br`
5. Certificado HTTPS via Let's Encrypt (certbot)

> **Pré-requisito DNS:** adicione um registro A `<slug>` → `163.176.188.254` no Registro.br antes de rodar o script (o certbot valida o domínio).

### Variáveis de ambiente por cliente (PM2)
Após provisionar, configure as credenciais do cliente via SSH:
```bash
pm2 set backend-<slug>:JWT_SECRET <segredo-forte>
pm2 set backend-<slug>:ADMIN_PASSWORD <senha-inicial>
PORT=<porta> pm2 restart backend-<slug>
pm2 save
```

> **Atenção:** O backend não inicia sem `JWT_SECRET` e `ADMIN_PASSWORD` definidos.

### Infraestrutura
- **VM:** Oracle Cloud Free Tier — Ubuntu 22.04, 1 GB RAM (suporta ~5–6 clientes simultâneos)
- **IP:** 163.176.188.254
- **DNS:** registro A por cliente no Registro.br (`slug` → `163.176.188.254`)
- **Processo:** PM2 + ts-node por instância, porta exclusiva por cliente
- **Proxy:** nginx virtual host por subdomínio → `/api/` → `localhost:<porta>`, estáticos → `/var/www/html/<slug>/`
- **SSL:** Let's Encrypt por subdomínio, renovação automática via certbot

### Nginx — estrutura por cliente (`/etc/nginx/sites-available/<slug>`)
```nginx
server {
    listen 80;
    server_name <slug>.segurid.com.br;

    root /var/www/html/<slug>;
    index index.html;

    location /api/ {
        proxy_pass http://localhost:<porta>;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```
O certbot adiciona automaticamente o bloco SSL e o redirect 80 → 443.