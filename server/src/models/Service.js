import mongoose from 'mongoose';

export const SERVICE_TYPES = ['http', 'tcp'];
export const SERVICE_STATUSES = ['up', 'down', 'unknown'];

// A website or network service checked on an interval (HTTP request or TCP connect).
const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    type: { type: String, enum: SERVICE_TYPES, required: true },
    // http: a full http(s) URL. tcp: "host:port".
    target: { type: String, required: true, trim: true, maxlength: 500 },
    intervalSec: { type: Number, min: 30, max: 3600, default: 60 },
    timeoutMs: { type: Number, min: 1000, max: 30000, default: 5000 },
    enabled: { type: Boolean, default: true },
    status: { type: String, enum: SERVICE_STATUSES, default: 'unknown' },
    statusSince: { type: Date, default: Date.now },
    lastCheckedAt: { type: Date, default: null },
    lastResponseMs: { type: Number, default: null },
    lastStatusCode: { type: Number, default: null },
    lastError: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export const Service = mongoose.model('Service', serviceSchema);
