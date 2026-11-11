import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  CopyIcon,
  NetworkIcon,
  PlugZapIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBitsPerSecond } from '@/lib/format';

const DEFAULT_HTTP_PORT = 8080;
const DEFAULT_SOCKS_PORT = 1080;

// Small icon button that copies a value and shows a check mark for 2 seconds.
export function CopyButton({ value, label }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy. Select the text and copy it manually.');
    }
  };

  return (
    <Button type="button" variant="outline" size="icon" onClick={handleCopy} aria-label={`Copy ${label}`}>
      {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
    </Button>
  );
}

// One proxy address with its copy button, for example "HTTP proxy 127.0.0.1:8080".
export function ProxyAddress({ label, address }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-md border px-3 py-2">
      <div className="flex min-w-0 flex-col">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="truncate font-mono text-sm font-medium select-all">{address}</span>
      </div>
      <CopyButton value={address} label={`${label} address`} />
    </div>
  );
}

// Totals, lines up, and the proxy addresses for a PC with Multi-Link turned on.
export function ConnectionsSummary({ multilink }) {
  const lines = multilink?.lines ?? [];
  const totals = multilink?.totals;
  const proxy = multilink?.proxy;
  const isLoading = !multilink;
  const linesUp = lines.filter((line) => line.up).length;
  const activeUp = lines.filter((line) => line.up && line.role === 'active').length;
  const httpAddress = `127.0.0.1:${proxy?.httpPort ?? DEFAULT_HTTP_PORT}`;
  const socksAddress = `127.0.0.1:${proxy?.socksPort ?? DEFAULT_SOCKS_PORT}`;

  let proxyStatus = null;
  if (proxy) {
    proxyStatus = proxy.listening ? (
      <StatusBadge status="ok">Running</StatusBadge>
    ) : (
      <StatusBadge status="down">Not running</StatusBadge>
    );
  }

  return (
    <section aria-label="Connections summary" className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          title="Download"
          icon={ArrowDownIcon}
          value={formatBitsPerSecond(totals?.rxBps)}
          description="All lines together"
          isLoading={isLoading}
        />
        <StatCard
          title="Upload"
          icon={ArrowUpIcon}
          value={formatBitsPerSecond(totals?.txBps)}
          description="All lines together"
          isLoading={isLoading}
        />
        <StatCard
          title="Connections"
          icon={PlugZapIcon}
          value={totals?.connections ?? 0}
          description="Open through the proxy"
          isLoading={isLoading}
        />
        <StatCard
          title="Lines up"
          icon={NetworkIcon}
          value={`${linesUp} of ${lines.length}`}
          description={`${activeUp} active ${activeUp === 1 ? 'line' : 'lines'} in use`}
          isLoading={isLoading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Proxy on this PC</CardTitle>
          <CardDescription>
            Point apps at one of these addresses. They only work on this PC (the proxy listens on 127.0.0.1).
          </CardDescription>
          {proxyStatus && <CardAction>{proxyStatus}</CardAction>}
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <ProxyAddress label="HTTP proxy" address={httpAddress} />
            <ProxyAddress label="SOCKS5 proxy" address={socksAddress} />
          </div>
          {proxy?.error && (
            <p role="alert" className="flex items-start gap-2 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 wrap-break-word">
                {proxy.error.replace(/\.$/, '')}. Free the port or set another one with MULTILINK_HTTP_PORT / MULTILINK_SOCKS_PORT in
                agent/.env, then restart the agent.
              </span>
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
