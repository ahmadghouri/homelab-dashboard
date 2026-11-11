import { AlertTriangleIcon, CheckCircle2Icon, CircleHelpIcon, XCircleIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// One place that maps a status to color, icon, and default label.
// Always shows text + icon, never color alone (accessibility).
const TONES = {
  success: { className: 'bg-success/15 text-success', Icon: CheckCircle2Icon },
  warning: { className: 'bg-warning/15 text-warning', Icon: AlertTriangleIcon },
  danger: { className: 'bg-danger/15 text-danger', Icon: XCircleIcon },
  info: { className: 'bg-info/15 text-info', Icon: CircleHelpIcon },
};

const STATUSES = {
  online: { tone: 'success', label: 'Online' },
  up: { tone: 'success', label: 'Up' },
  ok: { tone: 'success', label: 'OK' },
  warning: { tone: 'warning', label: 'Warning' },
  offline: { tone: 'danger', label: 'Offline' },
  down: { tone: 'danger', label: 'Down' },
  critical: { tone: 'danger', label: 'Critical' },
  unknown: { tone: 'info', label: 'Unknown' },
};

export function StatusBadge({ status, children, className }) {
  const { tone, label } = STATUSES[status] ?? STATUSES.unknown;
  const { className: toneClassName, Icon } = TONES[tone];

  return (
    <Badge className={cn(toneClassName, className)}>
      <Icon aria-hidden="true" />
      {children ?? label}
    </Badge>
  );
}
