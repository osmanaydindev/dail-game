# CLAUDE.md — dail-game Project Source of Truth

## Project Overview

**dail-game** is a web app where users submit their daily Wordle and Parolla results.
It shows daily, weekly, and monthly leaderboards with normalized combined scoring.

## Tech Stack

| Layer      | Technology                                    |
|------------|-----------------------------------------------|
| Frontend   | Next.js 15 (App Router)                       |
| UI         | Chakra UI v3                                  |
| Backend    | Node.js 22 + Express 4                        |
| Database   | MongoDB 7 + Mongoose 8                        |
| Auth       | JWT (access) + httpOnly cookie (refresh)      |
| i18n       | next-intl v4 — `[locale]` App Router routing  |
| Color mode | next-themes (Chakra UI v3 uyumu için)         |
| Deployment | Self-hosted VPS (Docker Compose / PM2)        |

## Repository Structure

```
dail-game/
├── apps/
│   ├── frontend/
│   │   └── src/
│   │       ├── app/
│   │       │   ├── layout.tsx          # Root shell (minimal, no providers)
│   │       │   └── [locale]/           # Tüm sayfalar burada
│   │       │       ├── layout.tsx      # Providers + NextIntlClientProvider
│   │       │       ├── page.tsx
│   │       │       ├── login/
│   │       │       ├── leaderboard/
│   │       │       ├── history/
│   │       │       ├── games/
│   │       │       ├── entry/
│   │       │       ├── profile/
│   │       │       └── admin/
│   │       ├── components/
│   │       ├── i18n/
│   │       │   ├── routing.ts          # locales: ['en','tr'], prefix: as-needed
│   │       │   └── request.ts          # getRequestConfig
│   │       ├── lib/
│   │       │   ├── api.ts              # Axios client + token interceptor
│   │       │   └── navigation.ts       # createNavigation (next-intl)
│   │       ├── messages/
│   │       │   ├── en.json
│   │       │   └── tr.json
│   │       ├── middleware.ts           # next-intl middleware
│   │       ├── providers/
│   │       │   ├── AuthProvider.tsx
│   │       │   └── ChakraProvider.tsx  # useColorMode buradan export edilir
│   │       └── store/
│   │           └── authStore.ts
│   └── backend/
│       └── src/
│           ├── config/                 # env, db, gameConfig
│           ├── controllers/
│           ├── middleware/
│           ├── models/
│           ├── routes/
│           ├── services/
│           ├── utils/
│           └── validation/
├── packages/
│   └── types/                          # Shared TypeScript types
├── ecosystem.config.js
├── docker-compose.yml
├── CLAUDE.md
├── README.md
└── .env.example
```

## Architecture Decisions

### Monorepo
Single git repo, two deployable apps. Frontend and backend deploy separately on VPS.
Shared types package avoids type drift between client and server.

### Timezone Strategy
- All "daily" records are keyed to a **UTC date string** (`YYYY-MM-DD`).
- The server derives today's UTC date from `new Date().toISOString().slice(0, 10)`.
- Leaderboards are per UTC day. This is simple, consistent, and documented here.
- Future improvement: allow per-user timezone preference for display purposes only.

### i18n Mimarisi
- next-intl v4 + App Router entegrasyonu kullanılıyor.
- Sayfalar `src/app/[locale]/` altında — middleware locale'i URL'den okur.
- URL stratejisi: `localePrefix: 'as-needed'` → `/` (İngilizce, prefix yok), `/tr/` (Türkçe).
- `src/lib/navigation.ts` — `createNavigation(routing)` ile locale-aware `Link`, `useRouter`, `usePathname` export edilir. Tüm bileşenler `next/navigation` yerine buradan import eder.
- Dil değiştirme: `router.replace(pathname, { locale: 'tr' })` — URL'yi yeniden yazmadan locale cookie'sini günceller.
- Mevcut diller: `en` (varsayılan), `tr`. Yeni dil eklemek için: `routing.ts`'e ekle + `messages/<locale>.json` oluştur.

### Color Mode (Chakra UI v3)
- Chakra UI v3, color mode için `next-themes` gerektirir — kendi `useColorMode` hook'u v3'te plugin bağımsız çalışmaz.
- `src/providers/ChakraProvider.tsx` içinde `ThemeProvider` (next-themes) sarılmış ve `useColorMode` hook'u buradan export edilir.
- Bileşenler `@chakra-ui/react`'ten değil, `@/providers/ChakraProvider`'dan import eder.
- `optimizePackageImports: ['@chakra-ui/react']` Chakra ile uyumsuz — next.config.ts'de kullanılmıyor.

