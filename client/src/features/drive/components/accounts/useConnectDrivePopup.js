import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAccountMutations, useRefreshDriveAccounts } from '@/features/drive/hooks/useDriveAccounts';

const POPUP_NAME = 'homelab-drive-connect';
const POPUP_FEATURES = 'popup,width=520,height=680';
const MESSAGE_TYPE = 'drive:connected';
// DriveConnectedPage posts to window.opener. Google's sign-in pages can cut the opener link
// (Cross-Origin-Opener-Policy), so the same message on a same-origin BroadcastChannel is accepted too.
const CHANNEL_NAME = 'homelab-drive-connect';
const CLOSED_POLL_MS = 700;
const RESULT_TOAST_ID = 'drive-connect-result';

// Opens the Google consent screen in a popup and reports the result sent back by /drive/connected.
export function useConnectDrivePopup() {
  const { connectUrl } = useAccountMutations();
  const refreshAccounts = useRefreshDriveAccounts();
  const [isConnecting, setIsConnecting] = useState(false);
  const popupRef = useRef(null);
  const timerRef = useRef(null);

  const handleResult = useEffectEvent((data) => {
    if (data?.type !== MESSAGE_TYPE) {
      return;
    }
    // The same result can arrive twice (postMessage and BroadcastChannel); one toast id
    // makes the second delivery update the first toast instead of stacking a copy.
    if (data.status === 'success') {
      toast.success('Google Drive account connected', { id: RESULT_TOAST_ID });
    } else {
      toast.error(data.message ? `Could not connect: ${data.message}` : 'Could not connect the account', {
        id: RESULT_TOAST_ID,
      });
    }
    setIsConnecting(false);
    refreshAccounts();
  });

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin === window.location.origin) {
        handleResult(event.data);
      }
    };
    window.addEventListener('message', onMessage);
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME);
    if (channel) {
      channel.onmessage = (event) => handleResult(event.data);
    }

    return () => {
      window.removeEventListener('message', onMessage);
      channel?.close();
      clearInterval(timerRef.current);
    };
  }, []);

  // Must run straight from the click handler: browsers only allow popups opened synchronously.
  const connect = () => {
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.focus();
      return;
    }
    const popup = window.open('', POPUP_NAME, POPUP_FEATURES);
    if (!popup) {
      toast.error('The popup was blocked. Allow popups for this site and try again.');
      return;
    }
    popupRef.current = popup;
    setIsConnecting(true);
    try {
      popup.document.title = 'Connecting Google Drive';
      popup.document.body.textContent = 'Opening Google...';
    } catch {
      // The blank popup is same-origin; nothing to do if the browser refuses anyway.
    }

    connectUrl.mutateAsync().then(
      (url) => {
        if (!popup.closed) {
          popup.location.href = url;
        }
      },
      (error) => {
        popup.close();
        toast.error(error.message);
      },
    );

    // When the popup closes (done, cancelled, or cut off from us), stop waiting and refetch.
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (popup.closed) {
        clearInterval(timerRef.current);
        popupRef.current = null;
        setIsConnecting(false);
        refreshAccounts();
      }
    }, CLOSED_POLL_MS);
  };

  return { connect, isConnecting };
}
