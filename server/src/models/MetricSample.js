import mongoose from 'mongoose';

export const METRICS_RETENTION_DAYS = 30;

// One averaged sample per device per minute.
// Stored in a MongoDB time series collection, which compresses well and
// deletes samples older than the retention period automatically.
const metricSampleSchema = new mongoose.Schema(
  {
    ts: { type: Date, required: true },
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
    cpu: { type: Number },
    memPct: { type: Number },
    tempC: { type: Number },
    batteryPct: { type: Number },
    netRxBps: { type: Number },
    netTxBps: { type: Number },
  },
  {
    timeseries: { timeField: 'ts', metaField: 'deviceId', granularity: 'minutes' },
    expireAfterSeconds: METRICS_RETENTION_DAYS * 24 * 60 * 60,
    versionKey: false,
  },
);

export const MetricSample = mongoose.model('MetricSample', metricSampleSchema);
