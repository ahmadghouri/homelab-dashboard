export const multiLinkKeys = {
  all: ['multilink'],
  details: () => [...multiLinkKeys.all, 'detail'],
  // Server data: { multilink: snapshot | null, settings: { mode, sticky, lines }, online }.
  detail: (deviceId) => [...multiLinkKeys.details(), deviceId],
  // Client-only: recent throughput points received over the socket (never fetched).
  history: (deviceId) => [...multiLinkKeys.all, 'history', deviceId],
};
