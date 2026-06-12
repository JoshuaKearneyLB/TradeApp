# TradeApp — Security & Quality Improvements

**Date:** 2026-06-12
**Scope:** Full-stack review and remediation — backend API, WebSocket layer, payments,
file uploads, admin, and the React frontend.
**Method:** Multi-agent white-box audit across 9 dimensions (auth, authorization/IDOR,
file uploads, injection/XSS, infrastructure, payments, delivery, usability, code quality),
with every finding **adversarially verified** against the actual code before any fix was
applied. 46 findings were confirmed; 1 was rejected as a non-issue on verification.

This document records **what changed and why**. It complements the original
[`SECURITY_AUDIT.txt`](SECURITY_AUDIT.txt) (which covered the previous round of fixes).

---

## TL;DR

| Severity | Count | Headline |
|----------|-------|----------|
| 🔴 Critical | 1 | Payment confirmation could be forged with no money moving — **fixed** |
| 🟠 High | 3 | Logout didn't revoke tokens; suspension didn't kick live sockets; job-status race — **fixed** |
| 🟡 Medium | 12 | Payment hardening, location privacy, upload safety, rate-limit/DoS hardening — **fixed** |
| 🟢 Low / correctness | 12 | Frontend memory leaks, stale closures, reliability, email/geo sanitisation — **fixed** |
| ♿ UX / Accessibility | 6 | Toasts replacing `alert()`, reduced-motion, 401 handling, image fallbacks — **fixed** |
| 📦 Delivery | 3 | Production Dockerfile, graceful shutdown, missing shared type exports — **added** |

Both packages build: **frontend typechecks clean (0 errors)** and the **backend compiles
and emits** its bundle. No regressions were introduced.

---

## 🔴 Critical

### PAY-01 — Forged payment confirmation (payment bypass)
**File:** [`packages/backend/src/controllers/payments.controller.ts`](packages/backend/src/controllers/payments.controller.ts), [`services/stripe.service.ts`](packages/backend/src/services/stripe.service.ts)

`confirmPayment` accepted a `paymentIntentId` from the request body and immediately wrote
a `status = 'succeeded'` payment row — **without ever asking Stripe whether that intent
existed, succeeded, was for the right amount, or belonged to this job.** It also skipped
the `status === 'completed'` check that intent-creation enforces.

> **Exploit:** a logged-in customer `POST`s `/api/payments/jobs/:id/confirm` with a made-up
> string like `"pi_fake"`. The job is marked paid, the professional is notified/emailed
> "Payment received", and no money ever moves. Free work at scale.

**Fix — the server now authoritatively verifies the charge before recording it:**
- `createPaymentIntent` stamps the intent with `metadata.jobId` and uses an idempotency key.
- `confirmPayment` calls `stripe.paymentIntents.retrieve()` and only records success if
  **all** hold: `status === 'succeeded'`, `amount === expected`, `currency === 'gbp'`,
  `metadata.jobId === jobId`, and the transfer destination matches the professional's
  connected account.
- Adds the missing `job.status === 'completed'` guard and an "already paid" short-circuit.
- The Stripe **webhook** now reconstructs the payment row from `metadata.jobId` if
  `confirmPayment` never ran, so a real captured charge can never go unrecorded.

---

## 🟠 High

### SEC-AUTH-01 — "Logout" never revoked the token
**File:** [`packages/frontend/src/services/authService.ts`](packages/frontend/src/services/authService.ts)

