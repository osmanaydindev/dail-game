import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { env } from './config/env';
import { apiLimiter, authBackstopLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { requireAuth } from './middleware/auth';
import { requireAdmin } from './middleware/admin';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import gameRoutes from './routes/games';
import entryRoutes from './routes/entries';
import leaderboardRoutes from './routes/leaderboard';
import adminUserRoutes from './routes/admin/users';
import adminEntryRoutes from './routes/admin/entries';

const app = express();

// ─── Security middleware ───────────────────────────────────────────────────────
app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);

// ─── Static uploads ───────────────────────────────────────────────────────────
app.use('/api/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ─── Parsing ──────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// ─── Rate limiting ────────────────────────────────────────────────────────────
app.use('/api', apiLimiter);
// In-process backstop: the Redis-backed limiters fail open, so this is what
// still bounds brute force on auth endpoints while Redis is unavailable.
app.use('/api/auth', authBackstopLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/entries', entryRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/admin/users', requireAuth, requireAdmin, adminUserRoutes);
app.use('/api/admin/entries', requireAuth, requireAdmin, adminEntryRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, error: 'Not found' }));

// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

export default app;
