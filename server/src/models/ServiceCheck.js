import mongoose from 'mongoose';

export const SERVICE_CHECK_RETENTION_DAYS = 30;

// One result per service check. Stored in a MongoDB time series collection
// (like MetricSample), which deletes checks older than the retention period automatically.
const serviceCheckSchema = new mongoose.Schema(
  {
    ts: { type: Date, required: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    up: { type: Boolean, required: true },
    responseMs: { type: Number },
    statusCode: { type: Number },
  },
  {
    timeseries: { timeField: 'ts', metaField: 'serviceId', granularity: 'minutes' },
    expireAfterSeconds: SERVICE_CHECK_RETENTION_DAYS * 24 * 60 * 60,
    versionKey: false,
  },
);

export const ServiceCheck = mongoose.model('ServiceCheck', serviceCheckSchema);
