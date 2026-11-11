import { GaugeIcon, LoaderCircleIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useRunSpeedTest } from '../hooks/useRunSpeedTest';
import { formatMbps } from '../utils';

// `running` comes from the status query, so a test started by the schedule or another user shows too.
export function RunSpeedTestButton({ running }) {
  const runTest = useRunSpeedTest();
  const busy = running || runTest.isPending;

  const handleClick = () => {
    runTest.mutate(undefined, {
      onSuccess: (test) => {
        if (test.success) {
          toast.success(
            `Speed test finished: ${formatMbps(test.downloadMbps)} down, ${formatMbps(test.uploadMbps)} up`,
          );
        } else {
          toast.error(`Speed test failed${test.error ? `: ${test.error}` : ''}`);
        }
      },
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <Button onClick={handleClick} disabled={busy} aria-busy={busy}>
      {busy ? <LoaderCircleIcon className="animate-spin" aria-hidden="true" /> : <GaugeIcon aria-hidden="true" />}
      {busy ? 'Testing speed' : 'Run speed test'}
    </Button>
  );
}
