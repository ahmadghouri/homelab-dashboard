export const workspaceKeys = {
  all: ['workspace'],
  details: () => [...workspaceKeys.all, 'detail'],
  detail: (deviceId) => [...workspaceKeys.details(), deviceId],
  actions: (deviceId) => [...workspaceKeys.all, 'actions', deviceId],
  logs: (deviceId, target, id) => [...workspaceKeys.all, 'logs', deviceId, target, id],
};
