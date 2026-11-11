import mongoose from 'mongoose';

export const ROUTING_MODES = ['most_free', 'round_robin', 'priority'];
const DEFAULT_MODE = 'most_free';

// Drive upload routing. A single document (key: 'routing') in its own collection. The round
// robin cursor lives here too so every API process shares it.
const routingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'routing' },
    mode: { type: String, enum: ROUTING_MODES, default: DEFAULT_MODE },
    roundRobinCursor: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false, collection: 'storageroutings' },
);

const StorageRouting = mongoose.model('StorageRouting', routingSchema);

const ensureDoc = { $setOnInsert: { key: 'routing' } };
const upsertAfter = { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true };

export async function getRoutingMode() {
  const doc = await StorageRouting.findOneAndUpdate({ key: 'routing' }, ensureDoc, upsertAfter)
    .select('mode')
    .lean();
  return doc?.mode ?? DEFAULT_MODE;
}

export async function setRoutingMode(mode) {
  const doc = await StorageRouting.findOneAndUpdate(
    { key: 'routing' },
    { $set: { mode } },
    upsertAfter,
  ).lean();
  return doc.mode;
}

// Atomically takes the next round robin slot. Returns the value before the increment.
export async function nextRoundRobinSlot() {
  const doc = await StorageRouting.findOneAndUpdate(
    { key: 'routing' },
    { $inc: { roundRobinCursor: 1 } },
    upsertAfter,
  ).lean();
  return doc.roundRobinCursor - 1;
}
