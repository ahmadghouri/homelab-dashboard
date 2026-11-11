import {
  CircleHelpIcon,
  LaptopIcon,
  NetworkIcon,
  PrinterIcon,
  ServerIcon,
  SmartphoneIcon,
  TvIcon,
} from 'lucide-react';

// Icon, color token and singular label per device kind.
export const KIND_STYLES = {
  computer: { Icon: LaptopIcon, color: 'var(--chart-1)', label: 'Computer' },
  phone: { Icon: SmartphoneIcon, color: 'var(--chart-2)', label: 'Phone' },
  printer: { Icon: PrinterIcon, color: 'var(--chart-4)', label: 'Printer' },
  media: { Icon: TvIcon, color: 'var(--chart-5)', label: 'TV / media' },
  network: { Icon: NetworkIcon, color: 'var(--foreground)', label: 'Network gear' },
  server: { Icon: ServerIcon, color: 'var(--chart-3)', label: 'Server' },
  unknown: { Icon: CircleHelpIcon, color: 'var(--muted-foreground)', label: 'Unknown kind' },
};
