// AdGuard Home settings from the environment. An empty ADGUARD_URL means the feature is off.
// Read lazily so tests can pass their own config to the client instead.

export function getAdguardConfig() {
  const url = (process.env.ADGUARD_URL ?? '').trim();
  if (!url) {
    return null;
  }
  return {
    url,
    user: process.env.ADGUARD_USER ?? '',
    password: process.env.ADGUARD_PASSWORD ?? '',
  };
}
