import http from 'node:http';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { startMetricsFlushJob, stopMetricsFlushJob } from './jobs/metricsFlushJob.js';
import { markAllDevicesOffline } from './services/deviceService.js';
import { createSocketServer } from './sockets/index.js';

const app = createApp();
const server = http.createServer(app);
const io = createSocketServer(server);

await connectDatabase(env.mongodbUri);

try {
  await markAllDevicesOffline();
} catch (error) {
  console.error('[server] could not reset device status:', error.message);
}

startMetricsFlushJob();

server.listen(env.port, () => {
  console.log(`[server] listening on http://localhost:${env.port} (${env.nodeEnv})`);
});

async function shutdown(signal) {
  console.log(`[server] ${signal} received, shutting down`);
  await stopMetricsFlushJob();
  io.close();
  await disconnectDatabase();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
