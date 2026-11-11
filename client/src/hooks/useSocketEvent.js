import { useEffect, useEffectEvent } from 'react';
import { dashboardSocket } from '@/api/socket';

// Subscribes to a dashboard socket event for as long as the component is mounted.
// The handler always sees the latest props and state without re-subscribing.
export function useSocketEvent(event, handler) {
  const onEvent = useEffectEvent(handler);

  useEffect(() => {
    const listener = (payload) => onEvent(payload);
    dashboardSocket.on(event, listener);
    return () => {
      dashboardSocket.off(event, listener);
    };
  }, [event]);
}
