# Security review

Review date: 2026-10-15. Scope: `src/server/identity.ts`, `src/server/request.ts`, API handlers for game/finance/AI, server storage boundaries, domain action validation, and focused route tests. This is a code review with mocked storage/providers; it is not a production penetration test or live Neon/Vercel verification.

## Verified controls

- Production requests cannot use the local-player shortcut: `isLocalDevelopment()` requires `LOCAL_DEV_MODE=true`, a nonproduction `NODE_ENV`, and no `VERCEL` marker. Google sign-in was removed at the user’s request. Production uses a random 32-byte token in an HttpOnly, SameSite=Lax, Secure cookie with a one-year lifetime; the owner id is SHA-256 of the guest-prefixed token. Missing/invalid cookies create a new guest; valid cookies persist the owner. No OAuth configuration is required.
- Mutating game, finance, and AI routes require a same-origin `Origin` equal to the request URL origin. The route tests cover missing and cross-origin requests, valid persistent guest cookies, malformed cookies, and browser identity separation.
- Request bodies are bounded by actual UTF-8 bytes through `readJSON`; a claimed small `Content-Length` cannot bypass the limit. Malformed JSON is a 400, oversized data is a 413, and chunked streams are cancelled after the cap. Game commands allow up to 1,000,000 bytes so the supported three-floor plan fits; finance and AI retain their narrower limits. A real local API/store regression saves 768 floor cells with stairs, ceilings and roof in a body larger than 64 KB.
- Game commands pass only the authenticated user id to `gameCommand` and are validated by a strict discriminated union. Unknown operations such as `boss.attack`, `gold.set`, `reward.claim`, `finance.update`, and `item.grant` are rejected. The domain checks aggregate ownership before applying actions; reward/damage/state fields supplied beside an action are rejected rather than trusted.
- Finance commands use strict schemas, safe integer money, account ownership checks, idempotency keys, and a separate finance aggregate. Tests verify duplicate retries do not duplicate a transaction and that finance routes never call game mutation storage. Finance is not supplied to the AI request path.
- AI output is strict-schema validated; proposal approval is compare-and-set guarded and applies through a stable idempotent game command. Forbidden operations and production demo mode are rejected. Remote provider requests are server-only, bounded, HTTPS-only, DNS-checked, nonredirecting, timeout-limited, and error-redacted.
- API responses use private/no-store caching where state is returned. Secrets are not sent to the browser by the audited routes.

## Tests

`npx vitest run tests/api.integration.test.ts tests/ai` previously passed **94 tests** before the guest-session change. Current guest-session/API results are recorded in TEST_REPORT.md. These tests cover identity bypasses, guest isolation, origin checks, body byte limits, malformed/chunked JSON, client-authoritative game tampering, ownership failures, finance isolation/idempotency, AI forbidden fields/operations, provider endpoint safety, retry/timeout behavior, and approval races.

`npm run typecheck` and focused ESLint passed during this review. The suite uses mocked authentication, storage, and provider transport where needed; it does not prove live deployed guest-session behavior, Neon row locking, Vercel runtime behavior, browser behavior, or a real AI endpoint.

Store follow-up: `npx vitest run tests/server-store` passes **15 tests**. Eleven use real filesystem persistence in isolated OS temporary directories selected by `LOCAL_DATA_DIR` (honored only in explicit local development), covering concurrent completion/purchase/craft, CAS approval, current-state retries, no-op reads/reconciliation, finance failure rollback, and overdue penalties surviving a failed action. Four use a transactional Postgres double to exercise row-lock ordering, atomic state/receipt commit, rollback on receipt failure, and current-state replay. This double does not validate real database locks or migrations. The existing user's `.local-data` was not used by these tests.

## Residual risks and follow-up

- The in-memory AI request limiter is per process. It reduces accidental duplicate work for one instance but is not a distributed Vercel rate limit. Add a shared limiter (for example, a transactional database counter or managed edge limiter) before enabling paid AI with accountless public access. New guest cookies can bypass per-user limits, so abuse controls must also cover aggregate usage.
- Production Postgres migration, transaction locking, and backup/restore need a live isolated database test. The local JSON store is a development convenience and must not be treated as production durability.
- CSRF protection currently relies on strict same-origin checks; deployment must keep the canonical origin stable and validate proxy origin handling.
- The AI endpoint DNS check and pinned connection are source-level controls; certificate validation, provider policy, quota, and actual model behavior require a live configured endpoint test.
- Visual browser checks, accessibility, dependency audit, guest-session expiry/recovery behavior, and operational logging review remain outstanding.
- The source currently exposes 24 persistent navigation screens plus Welcome and Character Creation overlays. This is partial coverage against the specification's 26-screen acceptance list; route presence is not feature completion. See `FEATURE_MATRIX.md`.

## Findings addressed during the review

1. **Stale idempotent replay snapshots:** command retries previously returned their original entire game snapshot. The store now retains command events/message and attaches current game state on replay, avoiding a client rollback to old state. Source reviewed; live database retry consistency remains unverified.
2. **Unbounded parsing and malformed JSON handling:** game trusted `Content-Length`; finance/AI read full text before checking character length. All three now share the byte-bounded streaming reader, and 13 focused reader/route tests cover actual bytes, forged headers, chunk cancellation and malformed payloads.
3. **Proposal upsert ownership:** the production conflict update now includes a user-ownership condition, so a conflicting proposal id cannot update another user's record. Source reviewed; live database enforcement remains unverified.
4. **Growing reconciliation replay records:** GET is read-only; explicit reconciliation no longer writes an idempotency entry or repeats a no-op state write. Existing local-save reads also no longer rewrite the file. Normal mutation command receipts remain durable. Verified with isolated local store tests; long-run storage growth requires operational monitoring.

