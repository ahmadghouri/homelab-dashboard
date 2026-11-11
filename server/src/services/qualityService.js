// Internet quality monitor: pings the router (default gateway) and 1.1.1.1 every minute,
// saves one QualitySample per target and feeds the packet loss alert rule.
// Only these two hosts are ever pinged.
import { QualitySample } from '../models/QualitySample.js';
import { emitToDashboard } from '../sockets/registry.js';
import { onPacketLoss } from './alertEngine.js';
import { getDefaultGateway } from './gateway.js';
import { pingHost } from './pingProbe.js';

const MINUTE_MS = 60 * 1000;
const INTERNET_HOST = '1.1.1.1';

// 1h shows every sample; longer ranges are averaged into bins (at most ~170 points).
export const QUALITY_RANGES = {
  '1h': { durationMs: 60 * MINUTE_MS, binMinutes: 1 },
  '24h': { durationMs: 24 * 60 * MINUTE_MS, binMinutes: 10 },
  '7d': { durationMs: 7 * 24 * 60 * MINUTE_MS, binMinutes: 60 },
};

const TARGETS = [
  {
    target: 'gateway',
    resolveHost: getDefaultGateway,
    nameFor: (host) => (host ? `Router (${host})` : 'Router'),
  },
  {
    target: 'internet',
    resolveHost: async () => INTERNET_HOST,
    nameFor: () => `Internet (${INTERNET_HOST})`,
  },
];

function toSampleJson(sample) {
  return {
    ts: sample.ts,
    target: sample.target,
    host: sample.host,
    sent: sample.sent,
    received: sample.received,
    lossPct: sample.lossPct,
    avgMs: sample.avgMs ?? null,
    minMs: sample.minMs ?? null,
    maxMs: sample.maxMs ?? null,
    jitterMs: sample.jitterMs ?? null,
  };
}

async function measureTarget({ target, resolveHost, nameFor }, ts) {
  const host = await resolveHost();
  if (!host) {
    return null; // No gateway (no network): nothing to ping this round.
  }
  const stats = await pingHost(host);
  const sample = toSampleJson({ ts, target, host, ...stats });
  await QualitySample.create(sample);
  emitToDashboard('internet:quality', { target, sample });
  await onPacketLoss({ key: target, name: nameFor(host) }, sample.lossPct);
  return sample;
}

// Measures all targets in parallel. One failing target does not stop the others.
// Resolves with the saved samples.
export async function runQualityCheck() {
  const ts = new Date();
  const results = await Promise.allSettled(TARGETS.map((target) => measureTarget(target, ts)));
  const samples = [];
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`[quality] ${TARGETS[index].target} check failed:`, result.reason?.message);
    } else if (result.value) {
      samples.push(result.value);
    }
  });
  return samples;
}

function historyPipeline(since, binMinutes) {
  return [
    { $match: { ts: { $gte: since } } },
    {
      $group: {
        _id: {
          target: '$target',
          ts: { $dateTrunc: { date: '$ts', unit: 'minute', binSize: binMinutes } },
        },
        lossPct: { $avg: '$lossPct' },
        avgMs: { $avg: '$avgMs' },
        jitterMs: { $avg: '$jitterMs' },
      },
    },
    { $sort: { '_id.ts': 1 } },
    {
      $project: {
        _id: 0,
        target: '$_id.target',
        ts: '$_id.ts',
        lossPct: { $round: ['$lossPct', 1] },
        avgMs: { $round: ['$avgMs', 1] },
        jitterMs: { $round: ['$jitterMs', 1] },
      },
    },
  ];
}

function latestSample(target) {
  return QualitySample.findOne({ target }).sort({ ts: -1 }).lean();
}

// { range, binMinutes, targets: [{ target, name, host, latest, points: [{ ts, lossPct, avgMs, jitterMs }] }] }
export async function getQualityHistory(range) {
  const { durationMs, binMinutes } = QUALITY_RANGES[range];
  const since = new Date(Date.now() - durationMs);

  const [points, ...latest] = await Promise.all([
    QualitySample.aggregate(historyPipeline(since, binMinutes)),
    ...TARGETS.map(({ target }) => latestSample(target)),
  ]);

  const targets = await Promise.all(
    TARGETS.map(async ({ target, resolveHost, nameFor }, index) => {
      const last = latest[index];
      // The current gateway, or the last one measured when detection fails right now.
      const host = (await resolveHost()) ?? last?.host ?? null;
      return {
        target,
        name: nameFor(host),
        host,
        latest: last ? toSampleJson(last) : null,
        points: points
          .filter((point) => point.target === target)
          .map(({ ts, lossPct, avgMs, jitterMs }) => ({ ts, lossPct, avgMs, jitterMs })),
      };
    }),
  );

  return { range, binMinutes, targets };
}
