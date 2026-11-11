import mongoose from 'mongoose';
import { Device } from '../models/Device.js';
import { MetricSample } from '../models/MetricSample.js';
import { drainBuffers } from './liveMetricsStore.js';

const MINUTE_MS = 60 * 1000;

// Each range is grouped into buckets so a chart never gets more than ~350 points.
export const HISTORY_RANGES = {
  '1h': { durationMs: 60 * MINUTE_MS, binMinutes: 1 },
  '24h': { durationMs: 24 * 60 * MINUTE_MS, binMinutes: 5 },
  '7d': { durationMs: 7 * 24 * 60 * MINUTE_MS, binMinutes: 30 },
};

function average(values) {
  const numbers = values.filter((value) => typeof value === 'number');
  if (numbers.length === 0) {
    return undefined;
  }
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function toSample(deviceId, buffer, ts) {
  return {
    ts,
    deviceId: new mongoose.Types.ObjectId(deviceId),
    cpu: average(buffer.map((m) => m.cpu)),
    memPct: average(buffer.map((m) => m.mem.usedPct)),
    tempC: average(buffer.map((m) => m.tempC)),
    batteryPct: average(buffer.map((m) => m.battery?.percent)),
    netRxBps: average(buffer.map((m) => m.net.rxBps)),
    netTxBps: average(buffer.map((m) => m.net.txBps)),
  };
}

// Saves one averaged sample per device that sent data since the last flush.
export async function flushMetricSamples() {
  const drained = drainBuffers();
  if (drained.length === 0) {
    return 0;
  }

  const ts = new Date();
  const samples = drained.map(([deviceId, buffer]) => toSample(deviceId, buffer, ts));
  await Promise.all([
    MetricSample.insertMany(samples),
    Device.updateMany({ _id: { $in: drained.map(([deviceId]) => deviceId) } }, { lastSeenAt: ts }),
  ]);
  return samples.length;
}

export async function getMetricHistory(deviceId, range) {
  const { durationMs, binMinutes } = HISTORY_RANGES[range];
  const since = new Date(Date.now() - durationMs);

  const points = await MetricSample.aggregate([
    { $match: { deviceId: new mongoose.Types.ObjectId(deviceId), ts: { $gte: since } } },
    {
      $group: {
        _id: { $dateTrunc: { date: '$ts', unit: 'minute', binSize: binMinutes } },
        cpu: { $avg: '$cpu' },
        memPct: { $avg: '$memPct' },
        tempC: { $avg: '$tempC' },
        netRxBps: { $avg: '$netRxBps' },
        netTxBps: { $avg: '$netTxBps' },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        ts: '$_id',
        cpu: { $round: ['$cpu', 1] },
        memPct: { $round: ['$memPct', 1] },
        tempC: { $round: ['$tempC', 1] },
        netRxBps: { $round: ['$netRxBps', 0] },
        netTxBps: { $round: ['$netTxBps', 0] },
      },
    },
  ]);

  return { range, binMinutes, points };
}
