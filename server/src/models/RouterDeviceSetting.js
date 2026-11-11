import mongoose from 'mongoose';

export const ROUTER_PRIORITIES = ['high', 'normal', 'low'];

// What the dashboard applied on the router for one network device. Source of truth for the UI.
const routerDeviceSettingSchema = new mongoose.Schema(
  {
    networkDeviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'NetworkDevice',
      required: true,
      unique: true,
    },
    mac: { type: String, required: true, lowercase: true, trim: true },
    tracked: { type: Boolean, default: false },
    priority: { type: String, enum: ROUTER_PRIORITIES, default: 'normal' },
    maxMbps: { type: Number, min: 1, max: 10000, default: null },
    blocked: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        ret.networkDeviceId = ret.networkDeviceId?.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export const RouterDeviceSetting = mongoose.model('RouterDeviceSetting', routerDeviceSettingSchema);