### Avatar Strategy (v1)
- URL-based only — users paste an image URL.
- No file uploads in v1. Eliminates upload attack surface.
- Avatar URL is validated to be a valid HTTPS URL before saving.

### Game Extensibility
- Games are defined in a `Game` collection (DB) and a `GAME_CONFIG` map (backend).
- Each game config specifies: `scoreFields`, `normalizer` function, `officialUrl`.
- Adding a new game = insert DB record + add config entry. No core logic changes.

---

## Scoring System

### Goal
Weighted (Wordle 40 / Parolla 60) combination of Wordle and Parolla scores into a single daily score.
Parolla carries more weight because it is the longer and harder game (5 minutes, 26 letters).

### Wordle Normalization
Wordle raw score = attempt number (1–6). Lower is better. DNF = 7 (worst).

```
wordle_normalized = (7 - attempt) / 6
```

| Attempt | Normalized |
|---------|-----------|
| 1       | 1.000     |
| 2       | 0.833     |
| 3       | 0.667     |
| 4       | 0.500     |
| 5       | 0.333     |
| 6       | 0.167     |
| DNF     | 0.000     |

### Parolla Normalization
Parolla raw scores: `correct`, `wrong`, `blank` (26 letters of the Turkish alphabet).
Wrong answers are penalized: every 3 wrong answers cancel out 1 correct.

```
effective = max(0, correct - wrong / 3)
parolla_normalized = effective / 26
```

Range: [0.0, 1.0]. Higher = better.

### Combined Daily Score

```
daily_score = (wordle_normalized × 0.4) + (parolla_normalized × 0.6)
```

Weights live in a single place — `SCORE_WEIGHTS` in `apps/backend/src/config/gameConfig.ts`.
Range: [0.0, 1.0]. Used for the **total daily leaderboard**.

### Leaderboard Ranking
- Per-game leaderboards use the game's own normalized score.
- Total leaderboard uses `daily_score`.
- Ties are broken by entry `createdAt` (earlier submission wins).
- If a user submits only one game, they receive 0 for the missing game in the total score.
- **Weekly/monthly total** rebuilds each day's weighted `daily_score` first, then averages
  across days — so it ranks on the same scale as the daily leaderboard. The per-game
  weekly/monthly tabs average that game's own normalized scores directly.

### Justification
Linear normalization maps each game's raw scores to [0,1].
Wordle's ordinal scale (1–6 attempts) maps cleanly to a linear progression.
Parolla's penalized ratio score is naturally [0,1].
Neither formula requires external calibration or historical data.

---

## Data Models

### User
```
_id, email, username, displayName, passwordHash, role (admin|user),
avatarUrl, isActive, emailVerified, createdAt, updatedAt, createdBy (admin userId)
```

### VerificationToken
```
_id, userId, tokenHash (sha256), expiresAt (TTL index), usedAt, createdAt
```

### PasswordResetToken
```
_id, userId, tokenHash (sha256), expiresAt (TTL index), usedAt, requestedIp, createdAt
```

### Game
```
_id, slug (wordle|parolla), name, officialUrl,
scoreFields: [{name, type, label}], isActive, createdAt, updatedAt
```

### DailyEntry
```
_id, userId, gameId, date (YYYY-MM-DD UTC), scores: {}, 
normalizedScore, createdAt, updatedAt, updatedBy
unique index: (userId, gameId, date)
```

### RefreshToken
```
_id, userId, tokenHash, expiresAt, createdAt, revokedAt, userAgent, ip
```

---

## Registration & Email Verification

Registration is **open to the public**. Admin approval is not required — a verified
email address is the only gate.

```
POST /auth/register  →  User{emailVerified:false} + VerificationToken (sha256, 24h TTL)
                     →  verification mail
      ↓  user clicks the link
POST /auth/verify-email {token}  →  emailVerified:true + issueTokens (auto-login)
```

- `POST /auth/login` returns **403 with `error: "EMAIL_NOT_VERIFIED"`** for unverified
  accounts — but only *after* the password check, so the response can't be used to
  enumerate registered addresses. The frontend keys off that exact string to show a
  "resend verification mail" button.
- Registration never reveals whether an email is taken (it returns the same 201 and
  quietly re-sends the verification mail if the existing account is unverified).
  Usernames *are* public, so username collisions do return 409.
