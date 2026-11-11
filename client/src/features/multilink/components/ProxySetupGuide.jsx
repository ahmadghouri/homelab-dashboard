import { BookOpenIcon, InfoIcon, TriangleAlertIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProxyAddress } from './ConnectionsSummary';

const LIMITS = [
  {
    title: 'One connection uses one line.',
    text: 'Speed adds up only across many connections (many tabs, several downloads, a download manager that splits files). A single video, a video call, or a download that uses one connection is not faster.',
  },
  {
    title: 'Websites may see different IP addresses.',
    text: 'Each line has its own public IP. Some sites (banking, logins, streaming) dislike that. Sticky mode keeps the same line per website for 10 minutes.',
  },
  {
    title: 'Only apps that use the proxy are balanced.',
    text: 'Games, most video call apps, Windows Update, and apps that ignore the Windows proxy still use the normal Windows route (one line).',
  },
  {
    title: 'Phone tethering uses mobile data.',
    text: 'Set a data cap on that line or give it the Backup role so it is used only when the other lines are down. Tethering lines start as Backup.',
  },
  {
    title: 'The agent must keep running.',
    text: 'If the agent stops, apps set to the proxy cannot reach the internet. Turn the Windows proxy off again to browse without it.',
  },
];

function Step({ title, children }) {
  return (
    <li className="flex flex-col gap-1.5">
      <span className="font-medium">{title}</span>
      <div className="flex flex-col gap-2 text-muted-foreground">{children}</div>
    </li>
  );
}

function Path({ children }) {
  return <span className="font-medium text-foreground">{children}</span>;
}

// How to send apps through the Multi-Link proxy, and what it can and cannot do.
export function ProxySetupGuide({ httpPort = 8080, socksPort = 1080 }) {
  const httpAddress = `127.0.0.1:${httpPort}`;
  const socksAddress = `127.0.0.1:${socksPort}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpenIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          How to use Multi-Link
        </CardTitle>
        <CardDescription>
          The agent runs a proxy on this PC that spreads new connections over every working line. Apps must be
          told to use it.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-6 text-sm lg:grid-cols-2">
        <section aria-labelledby="multilink-setup-steps" className="flex min-w-0 flex-col gap-3">
          <h3 id="multilink-setup-steps" className="font-semibold">
            Set up
          </h3>
          <ol className="flex list-decimal flex-col gap-4 pl-5">
            <Step title="Connect more than one line">
              <p>
                Use Wi-Fi plus Ethernet, or add a phone with a USB cable and turn on USB tethering on the phone. One
                Wi-Fi card can join only one Wi-Fi network at a time, so a second Wi-Fi line needs a second adapter.
              </p>
              <p>Each line appears on this page by itself. Check that it shows as Up.</p>
            </Step>
            <Step title="Set the Windows proxy">
              <p>
                Open <Path>Settings &gt; Network &amp; internet &gt; Proxy</Path>. Under{' '}
                <Path>Manual proxy setup</Path> select <Path>Set up</Path>, turn on <Path>Use a proxy server</Path>,
                enter address <Path>127.0.0.1</Path> and port <Path>{httpPort}</Path>, tick{' '}
                <Path>Don&apos;t use the proxy server for local (intranet) addresses</Path>, and save.
              </p>
              <ProxyAddress label="HTTP proxy" address={httpAddress} />
            </Step>
            <Step title="Browsers">
              <p>
                <Path>Chrome</Path> and <Path>Edge</Path> follow the Windows proxy, nothing else to do.
              </p>
              <p>
                <Path>Firefox</Path> has its own setting: <Path>Settings &gt; General &gt; Network Settings</Path>.
                Choose <Path>Use system proxy settings</Path>, or <Path>Manual proxy configuration</Path> with HTTP
                proxy {httpAddress} (also for HTTPS), or SOCKS host {socksAddress} with <Path>SOCKS v5</Path> and{' '}
                <Path>Proxy DNS when using SOCKS v5</Path>.
              </p>
              <ProxyAddress label="SOCKS5 proxy" address={socksAddress} />
            </Step>
            <Step title="Download managers">
              <p>
                <Path>IDM</Path> uses the Windows proxy by default (<Path>Options &gt; Proxy / Socks</Path>, use
                system settings). It splits each file into several connections, so the parts are spread over the
                lines. Other apps with a proxy setting can use the HTTP or SOCKS5 address above.
              </p>
            </Step>
          </ol>
        </section>

        <section aria-labelledby="multilink-limits" className="flex min-w-0 flex-col gap-3">
          <h3 id="multilink-limits" className="font-semibold">
            Limits
          </h3>
          <p className="flex items-start gap-2 rounded-md bg-info/10 px-3 py-2 text-info">
            <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Multi-Link does not merge lines into one faster line. It gives each new connection to a different line.
            </span>
          </p>
          <ul className="flex flex-col gap-3">
            {LIMITS.map(({ title, text }) => (
              <li key={title} className="flex items-start gap-2">
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                <span>
                  <span className="font-medium">{title}</span>{' '}
                  <span className="text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}
