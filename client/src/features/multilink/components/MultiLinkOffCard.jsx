import { CableIcon, NetworkIcon, PowerOffIcon, SmartphoneIcon, WifiIcon } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CopyButton } from './ConnectionsSummary';

const ENV_LINES = ['MULTILINK=on', '# Optional, these are the defaults:', 'MULTILINK_HTTP_PORT=8080', 'MULTILINK_SOCKS_PORT=1080'].join(
  '\n',
);

const KINDS = {
  wifi: { Icon: WifiIcon, label: 'Wi-Fi' },
  ethernet: { Icon: CableIcon, label: 'Ethernet' },
  tethering: { Icon: SmartphoneIcon, label: 'Phone tethering' },
  other: { Icon: NetworkIcon, label: 'Other' },
};

function DetectedLine({ line }) {
  const { Icon, label } = KINDS[line.kind] ?? KINDS.other;

  return (
    <li className="flex min-w-0 items-center gap-3 rounded-md border px-3 py-2">
      <Icon className="size-5 shrink-0 text-muted-foreground" aria-label={label} role="img" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium" title={line.name}>
          {line.name}
        </span>
        <span className="truncate font-mono text-xs text-muted-foreground">
          {label} · {line.ip}
          {line.up && line.latencyMs != null ? ` · ${Math.round(line.latencyMs)} ms` : ''}
        </span>
      </div>
      <StatusBadge status={line.up ? 'up' : 'down'} />
    </li>
  );
}

function DetectedLines({ multilink }) {
  if (!multilink) {
    return (
      <EmptyState
        icon={NetworkIcon}
        title="No line data yet"
        description="Lines appear when the agent on this PC is connected and reports them (agent version with Multi-Link)."
      />
    );
  }
  if (multilink.lines.length === 0) {
    return (
      <EmptyState
        icon={NetworkIcon}
        title="No internet lines found"
        description="The agent found no connected network adapter with an IPv4 address."
      />
    );
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2" aria-label="Detected lines">
      {multilink.lines.map((line) => (
        <DetectedLine key={line.id} line={line} />
      ))}
    </ul>
  );
}

// Shown when Multi-Link is turned off on the selected PC (or no snapshot arrived yet).
export function MultiLinkOffCard({ multilink }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PowerOffIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          Multi-Link is off on this PC
        </CardTitle>
        <CardDescription>
          The agent only watches the lines. No proxy runs and no traffic is changed. Speed tests and usage resets
          need Multi-Link on.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-6 text-sm">
        <section aria-labelledby="multilink-turn-on" className="flex flex-col gap-3">
          <h3 id="multilink-turn-on" className="font-semibold">
            Turn it on
          </h3>
          <ol className="flex list-decimal flex-col gap-3 pl-5">
            <li className="flex flex-col gap-1.5">
              <span>
                On that PC, add these lines to <code className="font-mono text-xs">agent/.env</code>. Change the ports
                only if 8080 or 1080 are already used.
              </span>
              <div className="flex items-start gap-2">
                <pre className="min-w-0 flex-1 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre select-all">
                  {ENV_LINES}
                </pre>
                <CopyButton value={ENV_LINES} label="Multi-Link settings" />
              </div>
            </li>
            <li>
              Restart the agent (stop it, then run <code className="font-mono text-xs">npm start</code> in the{' '}
              <code className="font-mono text-xs">agent</code> folder). This page updates by itself.
            </li>
            <li>Point Windows or your browser at the proxy. The steps are shown here once it is on.</li>
          </ol>
        </section>

        <section aria-labelledby="multilink-detected" className="flex flex-col gap-3">
          <h3 id="multilink-detected" className="font-semibold">
            Lines found on this PC
          </h3>
          <DetectedLines multilink={multilink} />
        </section>
      </CardContent>
    </Card>
  );
}