- `registerSchema` deliberately has no `role` field — self-registration always yields
  `role: 'user'`.
- `issueVerificationToken` invalidates outstanding tokens, so requesting a new mail
  kills the old link. Tokens are single-use (`usedAt`) and expire via a Mongo TTL index.
- Accounts created by an admin or the seed script get `emailVerified: true`. The seed
  also backfills `emailVerified: true` on any user document that predates this field —
  run `npm run seed` once after deploying, or existing users are locked out.

### Password Reset

```
POST /auth/forgot-password  →  PasswordResetToken (sha256, 1h TTL) → reset mail
POST /auth/reset-password   →  new password + EVERY refresh token revoked
```

- Deliberately a **separate collection** from `VerificationToken`: a token minted
  to confirm an address must never be usable to change a password, and separate
  collections enforce that by construction rather than by remembering to filter.
- 1 hour TTL, not 24 — a reset link is a live key to the account.
- Reset **revokes every refresh token** for the user. If the reset was triggered
  because someone else got in, this is what actually kicks them out. The reset
  does not log the user in; they sign in again with the new password.
- A successful reset also sets `emailVerified` — reading the inbox proves ownership.
- Refuses to reuse the current password (`SAME_PASSWORD`), and leaves the token
  unspent in that case so the user can retry.
- Unverified accounts get the *verification* mail instead of a reset link —
  sending a reset link to an address nobody has proven they own hands over the
  account.
- `forgot-password` and `reset-password` have their **own** rate limiter
  instance. Sharing one with registration would mean a burst of signup attempts
  locks a user out of password recovery, which is exactly when they need it.
- Per-account 60s cooldown in `issuePasswordResetToken` on top of the per-IP
  limit, so an attacker rotating IPs still cannot flood one victim's inbox.

### Anti-Enumeration & Timing

Every endpoint that takes an email address returns an identical body whether or
not the account exists. That is not enough on its own — the *work* differs, and
the difference is measurable:

- `register` hashes the password **before** the existence check. bcrypt costs
  ~250ms, so hashing only for new accounts would make "email already taken"
  answer far faster than "account created", even though both return 201.
- `login` calls `burnPasswordComparison` when no user is found, so "no such
  account" and "wrong password" both cost a bcrypt compare (~285ms each).
- `forgot-password` and `resend-verification` pad their response to a 150ms
  floor via `utils/timing.ts`, and fire the mail without awaiting it, so the
  response time depends on neither the DB hit nor the SMTP relay.

Measured before/after on `forgot-password`: 11ms vs 3ms → 154ms vs 155ms.

### Mail Delivery (free, without landing in spam)

`services/mail.service.ts` talks plain SMTP through nodemailer, so the provider is a
pure `.env` concern. Default target is **Resend** (free tier: 3000/month, 100/day).
When `SMTP_HOST` is unset the verification link is logged to the console instead of
sent — that is the local-development path.

Deliverability rules baked into the sender:
- Both `text/plain` and `text/html` bodies (HTML-only mail scores as spam on its own).
- One CTA, inline CSS, no images, no tracking pixel, no link shortener.
- `MAIL_REPLY_TO` should be a real, monitored mailbox.

DNS records Resend asks for (names are relative to the apex zone; copy the exact
values out of the dashboard — they are truncated in the table view):

| Record | Name | Purpose |
|--------|------|---------|
| `TXT` | `resend._domainkey.send` | DKIM signature |
| `CNAME` | `rsend.send` | SPF / return-path (Resend delegates it, no TXT SPF record) |
| `CNAME` | `send.send` | SPF / return-path |
| `TXT` | `_dmarc` | `v=DMARC1; p=none;` — optional, and it lands on the **apex** domain, so skip it if one already exists |

"Enable Receiving" stays off — this app only sends, so no MX record is needed.
The verified domain is `send.<domain>`, and `MAIL_FROM` must use an address on it
(`noreply@send.<domain>`) or Resend rejects the send. Sending from the subdomain
keeps the apex domain's reputation isolated.
Verify with Gmail's "Show original" (SPF/DKIM/DMARC must all read `PASS`) and
mail-tester.com (target ≥ 9/10). Switching to Brevo, Zoho or a self-hosted Postfix is
an `.env` change plus that provider's DNS records — no code change.

---

## Auth / Session Strategy

