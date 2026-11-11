import mongoose from 'mongoose';

// A period without internet. endedAt stays null while the outage is ongoing.
const internetOutageSchema = new mongoose.Schema(
  {
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    // Last failed check during the outage. Used to close an outage left open by a server stop.
    lastCheckedAt: { type: Date },
  },
  { versionKey: false },
);

internetOutageSchema.index({ startedAt: -1 });

export const InternetOutage = mongoose.model('InternetOutage', internetOutageSchema);
