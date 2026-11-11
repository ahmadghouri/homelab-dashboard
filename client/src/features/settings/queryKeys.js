export const settingsKeys = {
  all: ['settings'],
  app: () => [...settingsKeys.all, 'app'],
  users: () => [...settingsKeys.all, 'users'],
};
