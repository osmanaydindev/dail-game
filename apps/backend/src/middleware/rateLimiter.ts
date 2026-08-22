import rateLimit, { type Store } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient, isRedisReady } from '../config/redis';

/**
 * Rate limit counters live in Redis when REDIS_URL is set, so they survive a
 * container restart and add up across replicas. Without Redis, express-rate-limit
 * falls back to its per-process memory store — fine for local development, but
 * the limits below only mean what they say when Redis is present.
 *
 * Each limiter gets its own key prefix. Sharing one would merge unrelated
 * counters, e.g. letting login attempts eat the password-reset budget.
 */
/** Hard ceiling on how long a request may wait on Redis. */
const REDIS_COMMAND_TIMEOUT_MS = 1_000;

function storeFor(prefix: string): Store | undefined {
  const client = getRedisClient();
  // Must already be connected: RedisStore issues a Lua script load in its
  // constructor. server.ts awaits waitForRedisReady() before importing the app
  // so that this holds. If Redis was down at boot we fall back to memory.
  if (!client || !isRedisReady()) return undefined;

  return new RedisStore({
    prefix: `rl:${prefix}:`,
    // `disableOfflineQueue` already makes commands reject while disconnected.
    // This covers the other case: a connection that is up but stalled, where
    // the command is sent and no reply ever comes. Either way the rejection
    // reaches `passOnStoreError` and the request proceeds — no request can
    // ever hang waiting on the rate limiter.
    sendCommand: ((...args: string[]) => {
      // Fail fast rather than wait out the socket timeout while Redis is down.
      if (!isRedisReady()) return Promise.reject(new Error('redis unavailable'));
      return Promise.race([
        client.sendCommand(args),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('redis command timeout')), REDIS_COMMAND_TIMEOUT_MS),
        ),
      ]);
    }) as never,
  });
}

interface LimiterOptions {
  windowMs: number;
  max: number;
  prefix: string;
  message?: string;
}

function makeLimiter({ windowMs, max, prefix, message }: LimiterOptions) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: message ?? 'Too many attempts, please try again later.' },
    store: storeFor(prefix),
    // If Redis is unreachable, serve the request instead of erroring. Losing
    // rate limiting during an outage is bad; refusing every request because the
    // limiter cannot count is worse. The backstop below covers the gap.
    passOnStoreError: true,
  });
}

export const authLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  prefix: 'auth',
});

// Tighter than authLimiter: every request behind these can send an email, so
// they are mail-bombing guards, not just brute-force guards.
//
// Separate instances *and* separate prefixes on purpose — sharing would mean a
// burst of signup attempts also locks the user out of password recovery, which
// is exactly when they need it.
export const registerLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  prefix: 'register',
});

export const passwordResetLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  prefix: 'reset',
});

export const apiLimiter = makeLimiter({
  windowMs: 60 * 1000,
  max: 120,
  prefix: 'api',
  message: 'Rate limit exceeded.',
});

/**
 * Deliberately memory-backed and deliberately loose.
 *
 * `passOnStoreError` means a Redis outage removes every limit above, which
 * would leave login open to unbounded brute force. This runs in-process, so it
 * keeps working when Redis does not. It is set well above the Redis limits so
 * it never fires during normal operation — it only bounds the damage while
 * Redis is down.
 */
export const authBackstopLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: false,
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts, please try again later.' },
});
