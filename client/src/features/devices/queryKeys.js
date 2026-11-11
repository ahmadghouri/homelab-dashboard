export const deviceKeys = {
  all: ['devices'],
  list: () => [...deviceKeys.all, 'list'],
  details: () => [...deviceKeys.all, 'detail'],
  detail: (id) => [...deviceKeys.details(), id],
  history: (id, range) => [...deviceKeys.all, 'history', id, range],
  // Client-only: recent live points received over the socket (never fetched).
  live: (id) => [...deviceKeys.all, 'live', id],
};

export const HISTORY_RANGES = [
  { value: '1h', label: '1 hour' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
];
