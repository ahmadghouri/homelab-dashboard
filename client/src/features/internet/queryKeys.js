export const internetKeys = {
  all: ['internet'],
  status: () => [...internetKeys.all, 'status'],
  speedTestLists: () => [...internetKeys.all, 'speedtests'],
  speedTests: (range) => [...internetKeys.speedTestLists(), range],
  outageLists: () => [...internetKeys.all, 'outages'],
  outages: (limit) => [...internetKeys.outageLists(), limit],
  qualityLists: () => [...internetKeys.all, 'quality'],
  quality: (range) => [...internetKeys.qualityLists(), range],
  ispReports: () => [...internetKeys.all, 'isp-report'],
  ispReport: (month) => [...internetKeys.ispReports(), month],
};

export const SPEED_TEST_RANGES = [
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];

export const QUALITY_RANGES = [
  { value: '1h', label: '1 hour' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
];

export const DEFAULT_OUTAGE_LIMIT = 20;
