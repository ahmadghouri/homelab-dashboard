import { useEffect } from 'react';

// Must match the channel name used by the Drive accounts page (useConnectDrivePopup).
const CONNECT_CHANNEL = 'homelab-drive-connect';

// Google sends the admin back here (in the popup) after connecting a Drive account.
// It tells the page that opened the popup, then closes itself.
export function DriveConnectedPage() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status') === 'success' ? 'success' : 'error';
  const message = params.get('message') ?? '';

  useEffect(() => {
    const result = { type: 'drive:connected', status, message };

    // Google's sign-in pages can cut the link to the opener (Cross-Origin-Opener-Policy),
    // so the result also goes over a same-origin BroadcastChannel.
    if (typeof BroadcastChannel === 'function') {
      const channel = new BroadcastChannel(CONNECT_CHANNEL);
      channel.postMessage(result);
      channel.close();
    }
    if (window.opener) {
      // The target origin limits the message to our own app.
      window.opener.postMessage(result, window.location.origin);
    }
    window.close();
  }, [status, message]);

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6 text-center text-foreground">
      <p>
        {status === 'success'
          ? 'Drive account connected. You can close this window.'
          : `Could not connect the account. ${message}`}
      </p>
    </main>
  );
}
