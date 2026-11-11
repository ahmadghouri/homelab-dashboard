import http from 'node:http';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { startMetricsFlushJob, stopMetricsFlushJob } from './jobs/metricsFlushJob.js';
import { startInternetMonitor, stopInternetMonitor } from './jobs/internetMonitorJob.js';
import { startNetworkScanJob, stopNetworkScanJob } from './jobs/networkScanJob.js';
import { startQualityMonitor, stopQualityMonitor } from './jobs/qualityMonitorJob.js';
import { startServiceMonitor, stopServiceMonitor } from './jobs/serviceMonitorJob.js';
import { startStorageQuotaJob, stopStorageQuotaJob } from './jobs/storageQuotaJob.js';
import { startStorageTrashJob, stopStorageTrashJob } from './jobs/storageTrashJob.js';
import {
  alertOnNewNetworkDevices,
  initAlertEngine,
  watchAllDevicesOffline,
} from './services/alertEngine.js';
import { ensureDefaultRules } from './services/alertService.js';
import { markAllDevicesOffline } from './services/deviceService.js';
import { onNewNetworkDevices } from './services/networkService.js';
import { startUploadCleanup, stopUploadCleanup } from './services/storage/uploadService.js';
import { failPendingWorkspaceActions } from './services/workspaceService.js';
import { createSocketServer } from './sockets/index.js';

const app = createApp();
const server = http.createServer(app);
const io = createSocketServer(server);

await connectDatabase(env.mongodbUri);

// Each startup step is independent: one failing (for example the database is down)
// must not stop the API from starting, so /api/health can report the problem.
async function startStep(label, step) {
  try {
    await step();
  } catch (error) {
    console.error(`[server] ${label} failed:`, error.message);
  }
}

await startStep('alert setup', async () => {
  await ensureDefaultRules();
  await initAlertEngine();
});
await startStep('device status reset', async () => {
  await markAllDevicesOffline();
  await failPendingWorkspaceActions();
  await watchAllDevicesOffline();
});

onNewNetworkDevices((devices) => {
  alertOnNewNetworkDevices(devices).catch((error) =>
    console.error('[alerts] new device alert failed:', error.message),
  );
});

startMetricsFlushJob();
await startStep('network scan job', startNetworkScanJob);
await startStep('internet monitor', startInternetMonitor);
await startStep('service monitor', startServiceMonitor);
await startStep('quality monitor', startQualityMonitor);
await startStep('drive quota job', startStorageQuotaJob);
await startStep('drive trash job', startStorageTrashJob);
await startStep('drive upload cleanup', startUploadCleanup);

server.listen(env.port, () => {
  console.log(`[server] listening on http://localhost:${env.port} (${env.nodeEnv})`);
});

async function shutdown(signal) {
  console.log(`[server] ${signal} received, shutting down`);
  stopNetworkScanJob();
  stopInternetMonitor();
  stopServiceMonitor();
  stopQualityMonitor();
  stopStorageQuotaJob();
  stopStorageTrashJob();
  stopUploadCleanup();
  await stopMetricsFlushJob();
  io.close();
  await disconnectDatabase();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
