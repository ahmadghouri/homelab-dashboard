export const alertKeys = {
  all: ['alerts'],
  lists: () => [...alertKeys.all, 'list'],
  list: (status) => [...alertKeys.lists(), status],
  rules: () => [...alertKeys.all, 'rules'],
};
