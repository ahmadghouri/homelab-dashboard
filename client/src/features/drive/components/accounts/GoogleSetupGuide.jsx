import { CheckIcon, CopyIcon, HardDriveIcon, TriangleAlertIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const ENV_LINES = [
  'GOOGLE_CLIENT_ID=<client-id>.apps.googleusercontent.com',
  'GOOGLE_CLIENT_SECRET=<client-secret>',
].join('\n');

function CodeBlock({ children }) {
  return (
    <pre className="mt-1.5 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre">
      {children}
    </pre>
  );
}

function Path({ children }) {
  return <span className="font-medium text-foreground">{children}</span>;
}

function CopyValue({ value, label }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy. Select the text and copy it by hand.');
    }
  };

  return (
    <div className="mt-1.5 flex min-w-0 items-center gap-2 rounded-md bg-muted py-1 pr-1 pl-3">
      <code className="min-w-0 flex-1 font-mono text-xs break-all">{value}</code>
      <Button variant="ghost" size="icon-sm" onClick={copy} aria-label={copied ? `${label} copied` : `Copy ${label}`}>
        {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
      </Button>
    </div>
  );
}

// Shown on /drive/accounts while GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set on the server.
export function GoogleSetupGuide({ redirectUri }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDriveIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          Set up Google Drive
        </CardTitle>
        <CardDescription>
          Google needs an OAuth client before you can connect Drive accounts. This takes about five minutes in the
          Google Cloud Console and is done once.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4 text-sm">
        <ol className="flex list-decimal flex-col gap-4 pl-5">
          <li>
            Open{' '}
            <a
              href="https://console.cloud.google.com/"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline underline-offset-4"
            >
              console.cloud.google.com
            </a>{' '}
            and create a new project (project picker at the top, then <Path>New project</Path>). Any name works,
            for example &quot;Homelab Drive&quot;.
          </li>
          <li>
            Go to <Path>APIs &amp; Services &gt; Library</Path>, search for <Path>Google Drive API</Path> and click{' '}
            <Path>Enable</Path>.
          </li>
          <li>
            Go to <Path>APIs &amp; Services &gt; OAuth consent screen</Path>. Choose user type{' '}
            <Path>External</Path>, enter an app name (for example &quot;Homelab Dashboard&quot;), a user support
            email and a developer contact email, then save. While the app is in <Path>Testing</Path>, add every
            Google account you want to connect (yourself first) under <Path>Test users</Path>.
          </li>
          <li>
            Go to <Path>APIs &amp; Services &gt; Credentials</Path>, click{' '}
            <Path>Create credentials &gt; OAuth client ID</Path> and pick application type{' '}
            <Path>Web application</Path>. Under <Path>Authorized redirect URIs</Path> add exactly this value:
            {redirectUri ? (
              <CopyValue value={redirectUri} label="redirect URI" />
            ) : (
              <p className="mt-1.5 text-muted-foreground">The server did not report a redirect URI.</p>
            )}
          </li>
          <li>
            Click <Path>Create</Path>, then copy the <Path>Client ID</Path> and <Path>Client secret</Path> into{' '}
            <code className="font-mono text-xs">server/.env</code>:
            <CodeBlock>{ENV_LINES}</CodeBlock>
          </li>
          <li>Restart the API server, then open this page again.</li>
        </ol>
        <p className="flex items-start gap-2 rounded-md bg-warning/10 px-3 py-2 text-warning">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            While the consent screen is in Testing, Google expires the refresh tokens after 7 days, so accounts
            need a Reconnect every week. Publish the app (OAuth consent screen &gt; Publish app) to avoid this.
          </span>
        </p>
        <p className="text-muted-foreground">
          The dashboard only asks for access to files it creates itself (drive.file). It cannot see anything else
          in the connected Google Drives, and files are never made public on Google.
        </p>
      </CardContent>
    </Card>
  );
}
