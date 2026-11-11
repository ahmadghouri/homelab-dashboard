import mongoose from 'mongoose';

export const SPEED_TEST_RETENTION_DAYS = 90;
export const SPEED_TEST_TRIGGERS = ['schedule', 'manual'];

// One internet speed test. Failed tests are kept too (success: false), so gaps are visible.
const speedTestSchema = new mongoose.Schema(
  {
    ts: { type: Date, required: true, default: Date.now },
    downloadMbps: { type: Number, default: null },
    uploadMbps: { type: Number, default: null },
    pingMs: { type: Number, default: null },
    jitterMs: { type: Number, default: null },
    success: { type: Boolean, required: true },
    error: { type: String, default: null },
    trigger: { type: String, enum: SPEED_TEST_TRIGGERS, required: true },
  },
  {
    versionKey: false,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        return ret;
      },
    },
  },
);

// Serves the range queries and deletes tests older than the retention period.
speedTestSchema.index({ ts: 1 }, { expireAfterSeconds: SPEED_TEST_RETENTION_DAYS * 24 * 60 * 60 });

export const SpeedTest = mongoose.model('SpeedTest', speedTestSchema);
