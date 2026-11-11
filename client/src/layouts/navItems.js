import {
  BellIcon,
  CableIcon,
  GaugeIcon,
  GlobeIcon,
  HardDriveIcon,
  LayoutDashboardIcon,
  MonitorIcon,
  RouterIcon,
  ServerIcon,
  SettingsIcon,
  SquareTerminalIcon,
  WifiIcon,
} from 'lucide-react';

// Single source for sidebar links and page titles.
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
  },
  {
    path: '/network',
    title: 'Network',
    icon: WifiIcon,
    description: 'Everything connected to your WiFi, with alerts for unknown devices.',
  },
  {
    path: '/internet',
    title: 'Internet',
    icon: GlobeIcon,
    description: 'Internet speed history and downtime log.',
  },
  {
    path: '/services',
    title: 'Services',
    icon: ServerIcon,
    description: 'Up / down status and response time of websites and services.',
  },
  {
    path: '/drive',
    title: 'Drive',
    icon: HardDriveIcon,
    description: 'Files stored across all connected Google Drive accounts.',
  },
  {
    path: '/workspace',
    title: 'Workspace',
    icon: SquareTerminalIcon,
    description: 'Dev projects, Docker containers, services, ports, and logs on each PC.',
  },
  {
    path: '/router',
    title: 'Router',
    icon: RouterIcon,
    description: 'Per-device usage, priority, blocking, internet lines, and DNS ad blocking.',
  },
  {
    path: '/multilink',
    title: 'Multi-Link',
    icon: CableIcon,
    description: 'Use Wi-Fi, Ethernet, and phone tethering together on a PC.',
  },
  {
    path: '/alerts',
    title: 'Alerts',
    icon: BellIcon,
    description: 'Open and resolved alerts, and alert rules.',
  },
  {
    path: '/settings',
    title: 'Settings',
    icon: SettingsIcon,
    description: 'Telegram alerts, network scan, users, and your account.',
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
