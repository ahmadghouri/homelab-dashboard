import mongoose from 'mongoose';

export const DEVICE_STATUSES = ['online', 'offline'];

// A PC that runs the agent. Hardware fields are filled from the agent's hello message.
const deviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    agentTokenHash: { type: String, required: true, unique: true, select: false },
    status: { type: String, enum: DEVICE_STATUSES, default: 'offline' },
    lastSeenAt: { type: Date },
    hostname: { type: String },
    platform: { type: String },
    osName: { type: String },
    osVersion: { type: String },
    arch: { type: String },
    cpuModel: { type: String },
    cpuCores: { type: Number },
    totalMemBytes: { type: Number },
    agentVersion: { type: String },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.agentTokenHash;
        return ret;
      },
    },
  },
);

export const Device = mongoose.model('Device', deviceSchema);
