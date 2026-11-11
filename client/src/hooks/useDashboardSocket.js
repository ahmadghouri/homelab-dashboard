import { useEffect } from 'react';
import { dashboardSocket } from '@/api/socket';

// Keeps the live connection open while the component that calls it is mounted
// (AppLayout, so only for logged-in users).
export function useDashboardSocket() {
  useEffect(() => {
    dashboardSocket.connect();
    return () => {
      dashboardSocket.disconnect();
    };
  }, []);
}
