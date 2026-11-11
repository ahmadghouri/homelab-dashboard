import {
  ArchiveIcon,
  BellIcon,
  GaugeIcon,
  GlobeIcon,
  LayoutDashboardIcon,
  MonitorIcon,
  ServerIcon,
  SettingsIcon,
  WifiIcon,
} from 'lucide-react';

// Single source for sidebar links, page titles, and placeholder pages.
// `milestone` marks pages that are not built yet (see PENDING.md).
export const NAV_ITEMS = [
  {
    path: '/',
    title: 'Overview',
    icon: LayoutDashboardIcon,
    description: 'Health of your PCs, network, and services at a glance.',
  },
  {
    path: '/devices',
    title: 'Devices',
    icon: MonitorIcon,
    description: 'Live CPU, RAM, disk, and temperature of every PC with the agent.',
    milestone: 'M2',
  },
  {
    path: '/network',
    title: 'Network',
    icon: WifiIcon,
    description: 'Everything connected to your WiFi, with alerts for unknown devices.',
    milestone: 'M3',
  },
  {
    path: '/internet',
    title: 'Internet',
    icon: GlobeIcon,
    description: 'Speed test history and downtime log.',
    milestone: 'M5',
  },
  {
    path: '/services',
    title: 'Services',
    icon: ServerIcon,
    description: 'Up / down status and response time of websites and services.',
    milestone: 'M5',
  },
  {
    path: '/backups',
    title: 'Backups',
    icon: ArchiveIcon,
    description: 'Scheduled backups, history, and restore.',
    milestone: 'M7',
  },
  {
    path: '/alerts',
    title: 'Alerts',
    icon: BellIcon,
    description: 'Open and resolved alerts, and alert rules.',
    milestone: 'M4',
  },
  {
    path: '/settings',
    title: 'Settings',
    icon: SettingsIcon,
    description: 'Telegram alerts, network scan, data retention, and users.',
    milestone: 'M4',
  },
];

export const APP_NAME = 'Homelab';
export const APP_ICON = GaugeIcon;

export function findNavItem(pathname) {
  return (
    NAV_ITEMS.find((item) => item.path !== '/' && pathname.startsWith(item.path)) ??
    NAV_ITEMS.find((item) => item.path === pathname)
  );
}
