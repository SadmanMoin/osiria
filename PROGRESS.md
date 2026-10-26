# Progress

## Phase 1 — Public product surface

Status: complete. `npm run lint` is clean and `npm run build` succeeded.

### Done

- Kept the existing Next.js 16 TypeScript / Tailwind / App Router scaffold.
- Added a dark Web3/SaaS design system in `src/app/globals.css`.
- Built reusable UI and public pages: Home, Campaigns, How It Works, Login, Register.
- Login and Register shipped as disabled placeholders. Phase 3 replaced them with real accounts.
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

## Phase 3 — Authentication and role-based access

Status: complete in code. `npm run lint`, `npx tsc --noEmit`, `npm test` (30 tests), and `npm run build` succeeded.

Live sign-in still needs a reachable `DATABASE_URL` and `npx prisma migrate deploy`. This phase does not claim that the database is connected. Subsequent phases are recorded below.

### Done

- Registration, login, logout, and password reset. Passwords are scrypt hashes. Sessions live in PostgreSQL, and the browser cookie is HttpOnly, SameSite=Lax, and Secure in production.
- Roles are Worker, Advertiser, and Admin. Public registration can create a worker or an advertiser only.
- Server checks on `/worker`, `/advertiser`, `/account`, `/admin`, `/admin/users`, and `/api/admin/*`. A missing cookie is turned away before render. A present cookie is still looked up in the database, and the role is checked again in the route.
- Password reset tokens are hashed, expire in 30 minutes, and work once. The HTTP response does not include the token. Resetting a password deletes sessions.
- Validation covers email, name, password strength, role, and reset tokens. Login uses the same error for an unknown email and a wrong password.
- No seeded admin and no default admin password. `npm run auth:create-admin` reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from the environment and refuses missing, weak, and well-known passwords.
- Migration `20261018190000_auth_roles_and_sessions` renames the Phase 2 roles and adds `Session` and `PasswordResetToken`.

### Not claimed

- A working database connection or applied migrations
- Delivery of reset email in production until `APP_ORIGIN` and `AUTH_EMAIL_WEBHOOK` are set
- Campaign actions, payments, or social verification

## Phase 4 — Persistent admin panel and social eligibility settings

Status: complete in code. `npm run lint` (0 errors, 0 warnings), `npm run typecheck`, `npm test` (77 tests across 14 test suites), and `npm run build` succeeded.

### Done

- **Persistent Admin Settings Panel**: Built `/admin/eligibility` with live configuration forms for X, Facebook, and Instagram. Settings persist to `SocialPlatformSetting` in PostgreSQL via Prisma.
- **Default Thresholds**: Seeded defaults via migration and store initializer:
  - X: Account created on or before `2022-12-31` OR at least `1000` followers (`FOLLOWERS`).
  - Facebook: At least `50` friends (`FRIENDS`).
  - Instagram: Account created on or before `2022-12-31` OR at least `1000` followers (`FOLLOWERS`).
- **Admin Configuration**:
  - Authorized admins can edit and save all thresholds (cutoff date, audience count, followers vs. friends metric, OR vs. AND combiner) and enable or disable each platform.
  - Server action `saveEligibilityRuleAction` and authenticated API endpoint `PUT /api/admin/eligibility` (with CSRF / cross-origin protection) allow saving individual or bulk threshold updates.
- **Server-Side Eligibility Evaluation (`evaluateEligibility`)**:
  - Supports both `OR` and `AND` clause logic with boundary date and whole-number count enforcement.
  - Generates clear, human-readable pass and failure reasons for each evaluated clause.
  - Handles platform disabled states (`INELIGIBLE`), missing data (`PENDING_VERIFICATION`), and incomplete/unavailable data (`MANUAL_REVIEW`).
- **Never Invent Verification Data**:
  - Live external API calls are decoupled via `ProfileSource`. The default unconfigured profile source returns `unavailable`.
  - Missing profile data is never fabricated, guessed, or mocked; accounts are placed into manual review with null metrics preserved.
- **Manual Review Queue & Actions**:
  - Built `/admin/eligibility/reviews` and API `POST /api/admin/eligibility/reviews` where admins review pending or incomplete submissions.
  - Enforces minimum 10-character review notes. Admin approvals and rejections update `SocialEligibility` and linked `SocialAccount` status without fabricating metrics.
  - Protects admin review decisions from being overwritten by worker re-submissions.
  - Prevents handle collision (`409 Conflict`) across different worker accounts on the same platform.
