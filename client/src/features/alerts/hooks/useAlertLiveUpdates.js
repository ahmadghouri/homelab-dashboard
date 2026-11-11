import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import { alertKeys } from '../queryKeys';

// Refreshes alert lists and shows a toast for new and resolved alerts. Mounted once in AppLayout.
export function useAlertLiveUpdates() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: alertKeys.lists() });

  useSocketEvent('alert:new', ({ alert }) => {
    refresh();
    const show = alert.severity === 'critical' ? toast.error : toast.warning;
    show(alert.title, { description: alert.message });
  });

  useSocketEvent('alert:resolved', ({ alert }) => {
    refresh();
    toast.success(`Resolved: ${alert.title}`);
  });

  useSocketEvent('alert:updated', refresh);
}
