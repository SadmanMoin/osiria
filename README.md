# Osiria

Osiria is a Social-to-Earn web application. Brands fund campaigns. People complete social tasks. Later phases will add accounts, verification, and settlement.

## Stack

- Next.js 16 (App Router, TypeScript, `src/` directory)
- Tailwind CSS 4
- ESLint
- PostgreSQL with Prisma ORM 7.10.1 (`@prisma/client` + `@prisma/adapter-pg`)

## Run locally

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```powershell
npm run lint
npm run typecheck
npm run build
```

## Phase 1 — public UI

Public routes:

- `/` Home
- `/campaigns` Sample campaign gallery
- `/how-it-works` Product model
- `/login` Placeholder (no authentication)
- `/register` Placeholder (no account creation)

Campaign cards still use isolated sample records in `src/data/sample-campaigns.ts`. That file is preview data only.

## Phase 2 — database schema

Prisma models live in `prisma/schema.prisma`. Monetary fields (`budgetMinor`, `rewardAmountMinor`, `amountMinor`) are **integer minor units** (for example cents), never floating-point values.

Connection configuration:

- Copy `.env.example` to `.env`
- Set `DATABASE_URL` to your PostgreSQL URL
- Do not commit `.env`

The app does **not** treat the database as connected until `DATABASE_URL` is set locally and a health check succeeds.

Health check (does not print credentials):

- HTTP: `GET /api/health/database`
- CLI: `npm run db:health`

There is no seeded or default admin account.

### Apply migrations (after you have a real DATABASE_URL)

```powershell
Copy-Item .env.example .env
# Edit .env and replace USER/PASSWORD/host with your values
npx prisma migrate deploy
npm run db:health
```

For local development iteration you can use `npx prisma migrate dev` instead of `migrate deploy`.

## Out of scope so far

- Authentication
- Payments and wallets
- Social verification
- Deployment
- Secrets in the repository

See `PROGRESS.md` for phase status.