- **Access token**: JWT, 15-minute TTL, signed with `ACCESS_TOKEN_SECRET`.
  Sent in `Authorization: Bearer <token>` header.
- **Refresh token**: Opaque random token, 7-day TTL, stored hashed in DB.
  Sent in `httpOnly; Secure; SameSite=Strict` cookie named `__refresh`.
- **Rotation**: On every `/auth/refresh` call, old token is revoked and a new one issued.
- **Logout**: Revokes the current refresh token in DB + clears cookie.
- **RBAC**: Middleware checks `req.user.role`. Admin routes require `role === 'admin'`.

---

## API Route Map

```
POST   /api/auth/register             # Public (rate limited 5/hour/IP)
POST   /api/auth/verify-email         # Public — consumes token, logs user in
POST   /api/auth/resend-verification  # Public (rate limited 5/hour/IP)
POST   /api/auth/forgot-password      # Public (own 5/hour/IP limiter + 60s per-account cooldown)
POST   /api/auth/reset-password       # Public — revokes every session on success
POST   /api/auth/login                # Public
POST   /api/auth/logout               # Auth
POST   /api/auth/refresh              # Public (uses cookie)

GET    /api/users/me            # Auth
PATCH  /api/users/me            # Auth (displayName, avatarUrl)

GET    /api/games               # Public
GET    /api/games/:slug         # Public

GET    /api/entries             # Auth (own entries)
POST   /api/entries             # Auth (submit daily entry)
GET    /api/entries/:id         # Auth

GET    /api/leaderboard/daily   # Public ?date=YYYY-MM-DD
GET    /api/leaderboard/weekly  # Public ?week=YYYY-Www
GET    /api/leaderboard/monthly # Public ?month=YYYY-MM

# Admin routes
GET    /api/admin/users         # Admin
POST   /api/admin/users         # Admin (create user)
PATCH  /api/admin/users/:id     # Admin
DELETE /api/admin/users/:id     # Admin (soft delete)

GET    /api/admin/entries       # Admin
PATCH  /api/admin/entries/:id   # Admin (edit any entry)

GET    /api/admin/stats         # Admin dashboard stats
```

---

## UI Page Map

```
/                    → Home (daily leaderboard + top scores widget)
/login               → Login form
/leaderboard         → Full leaderboard (daily/weekly/monthly tabs)
/history             → Historical scores browser (date + game filters)
/games               → Game links page (official URLs)
/profile             → Profile page (displayName, avatar)
/entry               → Daily entry form (select game, enter score)
/admin               → Admin dashboard
/admin/users         → User management
/admin/users/new     → Create user
/admin/entries       → Entry management (edit/view)
```

---

## Security Checklist

- [x] bcrypt password hashing (rounds ≥ 12)
- [x] httpOnly + Secure + SameSite=Strict refresh cookie
- [x] JWT access token, short TTL (15min)
- [x] Refresh token rotation (old token revoked on use)
- [x] Rate limiting on `/api/auth/*` (express-rate-limit)
- [x] Helmet.js for secure headers
- [x] CORS restricted to frontend origin
- [x] Input validation: Zod on backend, Zod on frontend forms
- [x] Mongoose unique index for (userId, gameId, date)
- [x] Role-based middleware on admin routes
- [x] Avatar URL validated as HTTPS URL (no file upload)
- [x] Sensitive errors never forwarded to client (generic 500 messages)
- [x] No secrets in source code — all via environment variables
- [x] `.env` in `.gitignore`

---

## Threat Model (Short)

| Threat | Mitigation |
|--------|-----------|
| Brute-force login | Rate limit on /auth/login (30 req/15min per IP) |
| Mail bombing via signup | `registerLimiter` — 5 req/hour per IP on /auth/register and /auth/resend-verification |
| Verification token replay | Single-use (`usedAt`), sha256-hashed in DB, 24h TTL index; issuing a new token invalidates outstanding ones |
| Reset-link interception | 1h TTL, single use, separate collection from verification tokens; frontend strips the token from the URL so it never leaks via Referer or history |
| Attacker keeping access after victim resets | Reset revokes every refresh token for the account |
| Account enumeration by response time | bcrypt runs on both branches of register and login; mail endpoints padded to a 150ms floor (`utils/timing.ts`) |
| Inbox flooding one victim | 60s per-account cooldown in `issuePasswordResetToken`, on top of the per-IP limiter |
| Privilege escalation via signup | `registerSchema` has no `role` field — self-registration always yields `role: 'user'` |
| Token theft (XSS) | Access token in memory only; refresh in httpOnly cookie |
| CSRF on cookie-based refresh | SameSite=Strict cookie; CSRF token optional for v2 |
| Refresh token replay | DB-stored hash; rotation invalidates old token immediately |
| Duplicate daily entry | DB unique compound index (userId, gameId, date) |
| Privilege escalation | Role checked server-side on every protected route |
| Malicious avatar URL | Validated HTTPS URL; no file execution |
| Score manipulation | All normalization done server-side; client sends raw scores only |
| Data enumeration | User list is admin-only; public endpoints show display names only |
| Email enumeration via signup | /auth/register returns the same 201 for a taken email; /auth/resend-verification always returns 200; the unverified 403 on login fires only after the password check |

