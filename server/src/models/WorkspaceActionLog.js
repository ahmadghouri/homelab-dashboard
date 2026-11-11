import mongoose from 'mongoose';

export const WORKSPACE_ACTION_TARGETS = ['project', 'container', 'service'];
export const WORKSPACE_ACTIONS = ['start', 'stop', 'restart'];
export const WORKSPACE_ACTION_STATUSES = ['pending', 'success', 'failed', 'timeout'];
export const WORKSPACE_ACTION_LOG_RETENTION_DAYS = 90;

// One workspace action (start / stop / restart of a project, container or OS service) sent to a PC.
// Names are copied so the history stays readable after a rename or a workspace.json change.
const workspaceActionLogSchema = new mongoose.Schema(
  {
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
    deviceName: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    target: { type: String, enum: WORKSPACE_ACTION_TARGETS, required: true },
    targetId: { type: String, required: true },
    targetName: { type: String, required: true },
    action: { type: String, enum: WORKSPACE_ACTIONS, required: true },
    status: { type: String, enum: WORKSPACE_ACTION_STATUSES, default: 'pending' },
    output: { type: String, default: '' },
    finishedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        ret.deviceId = ret.deviceId?.toString();
        ret.userId = ret.userId?.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.updatedAt;
        return ret;
      },
    },
  },
);

workspaceActionLogSchema.index({ deviceId: 1, createdAt: -1 });
workspaceActionLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: WORKSPACE_ACTION_LOG_RETENTION_DAYS * 24 * 60 * 60 },
);

export const WorkspaceActionLog = mongoose.model('WorkspaceActionLog', workspaceActionLogSchema);