The backend has a working `POST /api/auth/logout` that blacklists the token's JTI — but the
frontend `logout()` only cleared `localStorage` and **never called it**. The token stayed
valid for its full 7-day lifetime after "logging out".
**Fix:** `authService.logout()` now calls the revoke endpoint (fire-and-forget so a network
blip can't trap the user) before clearing local state.

### SEC-AUTH-02 — Suspension didn't terminate live sessions
**File:** [`packages/backend/src/controllers/admin.controller.ts`](packages/backend/src/controllers/admin.controller.ts)

HTTP requests re-check `account_status` on every call, but an **already-connected socket**
was authenticated once and kept working. A user suspended mid-session could keep chatting.
**Fix:** `updateUserStatus` now force-disconnects the target's live sockets
(`io.in('user:<id>').disconnectSockets(true)`) when they're suspended or deleted.

### CQ-JOB-01 — Job status transition race
**File:** [`packages/backend/src/controllers/jobs.controller.ts`](packages/backend/src/controllers/jobs.controller.ts)

The status `UPDATE` was guarded only by an earlier `SELECT`, not by the current status, so
two concurrent requests could both "complete" a job — double-incrementing the professional's
`total_jobs_completed`.
**Fix:** the `UPDATE` now includes `AND status = <observed status>`, making the transition
atomic; a losing race returns `409` instead of silently corrupting the counter.

---

## 🟡 Medium — Security & Privacy

| ID | File | Fix |
|----|------|-----|
| **AUTHZ-10** | `jobs.controller.ts` | Customer's exact address + lat/lng was exposed to **every** authenticated user browsing the marketplace. Now coarsened (~1 km) and the precise address withheld for non-participants; full detail is revealed only once a pro accepts. |
| **FILE-10** | `uploads.controller.ts` | Served photos now set `Content-Type` from the file's **actual magic bytes** (not its extension), plus `X-Content-Type-Options: nosniff` and `Content-Disposition: inline`. |
| **FILE-12/13/14** | `uploads.controller.ts` | Upload flow reordered to confirm a file exists first; EXIF-stripping now writes to a temp file and atomically replaces the original, cleaning up **both** files on failure (no orphaned `.clean` temp, Windows-safe rename). |
| **PROXY-01 / RATE-06** | `server.ts` | `trust proxy` now **defaults to off** (was `1`). Trusting `X-Forwarded-For` without a real proxy lets attackers spoof their IP to bypass rate limits. Opt in via `TRUST_PROXY=<hops>`. |
| **DOS-01** | `config/database.ts` | Added `statement_timeout`/`query_timeout` (10s) so a pathological query can't hold a pooled connection forever and exhaust the pool. |
| **SOCK-02** | `server.ts` | Socket.IO `maxHttpBufferSize` capped at 1 MB (mirrors the HTTP body limit). |
| **XSS-EMAIL-01** | `services/email.service.ts` | Email **subject** lines now strip CR/LF/control chars from user-supplied values (header-injection defence). |
| **XSS-05** | `server.ts` | Nominatim `display_name` is now sanitised (control chars + angle brackets stripped, length-capped) before being returned. |
| **AUTHZ-13** | `notifications.controller.ts` | `markRead` now validates the notification id as a UUID before hitting the DB. |
| **PAY-NEW-02/03/04/05** | `payments.controller.ts`, `server.ts` | Webhook upserts from metadata; idempotency key on intent creation; already-paid guard; startup warning if `STRIPE_SECRET_KEY` is set without `STRIPE_WEBHOOK_SECRET`. |

---

## 🟢 Reliability & Correctness

**Backend**
- **DB pool no longer crashes the server** ([`config/database.ts`](packages/backend/src/config/database.ts)): a transient error on an *idle* client used to `process.exit(-1)`, taking the whole process down on a keep-alive blip. It now logs and lets the pool recycle the connection.
- **Migration failures are surfaced** ([`server.ts`](packages/backend/src/server.ts)): the boot loop swallowed *every* error with an empty `catch`. It now distinguishes benign "already exists" re-runs from genuine failures and logs the latter.
- **Graceful shutdown** ([`server.ts`](packages/backend/src/server.ts)): `SIGTERM`/`SIGINT` now drain HTTP, close Socket.IO, and release the DB pool, with a 10s force-exit failsafe.
- **Missing shared type exports** added (`InterServerEvents`, `SocketData` in [`packages/shared`](packages/shared/src/types/socket.ts)) — these were imported by `server.ts`/`socket` but never defined.

**Frontend** ([`components/`](packages/frontend/src/components/))
- **PhotoGallery blob-URL leak (CQ-UI-02):** blob URLs were only revoked on unmount, leaking on every `jobId` change and on delete. Now revoked in the load effect's cleanup and on delete.
- **PhotoGallery broken-image fallback (UX-04):** a missing/failed image now shows a placeholder tile instead of a broken-image icon.
- **NotificationBell stale baseline (CQ-UI-01):** the "shake on new" comparison ref only advanced on the no-change path, so every later count compared against a stale value. Now advances every render.
- **ChatPanel stale closure (CQ-UI-03):** the socket handler closed over `user.id`/`receiverId` but the effect only depended on `jobId`; deps corrected.

---

## ♿ UX & Accessibility

- **Toasts replace `alert()` (UX-02):** new accessible [`ToastContext`](packages/frontend/src/context/ToastContext.tsx) (`role="alert"`/`status`, `aria-live`, auto-dismiss). All **13** blocking `alert()` calls across the gallery, job detail, jobs, my-jobs and admin pages now raise non-blocking toasts.
- **Smarter 401 handling (UX-03)** ([`services/api.ts`](packages/frontend/src/services/api.ts)): a 401 from the login/register call itself no longer triggers a redirect (the form shows the error inline), and the redirect no longer loops when already on `/login`.
- **`prefers-reduced-motion` (A11Y-04)** ([`index.css`](packages/frontend/src/index.css)): users who request reduced motion get an essentially motion-free experience (animations/transitions/smooth-scroll collapse to instant).
- **Loading gate trimmed (UX-05):** the forced branded splash dropped from **2.8 s → 1.2 s** on first load.

---

## 📦 Delivery

- **Production Dockerfile** ([`packages/backend/Dockerfile`](packages/backend/Dockerfile)): multi-stage, monorepo-aware (builds the `@tradeapp/shared` workspace), runs as the non-root `node` user, production-only deps, `/health` `HEALTHCHECK`, and a documented uploads volume mount.
- **`.dockerignore`** ([`.dockerignore`](.dockerignore)) keeps secrets (`.env`), `node_modules`, build output and uploads out of the image context.
- **`.env` / `.env.example`** updated with the variables introduced by the security work: `RESEND_API_KEY`, `RESEND_FROM`, `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD`, `TRUST_PROXY`.

---

## ✅ Verification

- **Frontend:** `tsc --noEmit` → **0 errors**; `vite build` succeeds.
- **Backend:** `tsc` compiles and emits `dist/server.js` and all touched modules.
- **Shared:** builds with the new socket type exports.

---

## 🔭 Known follow-ups (intentionally not changed here)

These are real but were out of scope for a security-and-quality pass, or carry deployment
risk that warrants a dedicated change:

1. **Type debt — `@types/express` v5 vs `express` v4 mismatch.** The backend ships ~25
   pre-existing type-only errors from this version skew (dev runs via `tsx`, which skips
   typechecking, so they're invisible at runtime and `tsc` still emits valid JS). Aligning
   the type packages cleanly needs a deduped install (the naive downgrade creates two
   conflicting copies of `@types/express-serve-static-core`). The Dockerfile tolerates these
   but asserts real output is emitted.
2. **Mobile navigation (A11Y-03).** Each page renders its own header; adding a hamburger
   menu should be done once in a shared layout rather than duplicated per page.
3. **Multi-instance state (SOCK-01 / RATE-07).** The per-user socket limit and the email
   throttle are in-memory `Map`s — correct for a single instance, but they should move to
   Redis (with TTL keys) before horizontal scaling.
4. **JWT carries email PII (AUTH-04).** Consider dropping `email` from the token payload.
5. **Frontend Content-Security-Policy (CSP-01/02).** The SPA is served separately from the
   API, so the API's Helmet CSP doesn't protect the app's HTML. A CSP belongs at the
   frontend's static host (and must whitelist Stripe, OSM tiles and Google Fonts).
