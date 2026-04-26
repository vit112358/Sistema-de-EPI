# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Frontend dev server (with HMR)
npm run dev

# Backend server (run in a separate terminal)
npx ts-node src/backend/server.ts

# Build (TypeScript check + Vite bundle)
npm run build

# Lint
npm run lint

# Preview production build
npm run preview
```

Both `npm run dev` (port 5173) and the backend server (port 3000) must run simultaneously. Vite proxies `/api/*` requests to `http://localhost:3000`.

## Architecture

**Full-stack TypeScript app**: React 19 frontend + Express 5 backend + SQLite3 database.

### Frontend (`src/`)
- **`App.tsx`** — monolithic ~1,600-line component containing all UI, state, and business logic. All views (Login, Dashboard, EPI management, Employee management, Deliveries, Biometrics, Reports) live here as nested components with inline CSS via a `<style>` tag.
- **`main.tsx`** — React root render entry point.
- State is managed with `useState`/`useEffect` only — no external state library.
- No routing library; navigation is tab-based via local state.

### Backend (`src/backend/`)
- **`server.ts`** — Express REST API server on port 3000. Handles CRUD for entregas (deliveries), funcionarios (employees), and EPIs.
- **`database.ts`** — SQLite schema initialization (tables: `epis`, `funcionarios`, `entregas`, `entrega_itens`).
- **`crud.ts`** — Database helper functions used by the server routes.
- **`bd_epi.sqlite`** — SQLite database file (committed to repo).

### REST API
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/entregas` | List / create deliveries |
| PUT | `/api/entregas/:id` | Update delivery status |
| GET/POST | `/api/funcionarios` | List / create employees |
| PUT/DELETE | `/api/funcionarios/:id` | Update / delete employee |

### Domain
EPI = Equipamento de Proteção Individual (Personal Protective Equipment). The system manages EPI inventory, employee assignments, delivery tracking with biometric signatures (facial, fingerprint, manual), and stock/validity alerts.