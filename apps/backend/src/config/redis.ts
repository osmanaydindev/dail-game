import { createClient, type RedisClientType } from 'redis';
import { env } from './env';

let client: RedisClientType | null = null;

/**
 * Returns a connected Redis client, or null when REDIS_URL is unset.
 *
 * Redis here backs rate limiting only — no application data lives in it, so a
 * missing or unreachable Redis must never stop the API from booting. Callers
 * are expected to degrade rather than fail.
 */
export function getRedisClient(): RedisClientType | null {
  if (!env.REDIS_URL) return null;
  if (client) return client;

  client = createClient({
    url: env.REDIS_URL,
    // Critical for availability: by default node-redis *queues* commands while
    // disconnected, so a rate-limit lookup during an outage would never settle
    // and the HTTP request would hang forever instead of failing open. With the
    // queue off, commands reject immediately and the limiter can pass through.
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 3_000,
      // Cap the backoff so a long outage doesn't leave the client waiting
      // minutes to retry once Redis comes back.
      reconnectStrategy: (retries) => Math.min(retries * 200, 5_000),
    },
  }) as RedisClientType;

  // node-redis emits 'error' on an EventEmitter — without a listener, an
  // unhandled 'error' event would take the whole process down.
  client.on('error', (err: Error) => {
    console.error('[redis] connection error:', err.message);
  });
  client.on('ready', () => console.log('✅ Redis connected'));

  // Fire-and-forget: the client queues commands until the socket is up.
  client.connect().catch((err: Error) => {
    console.error('[redis] initial connect failed:', err.message);
  });

  return client;
}

export function isRedisReady(): boolean {
  return client?.isReady ?? false;
}

/**
 * Resolves true once the client is usable, false if it doesn't get there in
 * time. Callers wait for this before constructing anything that issues a
 * command on creation — `RedisStore` loads a Lua script in its constructor, and
 * with the offline queue disabled that would reject and crash the process.
 */
export function waitForRedisReady(timeoutMs = 5_000): Promise<boolean> {
  const c = getRedisClient();
  if (!c) return Promise.resolve(false);
  if (c.isReady) return Promise.resolve(true);

  return new Promise((resolve) => {
    const done = (value: boolean) => {
      clearTimeout(timer);
      c.off('ready', onReady);
      resolve(value);
    };
    const onReady = () => done(true);
    const timer = setTimeout(() => done(false), timeoutMs);
    c.once('ready', onReady);
  });
}

export async function closeRedis(): Promise<void> {
  if (!client) return;
  try {
    await client.quit();
  } catch {
    /* already gone */
  }
  client = null;
}
