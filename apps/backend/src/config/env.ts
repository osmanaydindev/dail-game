import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string().min(1),
  ACCESS_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_MS: z.coerce.number().default(172_800_000), // 48 hours
  REFRESH_TOKEN_TTL_MS: z.coerce.number().default(604_800_000),
  FRONTEND_URL: z.string().url(),
  BACKEND_URL: z.string().url().default('http://localhost:5000'),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  ADMIN_DISPLAY_NAME: z.string().optional(),
  ADMIN_USERNAME: z.string().min(3).max(20).optional(),

  // ── Outgoing mail (Resend SMTP by default; any SMTP relay works) ──────────
  // Optional so local development runs without a mail account — when SMTP_HOST
  // is unset, verification mails are logged to the console instead of sent.
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('Aydınlar Oynuyor <noreply@localhost>'),
  MAIL_REPLY_TO: z.string().email().optional(),
  EMAIL_VERIFICATION_TTL_MS: z.coerce.number().default(86_400_000), // 24 hours
  // Much shorter than email verification: a reset link is a live key to the
  // account, so its window of usefulness if intercepted must be small.
  PASSWORD_RESET_TTL_MS: z.coerce.number().default(3_600_000), // 1 hour

  // Backs rate limiting. Optional: without it, limits fall back to per-process
  // memory, which resets on restart and does not add up across replicas.
  REDIS_URL: z.string().url().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
