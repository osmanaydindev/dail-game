import { createServer } from 'http';
import { env } from './config/env';
import { connectDb } from './config/db';
import app from './app';
import { attachTavlaSocket } from './tavla/socketHandler';
import { attachKizmaBiraderSocket } from './kizmaBirader/socketHandler';

async function start(): Promise<void> {
  await connectDb();
  const httpServer = createServer(app);
  const io = attachTavlaSocket(httpServer);
  attachKizmaBiraderSocket(io);
  httpServer.listen(env.PORT, () => {
    console.log(`🚀 API running on port ${env.PORT} [${env.NODE_ENV}]`);
  });
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
