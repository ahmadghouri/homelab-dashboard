export const serviceKeys = {
  all: ['services'],
  list: () => [...serviceKeys.all, 'list'],
  histories: (id) => [...serviceKeys.all, 'history', id],
  history: (id, range) => [...serviceKeys.histories(id), range],
};

export const SERVICE_HISTORY_RANGES = [
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
];
