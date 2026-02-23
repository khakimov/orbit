# Security Issues

Audit date: 2026-02-23. Backend is currently offline (Firebase backend decommissioned), so backend issues are not actively exploitable but should be fixed before any revival.

## Backend API (`packages/backend/src/`)

### Critical

- **SSRF in attachment ingestion** — `attachments.ts:76` fetches any user-supplied URL with no validation. Can reach GCP metadata endpoint (`169.254.169.254`) to steal service account credentials. Fix: enforce `https:` scheme, block private IP ranges, consider hostname allowlist.

- **Attachment ID path traversal** — `attachments.ts:13-17` uses `attachmentID` in storage path (`attachments/{userID}/{attachmentID}`) without confirmed pattern validation. Verify that `AttachmentID` JSON schema enforces `^[0-9a-zA-Z_\-]{22}$`. If not, add validation.

### High

- **Error objects leaked to client** — `createLoginToken.ts:35` and `refreshSessionCookie.ts:28` send raw error objects via `response.send(error)`, exposing stack traces and Firebase internals. Fix: replace with `response.status(401).send()`.

- **No rate limiting** on any endpoint. Enables brute-force on auth endpoints, storage abuse via attachment uploads, SSRF amplification, and BigQuery cost via `recordPageView` spam. Fix: add `express-rate-limit` middleware.

- **CORS regex bypass** — `corsHandler.ts:7` uses `/\.withorbit.com$/` which matches `evilwithorbit.com` (no left anchor, unescaped dot). Fix: change to `/^https:\/\/[a-z0-9-]+\.withorbit\.com$/`.

- **X-Forwarded-Host trusted blindly** — `api.ts:32-37` rewrites URLs when `x-forwarded-host` header is present. Any client can set this. Fix: restrict to known proxy IPs or remove.

- **Internal API skips all validation** — `api.ts:61-72` has `validateRequest: () => true` with a TODO comment. All `/internal/auth/*` endpoints accept arbitrary bodies. Fix: add schema validation.

- **PATs cannot be revoked or listed** — `firebaseAuth.ts` creates personal access tokens with no revocation or listing mechanism. Once issued, access is permanent until manually deleted from Firestore.

### Medium

- **CSRF on createLoginToken** — `createLoginToken.ts` is a GET endpoint that reads the `__session` cookie (set with `SameSite: none`). A cross-site GET can steal a login token. Fix: convert to POST or add CSRF token.

- **Auth tokens logged** — `api.ts:39-42` uses `morganBody` which logs full request headers including `Authorization`. Tokens appear in Cloud Functions logs. Fix: configure `morganBody` to redact auth headers.

- **No MIME type validation on uploads** — `attachments.ts:20-35` derives MIME type from user-controlled `Content-Type` header or URL extension. No magic byte verification. A user could upload HTML as `image/png`. Fix: validate file content against declared MIME type.

- **recordPageView is unauthenticated** — `api.ts:78` exposes `POST /internal/recordPageView` with no auth. Accepts arbitrary data logged to BigQuery. Fix: add authentication or rate limiting.

- **Public GCS attachments** — `googleCloudFileStorageService.ts:35` stores all files with `public: true`. Anyone with the URL can access them. IDs are random so not guessable, but URLs leak user Firebase UID. Fix: use signed URLs or authenticated access.

- **Remote fetch buffers fully before size check** — `attachments.ts:58-87` downloads entire response into memory before checking the 10MB limit. A multi-GB URL response causes memory exhaustion. Fix: use streaming with size enforcement.

### Low

- **idToken in query params** — `createLoginToken.ts:9` and `refreshSessionCookie.ts:9` accept tokens as query parameters, which appear in logs, browser history, and referrer headers. Fix: move to POST body or Authorization header.

- **No JSON body size limit** — No `express.json({ limit: ... })` middleware. Authenticated users can send arbitrarily large JSON to `/events` or `/tasks/bulkGet`. Fix: add body size limit (e.g. 1MB).

- **Hardcoded emulator salt** — `serviceConfig.ts:24-28` uses `"emulator-session-salt"` when running in emulator mode. If detection logic fails in production, session hashing breaks. Fix: fail closed if config is missing.

---

## Frontend App (`packages/app/src/`)

### Medium

- **postMessage origin check too loose** — `useEmbeddedAuthenticationState.ts:61-64` trusts any `*.withorbit.com` subdomain via `endsWith()`. Also `login.tsx:63-77` has hardcoded `fall-2022-beta.withorbit.com` exception. Fix: use strict `===` origin matching.

### Low

- **import.tsx: afterID not URL-encoded** — Cursor from API response interpolated into URL without `encodeURIComponent()`. Fix: encode it.

- **import.tsx: no pagination cap** — Unbounded `while(true)` loop for event fetching. Fix: add max page count (e.g. 1000).

- **import.tsx: no schema validation on imported events** — Events from API go directly to `putEvents()`. Fix: add lightweight validation.

- **Shared database namespace** — `orbitStoreFactory.web.ts` uses fixed name `"shared.orbitStore"` for all users. No per-user data isolation. Pre-existing TODO in code.
