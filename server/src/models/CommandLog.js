import mongoose from 'mongoose';

// Fixed whitelist. The agent maps each one to a fixed OS command.
export const REMOTE_COMMANDS = ['lock', 'restart', 'shutdown', 'cancel_shutdown'];
export const COMMAND_STATUSES = ['pending', 'success', 'failed', 'timeout'];
export const COMMAND_LOG_RETENTION_DAYS = 90;

// One remote command sent to a PC, with who sent it and what the agent answered.
// Names are copied so the history stays readable after a rename or delete.
const commandLogSchema = new mongoose.Schema(
  {
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true },
    deviceName: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    command: { type: String, enum: REMOTE_COMMANDS, required: true },
    status: { type: String, enum: COMMAND_STATUSES, default: 'pending' },
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

commandLogSchema.index({ deviceId: 1, createdAt: -1 });
commandLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: COMMAND_LOG_RETENTION_DAYS * 24 * 60 * 60 },
);

export const CommandLog = mongoose.model('CommandLog', commandLogSchema);
