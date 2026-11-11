import { RouterIcon, ShieldIcon, TriangleAlertIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const ROUTER_USER_COMMANDS = [
  '/user group add name=homelab policy=read,write,api,rest-api',
  '/user add name=homelab group=homelab password=<long-random-password>',
  '/ip service enable www-ssl',
].join('\n');

const ROUTER_ENV = [
  'ROUTER_TYPE=mikrotik',
  'ROUTER_URL=https://192.168.88.1',
  'ROUTER_USER=homelab',
  'ROUTER_PASSWORD=<long-random-password>',
  '# Only when the router uses its own self-signed certificate:',
  'ROUTER_TLS_INSECURE=true',
].join('\n');

const ADGUARD_DOCKER = [
  'docker run -d --name adguardhome --restart unless-stopped \\',
  '  -p 53:53/tcp -p 53:53/udp -p 3000:3000/tcp \\',
  '  -v adguard-work:/opt/adguardhome/work -v adguard-conf:/opt/adguardhome/conf \\',
  '  adguard/adguardhome',
].join('\n');

const ADGUARD_ENV = [
  'ADGUARD_URL=http://192.168.88.2:3000',
  'ADGUARD_USER=<adguard-admin-user>',
  'ADGUARD_PASSWORD=<adguard-admin-password>',
].join('\n');

function CodeBlock({ children }) {
  return (
    <pre className="mt-1.5 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre">
      {children}
    </pre>
  );
}

function Warning({ children }) {
  return (
    <p className="flex items-start gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

function SetupCard({ icon: Icon, title, description, children }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4 text-sm">{children}</CardContent>
    </Card>
  );
}

// Shown when ROUTER_TYPE is none or the ROUTER_* settings are invalid (error).
export function RouterSetupCard({ error }) {
  return (
    <SetupCard
      icon={RouterIcon}
      title="Connect a MikroTik router"
      description="See per-device usage, set priorities, and block devices. Optional; everything else works without it."
    >
      {error && (
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          The router settings in server/.env are not valid: {error}
        </p>
      )}
      <Warning>
        Only connect a router that you own and administer. The dashboard adds queues, an address list, and a
        firewall rule to it.
      </Warning>
      <ol className="flex list-decimal flex-col gap-4 pl-5">
        <li>
          On the router (RouterOS 7), create a dedicated user for the dashboard. Do not use the admin account.
          Turn on the REST API (HTTPS service).
          <CodeBlock>{ROUTER_USER_COMMANDS}</CodeBlock>
        </li>
        <li>
          Add these lines to <code className="font-mono text-xs">server/.env</code> with your router address
          and the new user.
          <CodeBlock>{ROUTER_ENV}</CodeBlock>
        </li>
        <li>Restart the API server, then open this page again.</li>
      </ol>
      <p className="text-muted-foreground">
        Usage needs the device in the Network list with an IP address. Blocking drops its traffic in the
        router&apos;s forward chain; the server running this dashboard can never be blocked.
      </p>
    </SetupCard>
  );
}

// Shown when ADGUARD_URL is empty.
export function DnsSetupCard() {
  return (
    <SetupCard
      icon={ShieldIcon}
      title="Connect AdGuard Home"
      description="Block ads and trackers for the whole network and see DNS stats here. Optional."
    >
      <ol className="flex list-decimal flex-col gap-4 pl-5">
        <li>
          Install AdGuard Home on an always-on PC (installer from adguard.com, or Docker), then finish its
          setup wizard on port 3000.
          <CodeBlock>{ADGUARD_DOCKER}</CodeBlock>
        </li>
        <li>
          In your router&apos;s DHCP settings, set the DNS server to the AdGuard Home IP so every device uses
          it.
        </li>
        <li>
          Add these lines to <code className="font-mono text-xs">server/.env</code> with the AdGuard Home
          address and its admin login.
          <CodeBlock>{ADGUARD_ENV}</CodeBlock>
        </li>
        <li>Restart the API server, then open this page again.</li>
      </ol>
    </SetupCard>
  );
}
