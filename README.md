# Osiria

Osiria is a Social-to-Earn web application. Brands fund campaigns. People complete social tasks. Accounts, eligibility review, campaigns, OP rewards, and Phase 6 security controls are implemented. Payment settlement and live social verification remain unconfigured.

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
npm test
npm run build
```

## Phase 1 — public UI

Public routes:

- `/` Home
- `/campaigns` Sample campaign gallery
- `/how-it-works` Product model
- `/login` Sign in
- `/register` Create a worker or advertiser account
- `/forgot-password` and `/reset-password` Password reset
- `/worker`, `/advertiser`, `/admin` Role homes. Admin is server-gated.

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

## Phase 3 — authentication and roles

Accounts use scrypt password hashes and database-backed sessions. The browser only receives an HttpOnly session cookie. Worker, Advertiser, and Admin are the roles. Registration can create a worker or an advertiser. It cannot create an admin.

Protected pages and `/api/admin/*` check the session and role on the server. A proxy redirect for a missing cookie is only an early hint.

Password reset stores a hashed single-use token. The API response never includes that token. Set `APP_ORIGIN` in production and `AUTH_EMAIL_WEBHOOK` to deliver the link. Without a webhook, production does not log the link.

Create the first admin with a password you choose at runtime:

```powershell
$env:ADMIN_EMAIL = "you@example.com"
$env:ADMIN_PASSWORD = "a unique password you supply"
npm run auth:create-admin
```

The command refuses missing, weak, and well-known passwords such as `admin` or `password`. It does not print the password.

### Apply migrations (after you have a real DATABASE_URL)

```powershell
Copy-Item .env.example .env
# Edit .env and replace USER/PASSWORD/host with your values
npx prisma migrate deploy
npm run db:health
```

For local development iteration you can use `npx prisma migrate dev` instead of `migrate deploy`.

## Out of scope so far

- Payments and wallets
- Social verification
- Production hosting and operational validation
- Secrets in the repository

See `PROGRESS.md` for phase status.

## Phase 6 � security and fraud review

Suspicious submissions are stored as `FLAGGED` with durable fraud events. Heuristics check canonical proof reuse across workers/tasks, platform domains, handle mismatch, and submission velocity. These are review signals, not proof of misconduct or verification of task completion. Admins resolve flags once with a required reason at `/admin/fraud`. Dismissal returns a proof to the normal review queue; confirmation rejects it. Appeals require an admin decision and cannot be approved through the ordinary advertiser review endpoint.

Campaign creation, proof submission, campaign moderation, reviews, appeals, funding allocation, eligibility changes, and fraud decisions have database audit records. Sensitive campaign mutations write their audit record in the same transaction. Admins can read recent logs at `GET /api/admin/audit`; no API edits or deletes audit entries.

Server validation limits JSON bodies to 20 KB while reading, rejects arrays/malformed objects, bounds text and financial integers, and rejects credential-bearing proof URLs. Origin checks compare the complete origin against `APP_ORIGIN` or the request URL, ignoring untrusted forwarded-host overrides. Protected API responses use `no-store`. Forms and HTTP mutations share service-level limits; auth, submission, funding, and general API limits also protect their entry points.

**Funding is deliberately unavailable through public API/form actions** until trusted payment settlement is integrated. Internal allocation requires a completed payment belonging to the campaign owner, matching currency, sufficient unallocated credit, and campaign cap headroom. OP points remain separate from cash. Serializable PostgreSQL transactions protect budget, slot, duplicate detection, review, and fraud resolution decisions; transaction conflicts abort and may require retrying after refreshing. A partial unique payout index and existing points/submission constraints defend against double credit.

Run `npm run security:backfill-proofs` after applying the Phase 6 migration to populate canonical comparison keys for existing submissions. Legacy proofs are still checked until this completes. Follow [DEPLOYMENT.md](DEPLOYMENT.md) for rollout and remaining risks.

### Security verification and limits

Automated coverage includes authorization/ownership, CSRF origin forgery, body limits, financial validation, funding refusal, fraud quarantine/resolution, appeal bypass prevention, and rate limits. Prisma transaction contract tests mock the database; memory-store concurrency tests do **not** establish PostgreSQL concurrency behavior. A live database migration and concurrent-load rehearsal are required before production.

No security guarantee is made. In-process rate limits reset on restart and do not coordinate across instances. Configure shared gateway/Redis limits and ensure only a trusted proxy can supply client IP headers. Social heuristics can be bypassed or produce false positives; URL redirects, equivalent post variants, account ownership, and content authenticity need human/provider verification. No proof URL is fetched by the server. Admin MFA, email verification enforcement, external tamper-resistant audit retention, a strict CSP, and a full independent security assessment remain outstanding. Repository scanning found no real credentials in tracked/nonignored source; that does not cover Git history, ignored files, deployed secrets, or external systems.