- **Audit Logging**:
  - All threshold updates and manual review approvals/rejections create immutable `AdminAuditLog` records linking actor ID, action (`eligibility.settings.update`, `eligibility.review.approve`, `eligibility.review.reject`), entity ID, and before/after metadata.
  - Recent audit logs are queryable via `GET /api/admin/eligibility/audit` and rendered directly in the admin panel on `/admin/eligibility`.
- **Worker Eligibility Interface**:
  - Built `/worker/eligibility` allowing workers to submit handles for X, Facebook, and Instagram and view their evaluation status and specific verdict reasons.
- **Role-Based Authorization & Tests**:
  - Added test suites for OR/AND evaluation logic, boundaries, and evidence availability (`src/lib/eligibility/evaluate.test.ts`).
  - Added authorization test suites for role checks across service and HTTP routes (`src/lib/eligibility/authorization.test.ts`).
  - Added service and audit log tests (`src/lib/eligibility/service.test.ts`).
  - Added validation tests for rule schema, partial merges, and handle formatting (`src/lib/eligibility/validation.test.ts`).
  - Total test count expanded from 30 to 77 passing tests.

### Not claimed

- Live production OAuth connections to X, Facebook, and Instagram APIs (system safely routes unverified submissions to manual review without inventing profile metrics).
- Applied migrations against a live remote PostgreSQL database.

## Phase 5 — Campaign creation, budget tracking, task submissions, review queues & OP ledger

Status: complete in code. `npm run db:validate`, `npm run lint` (0 errors, 0 warnings), `npm run typecheck`, `npm test` (95 tests across 19 test suites), and `npm run build` succeeded.

### Done

- **Three Strictly Separated Ledgers**:
  - **Advertiser Funds**: Managed in `Payment` records tracking incoming deposits in minor integer units (cents). Always initialized as `PENDING`; never simulates fake payment success.
  - **Campaign Budgets**: Managed in `CampaignBudgetLedger` tracking signed minor amounts for allocation (`FUND`), reservation (`RESERVE`), release (`RELEASE`), and task payouts (`PAYOUT`).
  - **Worker OP Balances**: Maintained in an append-only `PointsLedger` tracking worker OP tokens (`TASK_REWARD`, `ADJUSTMENT`, `CLAWBACK`), completely decoupled from cash and campaign budgets.
- **Campaign Creation & Moderation**:
  - Advertisers and Admins can create campaigns with custom tasks, platform targets, instructions, slot counts, and reward allocations.
  - Campaigns are created as `DRAFT` and reviewed by Admins before becoming `OPEN`.
  - Admins can pause, resume, or close campaigns.
  - Public campaign marketplace at `/campaigns` and detailed task view with proof submission at `/campaigns/[slug]`.
- **Worker Submissions & Social Eligibility**:
  - Workers can submit proof for active tasks. Requires a valid HTTP/HTTPS `proofUrl` (never claims an action is verified without evidence).
  - Pre-submission verification checks that the worker has an active, verified `SocialAccount` for the required platform.
  - Unique constraint `@@unique([taskId, userId])` prevents workers from submitting duplicate proofs for the same task.
- **Review Queues, Rejection Reasons & Appeals**:
  - Advertisers review submissions for their own campaigns at `/advertiser/reviews`.
  - Rejection requires an explicit reason ($\ge 5$ characters) stored in `rejectionReason`.
  - Workers can track submission status and rejection reasons at `/worker/submissions`.
  - Workers can appeal rejected submissions with a justification ($\ge 10$ characters).
  - Admins and campaign owners can decide appeals at `/admin/submissions`: overturning an appeal transitions status to `APPROVED`, decrements campaign budget, and awards OP points; upholding preserves `REJECTED` status with moderator notes.
- **Concurrency & Database Transactions**:
  - Prisma transactions with atomic checks prevent overspending when multiple concurrent approvals compete for remaining campaign budget.
  - `@unique([submissionId])` constraint in `PointsLedger` guarantees idempotency and prevents double-crediting if a submission is approved concurrently.
  - Task slots are guarded atomically against `slotsTotal`.
