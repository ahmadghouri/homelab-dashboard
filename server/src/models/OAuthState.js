import mongoose from 'mongoose';

// One pending Google connect attempt. Only the sha256 of the state is stored; it is single use
// and bound to the admin who started it. MongoDB removes expired entries (TTL index).
const oauthStateSchema = new mongoose.Schema(
  {
    stateHash: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

oauthStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OAuthState = mongoose.model('OAuthState', oauthStateSchema);
