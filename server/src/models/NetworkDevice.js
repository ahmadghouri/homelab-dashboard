import mongoose from 'mongoose';

// A device seen on the local network (phone, TV, router, PC...). Identified by MAC address.
const networkDeviceSchema = new mongoose.Schema(
  {
    mac: { type: String, required: true, unique: true, lowercase: true, trim: true },
    ip: { type: String },
    vendor: { type: String },
    // Phones and laptops often use a random "private" MAC, so the vendor is unknown.
    randomizedMac: { type: Boolean, default: false },
    hostname: { type: String },
    customName: { type: String, trim: true, maxlength: 60 },
    trusted: { type: Boolean, default: false },
    online: { type: Boolean, default: false },
    isScanner: { type: Boolean, default: false },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
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

export const NetworkDevice = mongoose.model('NetworkDevice', networkDeviceSchema);
