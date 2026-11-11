import mongoose from 'mongoose';

export const QUALITY_RETENTION_DAYS = 90;
export const QUALITY_TARGETS = ['gateway', 'internet'];

// One ping round (10 pings) to one target, taken every minute.
// Stored in a MongoDB time series collection that deletes samples after the retention period.
// avgMs / minMs / maxMs are null when every ping was lost; jitterMs needs at least two replies.
const qualitySampleSchema = new mongoose.Schema(
  {
    ts: { type: Date, required: true },
    target: { type: String, enum: QUALITY_TARGETS, required: true },
    host: { type: String, required: true },
    sent: { type: Number, required: true },
    received: { type: Number, required: true },
    lossPct: { type: Number, required: true },
    avgMs: { type: Number, default: null },
    minMs: { type: Number, default: null },
    maxMs: { type: Number, default: null },
    jitterMs: { type: Number, default: null },
  },
  {
    timeseries: { timeField: 'ts', metaField: 'target', granularity: 'minutes' },
    expireAfterSeconds: QUALITY_RETENTION_DAYS * 24 * 60 * 60,
    versionKey: false,
  },
);

export const QualitySample = mongoose.model('QualitySample', qualitySampleSchema);