- **Dashboards & Worker OP History**:
  - Worker OP balance and immutable points transaction history at `/worker/points`.
  - Advertiser campaign creation, budget summaries, and funding at `/advertiser/campaigns`.
  - Admin campaign moderation and submission oversight at `/admin/campaigns` and `/admin/submissions`.
- **Automated Tests**:
  - Added 5 new test suites in `src/lib/campaigns/`:
    - `budget.test.ts`: budget limits, separate ledgers, and overspend prevention.
    - `concurrency.test.ts`: concurrent approval idempotency and budget race condition handling.
    - `submissions.test.ts`: duplicate submission prevention, slot limits, campaign state checks, and social eligibility requirements.
    - `reviews.test.ts`: mandatory rejection reasons, worker appeal workflows, overturn and uphold decisions.
    - `moderation.test.ts`: role authorization for campaign creation, moderation actions, and campaign-level access isolation.
  - Test suite grew from 77 to 95 tests across 19 test files.

### Not claimed

- Live third-party payment gateway webhooks (e.g. Stripe webhook listener; deposits remain `PENDING` until real completion).
- Automated social media scrapers claiming action verification without evidence (human review and verified proof URLs required).
- Applied migrations against a live remote PostgreSQL database.


## Phase 6 � Fraud detection and security hardening

Status: implemented in code, continued on 2026-10-27 while preserving the existing uncommitted work. Production readiness remains conditional on the deployment checks in `DEPLOYMENT.md`.

### Implemented

- Persistent fraud flags for canonical duplicate proof URLs, cross-account reuse, mismatched domains/handles, and velocity. Historical comparison uses an indexed canonical URL plus a legacy fallback; a batched backfill command is supplied.
- Admin-only, one-time fraud resolutions with required notes, durable resolution fields, transactional audit logging, and a resolved state in the UI.
- Closed arbitrary funding credit creation: public funding actions return a clear unavailable error. Internal funding checks settled payment ownership, currency, remaining credit, and campaign cap in a serializable transaction.
- Serializable production-store transactions for submission/duplicate checks, reviews, appeal decisions, moderation, fraud resolutions, and funding. Conditional appeal transitions, slot constraints, positive money constraints, and unique payout records add database defenses.
- Preserved concurrent admin eligibility decisions inside serializable transactions and added per-IP reset-request limits.
- Closed normal-review appeal bypass and self-review; advertisers cannot decide appeals. Unpublished campaign details require owner/admin access. Social account ownership is checked in both production and test stores.
- Bounded server validation for body bytes, text, URLs, task counts, and PostgreSQL integer ranges. Forged forwarded hosts and cross-scheme origins fail CSRF checks. Protected APIs return no-store and generic internal errors; raw exceptions are not printed by the shared error formatter.
- Service-level mutation limits also cover Server Actions. API guards add per-user limits; limiter maps have bounded capacity and expired-key cleanup. These remain process-local controls.
- Audit records for campaign creation/moderation, submission creation/reviews/appeals, eligibility administration, funding allocation, and fraud resolution; `/api/admin/audit` is admin-gated. Audit query failure is surfaced rather than presented as an empty successful history.
- Added Phase 6 adversarial HTTP/service tests and mocked Prisma transaction contract tests. Existing auth, eligibility, budget, review, and concurrency tests retained.
- Patched the vulnerable production `fast-uri` dependency and updated the development test runner to a patched release.

### Verification

Final validation: `npm run lint` (no errors/warnings), `npm run typecheck`, `npm run db:validate`, `npm test` (167 tests in 24 suites), and `npm run build` all passed. The patched dependency installation reported zero known vulnerabilities. The build needed network access for Google Fonts. The PostgreSQL client emitted an SSL-mode deprecation warning; explicit `sslmode=verify-full` is documented for deployment. Tests are automated unit/service/HTTP and mocked-store tests, not a live production penetration test. PostgreSQL migrations and real concurrency behavior have not been exercised against a dedicated staging database in this task.

### Remaining risks

See `DEPLOYMENT.md`: shared production rate limits and trusted proxy configuration, real payment settlement, provider-backed social verification, migration/data reconciliation, live concurrency rehearsal, admin MFA, audit export/retention, CSP, and independent security review remain required work. Security is not guaranteed.
