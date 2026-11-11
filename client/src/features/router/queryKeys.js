export const routerKeys = {
  all: ['router'],
  status: () => [...routerKeys.all, 'status'],
  devices: () => [...routerKeys.all, 'devices'],
};

export const dnsKeys = {
  all: ['dns'],
  status: () => [...dnsKeys.all, 'status'],
};
