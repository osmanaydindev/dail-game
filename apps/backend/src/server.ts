import { createServer } from 'http';
import { env } from './config/env';
import { connectDb } from './config/db';
import { attachTavlaSocket } from './tavla/socketHandler';
import { attachKizmaBiraderSocket } from './kizmaBirader/socketHandler';
import { waitForRedisReady, closeRedis } from './config/redis';

async function start(): Promise<void> {
  await connectDb();

  // Waited on before the app is imported: the rate limiters build their Redis
  // store at module load, and that store issues a command in its constructor.
  // A timeout here is not fatal — the limiters fall back to memory.
  if (env.REDIS_URL) {
    if (await waitForRedisReady()) console.log('✅ Rate limiting backed by Redis');
    else console.warn('⚠️  Redis not reachable at startup — rate limits fall back to process memory');
  } else {
    console.warn('⚠️  REDIS_URL not set — rate limits are per-process and reset on restart');
  }

  const { default: app } = await import('./app');
  const httpServer = createServer(app);
  const io = attachTavlaSocket(httpServer);
  attachKizmaBiraderSocket(io);
  httpServer.listen(env.PORT, () => {
    console.log(`🚀 API running on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      httpServer.close(() => {
        void closeRedis().finally(() => process.exit(0));
      });
    });
  }
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
