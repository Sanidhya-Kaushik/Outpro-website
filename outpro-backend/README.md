# Outpro.India — Backend API

Production-ready REST API for the Outpro.India Corporate Digital Presence Platform.

**Stack:** Node.js 20 · Express · PostgreSQL (Supabase) · TypeScript 5 · JWT + TOTP MFA  
**36 endpoints** across 6 resource groups · Role-based access control · Full audit trail

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Project Structure](#project-structure)
3. [Environment Variables](#environment-variables)
4. [Database Setup](#database-setup)
5. [API Reference](#api-reference)
6. [Authentication](#authentication)
7. [Role Permission Matrix](#role-permission-matrix)
8. [Error Handling](#error-handling)
9. [Security Architecture](#security-architecture)
10. [Testing](#testing)
11. [Deployment](#deployment)
12. [Cron Jobs](#cron-jobs)

---

## Quick Start

### Prerequisites

- Node.js ≥ 20.0.0
- pnpm ≥ 9
- PostgreSQL 16 (or Supabase account)
- Docker + Docker Compose (optional — for local DB)

### Local Development

```bash
# 1. Clone and install
git clone https://github.com/outpro/outpro-india-api.git
cd outpro-india-api
pnpm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local — at minimum set DATABASE_URL and JWT_SECRET

# 3. Start Postgres + Redis via Docker
docker compose up postgres redis -d

# 4. Run migrations
pnpm migrate

# 5. Start dev server with hot reload
pnpm dev
```

The API is now running at `http://localhost:5000/api/v1`.

---

## Project Structure

```
src/
├── config/
│   ├── env.ts           # Zod-validated env — fails fast on startup
│   ├── database.ts      # pg Pool singleton, query(), withTransaction()
│   ├── cron.ts          # Session cleanup, audit purge, scan recovery
│   └── migrate.ts       # SQL migration runner (pnpm migrate)
├── controllers/
│   ├── auth.controller.ts
│   ├── contact.controller.ts
│   ├── portfolio.controller.ts
│   ├── testimonials.controller.ts
│   └── admin.controller.ts
├── middleware/
│   ├── index.ts         # requestId, authenticate, authorise, validate, errorHandler
│   └── rateLimiter.ts   # Upstash Redis sliding-window (falls back to memory)
├── models/
│   └── index.ts         # All data-access functions — parameterised SQL only
├── routes/
│   └── index.ts         # All 36 routes assembled under /api/v1
├── services/
│   ├── email.service.ts # Resend transactional email
│   ├── crm.service.ts   # HubSpot/Zoho with exponential-backoff retry
│   ├── isr.service.ts   # Next.js ISR path mapping
│   └── storage.service.ts # Supabase Storage (upload, promote, delete)
├── types/
│   └── api.types.ts     # Canonical TypeScript types
├── utils/
│   ├── logger.ts        # Winston structured JSON + daily rotation
│   ├── recaptcha.ts     # Google reCAPTCHA v3 server-side verify
│   ├── response.ts      # successResponse(), errorResponse(), AppError, parsePagination()
│   └── sanitise.ts      # DOMPurify HTML stripping, IP redaction, timing-safe compare
├── validators/
│   └── index.ts         # All 14 Zod schemas mirroring API specification
├── __tests__/
│   ├── validators.test.ts          # 40+ unit tests for Zod schemas
│   ├── middleware.test.ts          # requestId, validate, authorise, errorHandler
│   ├── routes.integration.test.ts  # Full endpoint suite with mocked DB
│   └── utils.test.ts               # sanitise, response helpers, AppError factories
├── app.ts               # Express factory — security middleware stack
└── server.ts            # Entry point — graceful shutdown, cron start
migrations/
└── 001_initial_schema.sql  # Complete PostgreSQL schema with RLS
```

---

## Environment Variables

Copy `.env.example` to `.env.local`. All variables are validated on startup via Zod — the process exits immediately if any required variable is missing or malformed.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection URL |
| `JWT_SECRET` | ✅ | Min 64 chars — generate with `openssl rand -hex 64` |
| `RECAPTCHA_SECRET_KEY` | ✅ | Google reCAPTCHA v3 secret |
| `REVALIDATION_SECRET` | ✅ | Min 32 chars — for Sanity ISR webhook |
| `RESEND_API_KEY` | ✅ | Resend transactional email API key |
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (bypasses RLS) |
| `HUBSPOT_API_KEY` | ❌ | CRM sync — skipped if absent |
| `UPSTASH_REDIS_REST_URL` | ❌ | Rate limiting — falls back to in-memory if absent |

---

## Database Setup

### Run migrations

```bash
pnpm migrate
```

The migration runner (`src/config/migrate.ts`) tracks applied versions in `schema_migrations`. Files are applied in alphabetical order — always prefix filenames: `001_`, `002_`, ...

### Schema overview

| Table | Purpose |
|---|---|
| `admin_users` | Admin accounts with bcrypt hash, MFA secret, lockout state |
| `admin_sessions` | JWT JTI revocation tracking |
| `contact_leads` | Inbound contact form submissions |
| `portfolio_projects` | Case study entries with slug, category, view count |
| `testimonials` | Client testimonials with star rating and video URL |
| `media_assets` | Uploaded files with scan status and storage path |
| `audit_log` | Immutable append-only action history |

Row-Level Security (RLS) is enabled on all tables. The API uses the Supabase service role key which bypasses RLS — all access control is enforced at the application layer.

### Seed a super_admin

```bash
# Generate bcrypt hash (rounds=12)
node -e "const b=require('bcrypt');b.hash('YourP@ssw0rd!',12).then(h=>console.log(h))"

# Insert admin user
psql $DATABASE_URL -c "
  INSERT INTO admin_users (email, password_hash, full_name, role)
  VALUES ('you@outpro.india', '<hash>', 'Your Name', 'super_admin');
"
```

---

## API Reference

**Base URL:** `https://www.outpro.india/api/v1`

All responses follow the standard envelope:

```json
// Success
{ "success": true, "data": { ... }, "meta": { "requestId": "uuid", "timestamp": "ISO8601" } }

// Error
{ "success": false, "error": { "code": "ERROR_CODE", "message": "...", "details": [...], "requestId": "uuid", "timestamp": "ISO8601" } }
```

### Endpoint Index

| # | Method | Endpoint | Auth | Description |
|---|---|---|---|---|
| 1 | POST | `/auth/login` | Public | Admin login + TOTP |
| 2 | POST | `/auth/logout` | JWT | Logout + revoke session |
| 3 | GET | `/auth/me` | JWT | Get current user profile |
| 4 | PATCH | `/auth/password` | JWT | Change password |
| 5 | POST | `/auth/mfa/setup` | JWT | Generate MFA QR code |
| 6 | POST | `/auth/mfa/verify` | JWT | Enable MFA |
| 7 | POST | `/contact` | Public + reCAPTCHA | Submit contact form |
| 8 | GET | `/contact/leads` | JWT | List leads (paginated) |
| 9 | GET | `/contact/leads/stats` | JWT | Lead statistics |
| 10 | GET | `/contact/leads/:id` | JWT | Get single lead |
| 11 | PATCH | `/contact/leads/:id` | JWT editor+ | Update lead status |
| 12 | DELETE | `/contact/leads/:id` | JWT super_admin | Delete lead |
| 13 | GET | `/portfolio` | Public | List portfolio projects |
| 14 | GET | `/portfolio/categories` | Public | Category counts |
| 15 | GET | `/portfolio/:slug` | Public | Get project by slug |
| 16 | POST | `/portfolio` | JWT editor+ | Create project |
| 17 | PATCH | `/portfolio/:id` | JWT editor+ | Update project |
| 18 | DELETE | `/portfolio/:id` | JWT super_admin | Delete project |
| 19 | POST | `/portfolio/revalidate` | Webhook secret | Trigger Next.js ISR |
| 20 | GET | `/testimonials` | Public | List testimonials |
| 21 | GET | `/testimonials/stats` | JWT | Testimonial statistics |
| 22 | GET | `/testimonials/:id` | Public | Get testimonial |
| 23 | POST | `/testimonials` | JWT editor+ | Create testimonial |
| 24 | PATCH | `/testimonials/reorder` | JWT editor+ | Batch reorder carousel |
| 25 | PATCH | `/testimonials/:id` | JWT editor+ | Update testimonial |
| 26 | DELETE | `/testimonials/:id` | JWT super_admin | Delete testimonial |
| 27 | GET | `/admin/dashboard` | JWT | KPI summary |
| 28 | GET | `/admin/users` | JWT super_admin | List admin users |
| 29 | POST | `/admin/users` | JWT super_admin | Create admin user |
| 30 | PATCH | `/admin/users/:id` | JWT super_admin | Update admin user |
| 31 | DELETE | `/admin/users/:id` | JWT super_admin | Delete admin user |
| 32 | GET | `/admin/audit-log` | JWT | View audit trail |
| 33 | POST | `/admin/media` | JWT editor+ | Upload media asset |
| 34 | GET | `/admin/media` | JWT | List media assets |
| 35 | DELETE | `/admin/media/:id` | JWT super_admin | Delete media asset |
| 36 | GET | `/health` | Public | Uptime health probe |

---

## Authentication

### Login flow

```
POST /api/v1/auth/login
{ "email": "arjun@outpro.india", "password": "...", "totpCode": "123456" }

→ 200 OK
  Set-Cookie: session=<JWT>; HttpOnly; Secure; SameSite=Strict; Max-Age=28800
  Body: { "data": { "token": "<JWT>", "expiresAt": "...", "user": { ... } } }
```

Tokens are stored in an **HttpOnly cookie** (`session`). The Bearer token in the response body is provided for API clients that cannot use cookies. Subsequent requests should send the cookie automatically (browser) or include `Authorization: Bearer <token>`.

### Brute-force protection

- Failed attempts are tracked per account
- After 5 failures: account locked with **exponential backoff** (`2^(attempts-4)` minutes, max 60 min)
- Lock resets on successful login
- All auth endpoints are rate-limited to **10 req/min per IP**

### MFA setup

```bash
# 1. Generate secret + QR code
POST /api/v1/auth/mfa/setup
→ { "qrCode": "data:image/png;base64,...", "manualKey": "JBSWY3DPEHPK3PXP" }

# 2. Scan QR with Google Authenticator, then verify
POST /api/v1/auth/mfa/verify
{ "totpCode": "123456" }
→ { "message": "MFA enabled successfully." }
```

---

## Role Permission Matrix

| Capability | super_admin | editor | viewer |
|---|---|---|---|
| Login / logout / profile | ✅ | ✅ | ✅ |
| View leads | ✅ | ✅ | ✅ (read only) |
| Update lead status | ✅ | ✅ | ❌ |
| Delete leads | ✅ | ❌ | ❌ |
| Create/update portfolio | ✅ | ✅ | ❌ |
| Delete portfolio | ✅ | ❌ | ❌ |
| Create/update testimonials | ✅ | ✅ | ❌ |
| Delete testimonials | ✅ | ❌ | ❌ |
| Upload media | ✅ | ✅ | ❌ |
| Delete media | ✅ | ❌ | ❌ |
| Manage admin users | ✅ | ❌ | ❌ |
| View audit log | ✅ (full IPs) | ✅ (redacted IPs) | ✅ (redacted IPs) |
| View dashboard KPIs | ✅ | ✅ | ✅ |

---

## Error Handling

### HTTP Status Codes

| Code | Meaning |
|---|---|
| 200 | OK — successful GET or PATCH |
| 201 | Created — successful POST |
| 204 | No Content — successful DELETE |
| 400 | Bad Request — business rule violation |
| 401 | Unauthorized — missing or invalid JWT |
| 403 | Forbidden — valid JWT but insufficient role |
| 404 | Not Found — resource doesn't exist |
| 409 | Conflict — duplicate resource |
| 422 | Unprocessable Entity — Zod validation failed |
| 429 | Too Many Requests — rate limit exceeded |
| 500 | Internal Server Error — unhandled error |

### Error codes

Notable application-level codes in `error.code`:

- `INVALID_CREDENTIALS` — wrong email or password
- `INVALID_TOTP` — wrong or expired 6-digit code
- `ACCOUNT_LOCKED` — brute-force lockout active
- `ACCOUNT_INACTIVE` — `is_active = false`
- `SESSION_EXPIRED` — JWT or session past expiry
- `SESSION_REVOKED` — JWT revoked in `admin_sessions`
- `MFA_REQUIRED` — account has MFA but no TOTP code was sent
- `CAPTCHA_FAILED` — reCAPTCHA score below threshold
- `LAST_SUPER_ADMIN` — attempt to demote/delete the only super_admin
- `SELF_DELETE` — admin attempting to delete own account
- `RATE_LIMIT_EXCEEDED` — sliding-window limit hit

---

## Security Architecture

### Defence in depth

```
Layer 0 — Network  : Cloudflare WAF + DDoS + bot management
Layer 1 — Transport: TLS 1.3, HSTS (max-age=31536000; preload)
Layer 2 — App      : Helmet CSP, XSS sanitisation (DOMPurify), no SQL injection (parameterised)
Layer 3 — Auth     : JWT HS256 + HttpOnly cookie + per-JTI revocation + TOTP MFA
Layer 4 — API      : Rate limiting (Upstash Redis), reCAPTCHA v3, Zod input validation
Layer 5 — Data     : Supabase RLS, encryption at rest (AES-256), IP masking in audit log
Layer 6 — Infra    : env secrets, no hardcoded credentials, pnpm audit in CI
```

### Key security decisions

**No SQL injection** — every DB call uses `pg` parameterised queries. String interpolation in SQL is explicitly prohibited and caught in ESLint.

**No XSS** — all user input passes through `sanitiseString()` (DOMPurify, no allowed tags) before reaching the database.

**No timing attacks** — login uses a constant 300ms delay regardless of whether the user exists. Password comparison uses bcrypt's constant-time compare. Secret comparison uses `timingSafeEqual()`.

**No enumeration** — login returns the same 401 INVALID_CREDENTIALS whether the email doesn't exist or the password is wrong.

**Session revocation** — every JWT carries a `jti` (UUID v4). On logout or password change, the JTI is marked `revoked = TRUE` in `admin_sessions`. The `authenticate` middleware checks revocation on every request.

**File upload security** — MIME type is validated against a whitelist using the `file-type` library which reads magic bytes, not the file extension. Max sizes: 10 MB images, 50 MB videos.

---

## Testing

```bash
# Run all tests
pnpm test

# Run with coverage report
pnpm test:coverage

# Run a specific test file
pnpm test src/__tests__/validators.test.ts

# Watch mode
pnpm test --watch
```

### Test architecture

Tests are split into three layers:

1. **Unit tests** (`validators.test.ts`, `utils.test.ts`) — pure function tests, zero I/O, no mocks needed.
2. **Middleware tests** (`middleware.test.ts`) — mock `database`, `logger`, and `env`; test middleware in isolation.
3. **Integration tests** (`routes.integration.test.ts`) — spin up the full Express app with all middleware; mock `database.query` and external services at the module boundary.

Coverage thresholds (enforced in CI): lines 70%, functions 70%, branches 65%.

---

## Deployment

### Docker

```bash
# Build production image
docker build --target runner -t outpro-india-api:latest .

# Run
docker run -p 5000:5000 --env-file .env.production outpro-india-api:latest
```

### CI/CD

The GitHub Actions pipeline (`.github/workflows/ci.yml`) runs on every push and PR:

1. **Lint + Typecheck** — ESLint strict + `tsc --noEmit`
2. **Security Audit** — `pnpm audit --audit-level=critical` (blocks merge on critical CVEs)
3. **Tests** — Vitest with coverage upload to Actions artifacts
4. **Build** — `tsc` and dist verification
5. **Docker** — image build + Docker Scout CVE scan (main branch only)

### Vercel (serverless)

If deploying as Vercel serverless functions, wrap `createApp()` in a Vercel handler. The stateless pg Pool works natively with PgBouncer in transaction mode (Supabase default).

---

## Cron Jobs

Three maintenance jobs run inside the API process (`src/config/cron.ts`):

| Job | Schedule | Action |
|---|---|---|
| Session cleanup | 02:00 UTC daily | Deletes revoked and expired sessions from `admin_sessions` |
| Audit log purge | 03:00 UTC monthly | Removes `audit_log` entries older than 2 years |
| Stuck scan recovery | Every 6 hours | Marks media assets pending scan > 24h as `error` |

To move jobs out of process, extract the SQL queries into a separate worker or Cloud Scheduler function and point it at the same `DATABASE_URL`.

---

## Contributing

1. Branch from `develop`
2. Run `pnpm lint && pnpm typecheck && pnpm test` before pushing
3. Keep test coverage above thresholds
4. Never commit `.env.local` or real secrets
5. All SQL must use parameterised queries — PRs with string interpolation will be rejected

---

## License

Proprietary — Outpro.India © 2026. All rights reserved.
