# dail-game

Daily Wordle and Parolla leaderboard app. Users submit their daily game results and compete on daily, weekly, and monthly leaderboards.

## Stack

- **Frontend**: Next.js 15 (App Router) + Chakra UI v3
- **Backend**: Node.js + Express 4 + Mongoose 8
- **Database**: MongoDB 7
- **Auth**: JWT access tokens + httpOnly refresh cookies
- **i18n**: next-intl (English base, extensible)

## Quick Start (Local Dev)

### Prerequisites
- Node.js 22+
- MongoDB running locally on port 27017 (or set `MONGODB_URI`)

### 1. Clone & install
```bash
git clone <repo-url>
cd dail-game
npm install
```

### 2. Configure environment
```bash
# Backend
cp apps/backend/.env.example apps/backend/.env
# Edit apps/backend/.env with your values

# Frontend
cp apps/frontend/.env.example apps/frontend/.env.local
# Edit apps/frontend/.env.local
```

### 3. Generate secrets
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Run twice — one for ACCESS_TOKEN_SECRET, one for REFRESH_TOKEN_SECRET
```

### 4. Seed the database
```bash
npm run seed
# Creates the admin user and game records. Idempotent — safe to re-run.
```

### 5. Start dev servers
```bash
npm run dev
# Frontend: http://localhost:3000
# Backend:  http://localhost:5000
```

## Project Structure

```
dail-game/
├── apps/
│   ├── backend/          # Express API
│   │   ├── src/
│   │   │   ├── config/   # env, db, gameConfig
│   │   │   ├── controllers/
│   │   │   ├── middleware/
│   │   │   ├── models/   # Mongoose schemas
│   │   │   ├── routes/
│   │   │   ├── services/ # auth, leaderboard logic
│   │   │   ├── utils/
│   │   │   └── validation/ # Zod schemas
│   │   └── scripts/seed.ts
│   └── frontend/         # Next.js app
│       └── src/
│           ├── app/      # Pages (App Router)
│           ├── components/
│           ├── lib/      # API client, auth
│           ├── providers/
│           ├── store/    # Zustand auth store
│           └── messages/ # i18n strings
└── packages/
    └── types/            # Shared TypeScript types
```

## Scoring System

| Game | Formula | Range |
|------|---------|-------|
| Wordle | `(7 - attempt) / 6` | 0.167 – 1.000 (DNF = 0) |
| Parolla | `max(0, correct - wrong / 3) / 26` | 0.000 – 1.000 |
| **Combined** | `wordle × 0.4 + parolla × 0.6` | 0.000 – 1.000 |

Higher score = better ranking. Ties broken by earliest submission.

## API Summary

```
POST   /api/auth/register             Self-registration (sends verification email)
POST   /api/auth/verify-email         Verify email via token, logs the user in
POST   /api/auth/resend-verification  Resend the verification email
POST   /api/auth/forgot-password      Email a password reset link (1h, single use)
POST   /api/auth/reset-password       Set a new password, revoking every session
POST   /api/auth/login                Login (403 EMAIL_NOT_VERIFIED if unverified)
POST   /api/auth/refresh              Refresh access token (uses httpOnly cookie)
POST   /api/auth/logout               Logout

GET    /api/users/me            Get own profile
PATCH  /api/users/me            Update display name / avatar URL

GET    /api/games               List active games
GET    /api/leaderboard/daily   Daily leaderboard (?date=YYYY-MM-DD)
GET    /api/leaderboard/weekly  Weekly leaderboard (?week=YYYY-Www)
GET    /api/leaderboard/monthly Monthly leaderboard (?month=YYYY-MM)

GET    /api/entries             Own entries history
POST   /api/entries             Submit daily entry

GET    /api/admin/users         [admin] List users
POST   /api/admin/users         [admin] Create user
PATCH  /api/admin/users/:id     [admin] Update user
DELETE /api/admin/users/:id     [admin] Deactivate user
GET    /api/admin/entries       [admin] All entries (with filters)
PATCH  /api/admin/entries/:id   [admin] Edit entry
GET    /api/admin/entries/stats [admin] Dashboard stats
```

## VPS Deployment

See `CLAUDE.md` for the full VPS deployment guide including:
- Nginx reverse proxy config
- PM2 process manager setup
- Build steps
- Environment variables

## Adding a New Game

1. Insert a record in the `games` MongoDB collection (or update seed).
2. Add the game config to `apps/backend/src/config/gameConfig.ts`:
   - `slug`, `name`, `officialUrl`, `scoreFields`, `normalize` function.
3. Add the entry form in the frontend entry page.

No core schema changes required.

## Security Notes

- Passwords hashed with bcrypt (rounds=12)
- Refresh tokens stored as SHA-256 hashes, rotated on every use
- Verification tokens stored as SHA-256 hashes, single-use, 24h TTL index
- Password reset tokens: separate collection, SHA-256, single-use, 1h TTL, and a
  successful reset revokes every refresh token on the account
- Endpoints taking an email address are constant-response *and* constant-time
  (see "Anti-Enumeration & Timing" in CLAUDE.md)
- Rate limiting: 30 auth attempts / 15 min per IP; 5 registration or resend
  requests / hour per IP (each of those can send an email)
- Registration never reveals whether an email is already in use; usernames are
  public, so username collisions do return 409
- Self-registration cannot set `role` — it is always `user`
- All business rules enforced server-side
- DB unique index prevents duplicate daily entries

## License

Private — not for redistribution.
