export const driveKeys = {
  all: ['drive'],
  // Everything that lists files or folders; invalidated together after file changes.
  content: () => [...driveKeys.all, 'content'],
  fileLists: () => [...driveKeys.content(), 'files'],
  files: (params) => [...driveKeys.fileLists(), params],
  file: (id) => [...driveKeys.content(), 'file', id],
  folders: (parentId) => [...driveKeys.content(), 'folders', parentId ?? null],
  tree: () => [...driveKeys.content(), 'tree'],
  path: (folderId) => [...driveKeys.content(), 'path', folderId],
  trash: () => [...driveKeys.content(), 'trash'],
  summary: () => [...driveKeys.all, 'summary'],
  accounts: () => [...driveKeys.all, 'accounts'],
  routing: () => [...driveKeys.all, 'routing'],
  setup: () => [...driveKeys.all, 'setup'],
  access: () => [...driveKeys.all, 'access'],
  myAccess: () => [...driveKeys.all, 'myAccess'],
  shares: () => [...driveKeys.all, 'shares'],
  activity: () => [...driveKeys.all, 'activity'],
};

export const ROUTING_MODES = [
  {
    value: 'most_free',
    label: 'Most free space',
    description: 'Each upload goes to the account with the most free space.',
  },
  {
    value: 'round_robin',
    label: 'Round robin',
    description: 'Uploads take turns across the accounts that have room.',
  },
  {
    value: 'priority',
    label: 'Priority order',
    description: 'Fill accounts in priority order; the next one is used when one is full.',
  },
];