---

## Environment Variables

See `.env.example` for full list. Required vars:
- `MONGODB_URI`
- `ACCESS_TOKEN_SECRET`
- `REFRESH_TOKEN_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_DISPLAY_NAME`
- `FRONTEND_URL`

---

## Seed

Run `npm run seed` from `apps/backend` to:
1. Create the admin user from env vars.
2. Insert the initial Game documents (Wordle, Parolla).

Seed is idempotent — safe to run multiple times.

---

## Phase Log

| Phase | Status | Description |
|-------|--------|-------------|
| 1     | ✅ Done | Architecture, design, CLAUDE.md |
| 2     | ✅ Done | Monorepo scaffold, TypeScript config, shared types, env, Dockerfiles |
| 3     | ✅ Done | DB models (User/Game/DailyEntry/RefreshToken), seed, full auth API, admin APIs |
| 4     | ✅ Done | Next.js setup, Chakra UI v3 theme, auth store, login, profile, admin UI |
| 5     | ✅ Done | Entry forms, leaderboard (daily/weekly/monthly), history, games pages |
| 6     | ✅ Done | Zod validation, rate limiting, helmet, CORS, DB indexes, error handling |
| 7     | ✅ Done | README, .env.example, seed instructions, API summary, PM2/Docker deploy |
| 8     | ✅ Done | next-intl v4 `[locale]` routing, TR/EN dil değiştirici, tablo raw score sütunu, next-themes color mode |
| 9     | ✅ Done | Tavla/Kızma Birader navbar'dan çıktı, puan ağırlığı 40/60, Parolla ekran içi klavye, açık kayıt + mail doğrulama |

## Önemli Notlar / Pitfalls

- **`useColorMode`** — `@chakra-ui/react`'ten import edilmez. `@/providers/ChakraProvider`'dan import edilir.
- **`Link`, `useRouter`, `usePathname`** — `next/navigation`'dan değil, `@/lib/navigation`'dan import edilir (locale-aware olması için).
- **`optimizePackageImports`** — Chakra UI v3 ile uyumsuz, `next.config.ts`'de aktif edilmemeli.
- **`useTranslations`** — Hem server hem client component'larda çalışır. `[locale]/layout.tsx` içindeki `NextIntlClientProvider` sayesinde provider zinciri kurulu.
- **Mongoose duplicate index** — `unique: true` zaten index oluşturur; `schema.index({ email: 1 })` ayrıca yazılmamalı.
- **next-intl plugin** — `next.config.ts`'de `createNextIntlPlugin` ve `src/i18n/request.ts` birlikte olmak zorunda. Biri eksik olursa "Couldn't find next-intl config file" hatası gelir.
- **`GameKeyboard`** — Wordle ve Parolla aynı klavyeyi paylaşır (`components/game/GameKeyboard.tsx`). `fixed` prop'u: Wordle `true` (viewport'un altına sabitlenir, kendi spacer'ını ölçer), Parolla `false` (sabit yükseklikli flex kolonun içinde akar).
- **Parolla cevap alanı gerçek `<input>` değil** — sistem klavyesi açılırsa soru/timer/harfler ekrandan taşıyor. Klavyeyi `readOnly` değil, doğrudan `<Box>` + sahte caret ile çözdük. Fiziksel klavye desteği `window` keydown listener'ında.
- **`emailVerified` migration** — bu alan eklendikten sonra `npm run seed` bir kez çalıştırılmalı; eski kullanıcı kayıtlarında alan yok ve `undefined` falsy olduğu için giriş yapamazlar.
- **`SCORE_WEIGHTS`** — günlük/haftalık/aylık toplam skorun tek kaynağı (`config/gameConfig.ts`). Ağırlık değişirse `leaderboard.service.ts` içindeki iki yol da (daily + period aggregation) otomatik uyar.

