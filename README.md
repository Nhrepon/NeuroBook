# NeuroBook

Multi-platform accounting platform (Tally Prime alternative) for Bangladesh — Next.js 16 (web) + React Native via Expo (mobile) from a single codebase.

See [NeuroBook.md](NeuroBook.md) for the full architecture plan.

## Workspaces

- `apps/web` — Next.js 16 (App Router, Server Actions, REST `/api/v1/*`)
- `apps/mobile` — Expo (React Native, New Architecture, Expo Router v3+)
- `packages/shared` — pure-JS ledger engine, Zod schemas, money, auth primitives, BD formatters

## Quick start

```bash
# 1. Local infra
docker compose up -d

# 2. Install
npm install

# 3. Env
cp .env.example .env

# 4. Database
npm run db:migrate
npm run db:seed

# 5. Develop
npm run dev          # web + mobile in parallel
# or individually
npm run dev:web      # http://localhost:3000
npm run dev:mobile   # Expo Dev Client
```

## Layout

```
.
├── apps/
│   ├── web/                 # Next.js 16 (App Router)
│   └── mobile/              # Expo (New Architecture)
├── packages/
│   └── shared/              # ledger/, auth/, money/, format/
├── NeuroBook.md             # Architecture
├── docker-compose.yml       # Postgres, Redis, MinIO
├── tsconfig.base.json
└── package.json             # npm workspaces root
```

## Scripts

| Script              | What it does                              |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Web + mobile dev servers in parallel      |
| `npm run build`     | Build shared, then web, then mobile       |
| `npm run typecheck` | TypeScript across all workspaces          |
| `npm run test`      | Vitest in web + shared                    |
| `npm run lint`      | ESLint across web + shared                |
| `npm run db:migrate`| Apply Drizzle migrations (apps/web)       |
| `npm run db:seed`   | Seed dev data (apps/web)                  |
