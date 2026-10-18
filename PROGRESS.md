# Progress

## Phase 1 — Public product surface

Status: complete. `npm run lint` is clean and `npm run build` succeeded.

### Done

- Kept the existing Next.js 16 TypeScript / Tailwind / App Router scaffold.
- Added a dark Web3/SaaS design system in `src/app/globals.css`.
- Built reusable UI and public pages: Home, Campaigns, How It Works, Login, Register.
- Login and Register are disabled placeholders.
- Campaign UI still reads from `src/data/sample-campaigns.ts` for preview.

## Phase 2 — PostgreSQL and Prisma

Status: schema, client, migration files, and health check are in the repo. **The database is not connected** until a local `DATABASE_URL` is supplied and the health check succeeds.

### Done

- Installed Prisma ORM 7.10.1 with `@prisma/client`, `@prisma/adapter-pg`, `pg`, and `dotenv`, matching the official Prisma 7 + Next.js PostgreSQL guide (Prisma 8 is still a release candidate).
- `DATABASE_URL` is read from the environment (`prisma.config.ts` and the server client). Optional `DIRECT_URL` is documented for pooled setups.
- Reusable lazy Prisma client in `src/lib/db/prisma.ts` (one instance in development).
- Schema covers User, SocialAccount, SocialPlatformSetting, Campaign, CampaignTask, TaskSubmission, PointsLedger, Payment, CampaignBudgetLedger, Notification, FraudEvent, and AdminAuditLog.
- Money is stored as integer minor units. Relations, enums, indexes, unique constraints, and timestamps are in the schema.
- Initial SQL migration is in `prisma/migrations` (not applied to a live database in this phase).
- `.env.example` has placeholders only. `.env` and other secret env files are gitignored. `.env.example` is not.
- No hardcoded credentials and no production admin user.
- Health check: `GET /api/health/database` and `npm run db:health`. Responses do not include the connection string.

### Not claimed

- A working database connection
- Applied migrations against a real PostgreSQL instance
- Deployment

## Phase 3+

Blocked until Phase 2 is connected locally (health check `ok: true`) and reviewed.
