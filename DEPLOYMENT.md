# Deployment

Phase 6 is implemented in code. This work did not deploy the app or apply migrations to a live database. Passing local checks does not guarantee security.

## Runtime and configuration

Use Node.js 24 LTS and PostgreSQL. Install from the committed lockfile with `npm ci`. Build tools require development dependencies during the build; production runtime can omit them afterward. The app currently downloads Geist/Syne fonts during the build, so the builder needs HTTPS access to Google Fonts (or supply licensed local fonts).

Set these through your hosting secret manager:

- `DATABASE_URL`: real PostgreSQL credentials with TLS certificate verification; prefer explicit `sslmode=verify-full` with the required CA configuration. Do not disable certificate validation.
- `DIRECT_URL`: optional direct migration connection when the runtime URL uses a pooler. Give migration credentials only to the release job.
- `APP_ORIGIN`: the exact public HTTPS origin, with no path. Required for reset links and consistent origin validation behind a proxy.
- `AUTH_EMAIL_WEBHOOK`: trusted HTTPS reset email delivery endpoint. Reset links are credentials; restrict access and logs at the recipient.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`: temporary bootstrap input for `npm run auth:create-admin`; remove these after provisioning. There is no default admin account.

Never expose secrets using `NEXT_PUBLIC_` variables. Keep `.env` files out of version control and artifacts. No real credentials were identified in the nonignored source scan; ignored files, Git history, hosting logs, and prior exposures require separate review and rotation where appropriate.

## Release procedure

1. Back up the database and rehearse restoration and all migrations on a staging copy. Stop writes during migration/backfill. Reconcile existing fabricated/unbacked FUND rows, overfilled slots, invalid amounts, and duplicate payouts before enabling this release; new constraints intentionally fail on invalid legacy data.
2. Run `npm ci`, `npm run db:validate`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` using the release environment. Run `npm audit` and assess new advisories; an empty audit is not a security assessment.
3. Run `npx prisma migrate deploy`. Phase 6 adds canonical proof keys/indexes, fraud resolution fields, financial/slot CHECK constraints, and a partial unique payout index. Review SQL before applying it. Prisma schema validation alone does not execute or verify these SQL constraints.
4. Run `npm run security:backfill-proofs` and `npm run db:health`. The backfill runs in batches and can be rerun. Do not print connection strings or proof/reset URLs into operational logs. Legacy null keys remain checked until backfill completes and can make queries expensive on large histories.
5. Provision an admin if needed, then run `npm start` behind HTTPS. Test worker, advertiser, admin, suspended, expired-session, and anonymous access using separate accounts. Verify owner isolation, unpublished campaign visibility, cross-origin rejection, private cache behavior, fraud resolution, audit availability, and password reset single use.
6. On a dedicated staging database, test simultaneous last-slot approvals, competing budget approvals, duplicate proofs, replayed fraud decisions, payment allocation replay, and audit-write failures. Confirm rollback leaves no partial points/budget/state changes. Unit/mock tests do not replace this check. Serializable transaction conflicts can return retryable failures; clients must refresh before retrying.

## Funding and verification

Public funding API/form actions remain disabled with HTTP 409 until a trusted payment settlement integration exists. Do not bypass this by inserting budget credit. A future integration must validate webhook signatures, amount/currency/owner, payment finality, replay/idempotency, refunds/chargebacks, and cumulative allocation in one transaction. Pending payments must never fund rewards. OP is a separate points ledger, not a cash wallet; no withdrawal or cash settlement service is implemented.

Social providers are unconfigured and route missing evidence to manual review. Flags are heuristic review signals. Duplicate canonicalization is not exhaustive across platform aliases, redirects, changed handles, or equivalent post representations. Reviewers must verify evidence and ownership; a matching URL/handle is not proof of completed work.

## Operational controls and remaining risks

- Rate limits are bounded **in-process** maps. They reset on cold starts/redeploys and multiply across instances. Before public launch, add a shared gateway/Redis limiter covering authentication, reset requests, all API mutations, and Server Action POSTs, plus body-size and connection limits. Do not expose the app server directly; overwrite client-supplied forwarded-IP/host headers at the trusted proxy. An IP is not an identity.
- Enable admin MFA via a trusted identity layer or implement it before handling real value. Email verification is not enforced. Registration responses can reveal an already registered email. Account farms, distributed attacks, and social ownership fraud remain possible.
- Apply least-privilege database permissions. The runtime must not update/delete audit rows; SQL administrators can still alter them. Export audit events to an access-controlled external append-only retention system. Define retention, incident response, and alerts for flags, failures, login abuse, and audit outages. Audit metadata and proof URLs can contain personal data; restrict access.
- Baseline nosniff, frame denial, referrer, and permissions headers are configured. Configure HSTS at the HTTPS edge and deploy a tested CSP compatible with Next.js streaming/hydration. A strict CSP is not included in this phase.
- Keep backups, dependency updates, secret rotation, and an independent security assessment scheduled operationally. Review development tooling advisories as well as runtime packages. Tests currently use in-memory stores and mocked Prisma calls; live PostgreSQL rollback, migration, load, browser workflows, third-party providers, and production infrastructure need separate verification.
- Auditing is focused on business mutations. Comprehensive authentication/security event export and tamper-resistant storage are not implemented. Database failures must not be interpreted as evidence that there are no incidents.

## Rollback

Prefer a forward repair. Keep a verified database backup and previous application artifact. If rollback is necessary, stop writes, restore the tested compatible application/database pair, and reconcile financial/audit records before resuming. Do not delete ledger or audit history to make a migration pass.