---

## Package Choice Justifications

| Package | Justification |
|---------|--------------|
| bcryptjs | Pure-JS bcrypt — no native bindings, works everywhere, rounds=12 |
| jsonwebtoken | Industry-standard JWT library, actively maintained |
| express-rate-limit | Composable, production-tested rate limiter for Express |
| helmet | Comprehensive security headers in one middleware |
| zod | TypeScript-first schema validation; single source of truth for DTO + type inference |
| mongoose 8 | Mature MongoDB ODM, strong TypeScript support |
| next-intl v4 | App Router native i18n; `[locale]` routing, server + client component support |
| next-themes | Chakra UI v3'ün color mode sistemi next-themes gerektirir; kendi hook'u plugin bağımlı |
| @chakra-ui/react v3 | Ark UI tabanlı, daha iyi performans ve theming; semantic token sistemi |
| react-hook-form | Performant, uncontrolled forms; integrates with Zod via @hookform/resolvers |
| axios | Interceptor support for access token refresh; cleaner than raw fetch for client API calls |
| nodemailer | Plain SMTP — keeps the mail provider a pure `.env` concern (Resend, Brevo, Zoho, Postfix) instead of coupling the code to one vendor's REST API |
| zustand | Minimal client state for auth; no boilerplate, works with SSR |

## VPS Deployment

### Process Manager
Use **PM2** to run both apps as daemons.

```bash
# Backend
pm2 start apps/backend/dist/server.js --name dail-game-api

# Frontend (Next.js production)
pm2 start npm --name dail-game-web -- start --prefix apps/frontend
```

### Reverse Proxy (Nginx assumed)
```nginx
# /etc/nginx/sites-available/dail-game
server {
  server_name yourdomain.com;

  location /api/ {
    proxy_pass http://localhost:5000/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

### Build Steps
```bash
# 1. Clone and install
git clone <repo> && cd dail-game
npm install

# 2. Set env vars
cp .env.example apps/backend/.env
cp .env.example apps/frontend/.env.local
# Edit both files with production values

# 3. Build
npm run build

# 4. Seed DB (first time only)
cd apps/backend && npm run seed

# 5. Start with PM2
pm2 start ecosystem.config.js
```

### Environment Variables (Required on VPS)
Backend:
- `NODE_ENV=production`
- `PORT=5000`
- `MONGODB_URI=mongodb://...`
- `ACCESS_TOKEN_SECRET=<64-char random>`
- `REFRESH_TOKEN_SECRET=<64-char random>`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_DISPLAY_NAME`
- `FRONTEND_URL=https://yourdomain.com`

Frontend:
- `NEXT_PUBLIC_API_URL=https://yourdomain.com/api`

---

## Future Extension Points

1. **New games**: Add to `Game` collection + add config to `GAME_CONFIG` map in `gameConfig.ts`. No schema changes needed.
2. **New languages**: Add `messages/<locale>.json` and update `next-intl` config.
3. **File upload avatars**: Add `multer` + S3/local storage; replace URL validation with upload endpoint.
4. **Email notifications**: Plug into a queue (BullMQ) on entry submission.
5. **Timezone per user**: Store in User model; adjust date display client-side only.
6. **CSRF protection**: Add `csurf` or double-submit cookie pattern for refresh endpoint.
7. **OAuth login**: Add `passport.js` strategy; no schema changes needed (add `oauthId` field).
8. **Score history charts**: Add charting library (Recharts) to history page.

---

## Known Assumptions

1. Parolla is scored over the 26 Turkish letters; 3 wrong answers cancel 1 correct.
2. Registration is public; a verified email is the only gate (no admin approval).
   Admins can still create accounts directly, and those are verified up front.
3. "Weekly" leaderboard = ISO week (Monday–Sunday).
4. All timestamps stored in UTC. Display timezone = UTC for v1.
5. DNF in Wordle is represented as `attempt = 7` in the DB.
6. Avatar is URL-only in v1; file upload deferred.
7. Password reset is self-service via emailed link; admins can still force a
   reset with `PATCH /api/admin/users/:id/password`.
8. Rate limiting is in-process memory. It resets when the container restarts and
   counts per-instance, so scaling past one backend replica needs a shared store
   (Redis) before the limits mean anything.
