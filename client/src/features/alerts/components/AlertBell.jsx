import { BellIcon } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { useOpenAlertCount } from '../hooks/useAlerts';

const MAX_SHOWN = 99;

export function AlertBell() {
  const count = useOpenAlertCount();
  const label = count === 0 ? 'Alerts, none open' : `Alerts, ${count} open`;

  return (
    <Button asChild variant="ghost" size="icon" className="relative">
      <Link to="/alerts" aria-label={label}>
        <BellIcon aria-hidden="true" />
        {count > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white tabular-nums"
          >
            {count > MAX_SHOWN ? `${MAX_SHOWN}+` : count}
          </span>
        )}
      </Link>
    </Button>
  );
}
