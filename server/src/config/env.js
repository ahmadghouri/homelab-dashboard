// Reads and validates environment variables once at startup.

const MIN_JWT_SECRET_LENGTH = 32;

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function toPort(value, fallback) {
  const port = Number(value ?? fallback);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${value}`);
  }
  return port;
}

function jwtSecret() {
  const secret = required('JWT_SECRET');
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters`);
  }
  return secret;
}

function positiveNumber(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${name}: ${process.env[name]}`);
  }
  return value;
}

// Drive (M11). All optional: without GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET the Drive pages
// show setup steps and no account can be connected.
const port = toPort(process.env.PORT, 4000);
const storage = Object.freeze({
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  googleRedirectUri:
    process.env.GOOGLE_REDIRECT_URI ?? `http://localhost:${port}/api/storage/google/callback`,
  // Encrypts Google tokens at rest. When empty, a key is derived from JWT_SECRET instead
  // (changing JWT_SECRET then means reconnecting the Drive accounts).
  encryptionKey: process.env.STORAGE_ENCRYPTION_KEY ?? '',
  maxUploadBytes: positiveNumber('STORAGE_MAX_UPLOAD_GB', 10) * 1024 ** 3,
  trashRetentionDays: positiveNumber('STORAGE_TRASH_DAYS', 30),
  // Test-only overrides so the Drive code can be pointed at a local mock server.
  googleAuthBase: process.env.GOOGLE_AUTH_BASE ?? 'https://accounts.google.com',
  googleOauthBase: process.env.GOOGLE_OAUTH_BASE ?? 'https://oauth2.googleapis.com',
  googleApiBase: process.env.GOOGLE_API_BASE ?? 'https://www.googleapis.com',
});

export const env = Object.freeze({
  storage,
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port,
  mongodbUri: required('MONGODB_URI'),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  jwtSecret: jwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  // Optional. Without it, alerts show only in the dashboard.
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
});
