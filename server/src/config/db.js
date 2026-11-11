import mongoose from 'mongoose';

const STATE_NAMES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

export async function connectDatabase(uri) {
  mongoose.connection.on('connected', () => console.log('[db] connected'));
  mongoose.connection.on('disconnected', () => console.warn('[db] disconnected'));
  mongoose.connection.on('error', (error) => console.error('[db] error:', error.message));

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  } catch (error) {
    // Keep the API running so /api/health can report the problem.
    // Mongoose keeps retrying in the background.
    console.error('[db] initial connection failed:', error.message);
  }
}

export function getDatabaseState() {
  return STATE_NAMES[mongoose.connection.readyState] ?? 'unknown';
}

export function disconnectDatabase() {
  return mongoose.disconnect();
}
