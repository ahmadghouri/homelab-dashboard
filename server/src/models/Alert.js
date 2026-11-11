import mongoose from 'mongoose';
import { ALERT_SEVERITIES, RULE_TYPES } from './AlertRule.js';

export const ALERT_STATUSES = ['open', 'resolved'];
export const ALERT_TARGET_TYPES = [
  'device',
  'network_device',
  'internet',
  'service',
  'quality_target',
  'workspace_project',
  'internet_line',
  'storage_account',
];

const alertSchema = new mongoose.Schema(
  {
    ruleType: { type: String, enum: RULE_TYPES, required: true },
    severity: { type: String, enum: ALERT_SEVERITIES, required: true },
    targetType: { type: String, enum: ALERT_TARGET_TYPES, required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    targetName: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    value: { type: Number },
    status: { type: String, enum: ALERT_STATUSES, default: 'open' },
    acknowledged: { type: Boolean, default: false },
    resolvedAt: { type: Date },
    resolvedReason: { type: String },
    notifiedAt: { type: Date },
    notifyError: { type: String },
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

alertSchema.index({ status: 1, createdAt: -1 });
alertSchema.index({ ruleType: 1, targetId: 1, status: 1 });

export const Alert = mongoose.model('Alert', alertSchema);
