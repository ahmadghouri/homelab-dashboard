import { TableIcon } from 'lucide-react';
import { useRef } from 'react';
import { Link } from 'react-router';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { networkDeviceName } from '../../utils';
import { KIND_STYLES } from './kindStyles';

function DetailRow({ label, children, mono = false }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={mono ? 'font-mono text-sm break-all' : 'text-sm'}>{children}</dd>
    </div>
  );
}

// Side panel for the selected node. `entry` is { device, kind, reason, isRouter } or null when closed.
export function DeviceDetailsSheet({ entry, onClose }) {
  const device = entry?.device;
  // The map node that opened the panel gets focus back on close, so keyboard users keep their place.
  const returnFocusRef = useRef(null);

  return (
    <Sheet open={Boolean(entry)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className="w-full overflow-y-auto sm:max-w-sm"
        onOpenAutoFocus={() => {
          returnFocusRef.current = document.activeElement;
        }}
        onCloseAutoFocus={(event) => {
          const target = returnFocusRef.current;
          if (target?.isConnected) {
            event.preventDefault();
            target.focus({ preventScroll: true });
          }
        }}
      >
        {device && (
          <>
            <SheetHeader className="pr-12">
              <SheetTitle className="break-words">{networkDeviceName(device)}</SheetTitle>
              <SheetDescription>
                {entry.isRouter ? 'Router (gateway of this network)' : KIND_STYLES[entry.kind].label}
              </SheetDescription>
              <div className="flex flex-wrap gap-2 pt-2">
                <StatusBadge status={device.online ? 'online' : 'offline'} />
                {device.trusted ? (
                  <Badge className="bg-success/15 text-success">Trusted</Badge>
                ) : (
                  <Badge className="bg-warning/15 text-warning">Unknown</Badge>
                )}
                {device.isScanner && <Badge variant="secondary">This server</Badge>}
              </div>
            </SheetHeader>
            <dl className="flex flex-col gap-4 px-4">
              <DetailRow label="IP address" mono>
                {device.ip}
              </DetailRow>
              <DetailRow label="MAC address" mono>
                {device.mac}
              </DetailRow>
              <DetailRow label="Vendor">
                {device.randomizedMac ? 'Private (random) MAC' : (device.vendor ?? 'Unknown vendor')}
              </DetailRow>
              {device.hostname && <DetailRow label="Hostname">{device.hostname}</DetailRow>}
              {!entry.isRouter && (
                <DetailRow label="Kind">
                  {KIND_STYLES[entry.kind].label}
                  <span className="block text-xs text-muted-foreground">{entry.reason}</span>
                </DetailRow>
              )}
              <DetailRow label="Last seen">
                {device.online ? 'Online now' : `${formatRelativeTime(device.lastSeenAt)} (${formatDateTime(device.lastSeenAt)})`}
              </DetailRow>
              {device.firstSeenAt && <DetailRow label="First seen">{formatDateTime(device.firstSeenAt)}</DetailRow>}
            </dl>
            <SheetFooter>
              <Button asChild variant="outline">
                <Link to="/network">
                  <TableIcon aria-hidden="true" />
                  Open in table
                </Link>
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
