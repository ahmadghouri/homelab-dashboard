import { PageHeader } from '@/components/common/PageHeader';
import { useMe } from '@/features/auth/hooks/useMe';
import { isAdmin } from '@/features/auth/utils';
import { InternetStatCards } from '@/features/internet/components/InternetStatCards';
import { IspReportCard } from '@/features/internet/components/IspReportCard';
import { OutagesCard } from '@/features/internet/components/OutagesCard';
import { QualityCard } from '@/features/internet/components/QualityCard';
import { RunSpeedTestButton } from '@/features/internet/components/RunSpeedTestButton';
import { SpeedHistoryChart } from '@/features/internet/components/SpeedHistoryChart';
import { useInternetStatus } from '@/features/internet/hooks/useInternetStatus';
import { describeSpeedTestSchedule } from '@/features/internet/utils';

export function InternetPage() {
  const { data: user } = useMe();
  const { data: status } = useInternetStatus();

  const description = status
    ? `Each speed test uses about 35 MB of data. ${describeSpeedTestSchedule(status.speedTestIntervalMin)}`
    : 'Connection status, speed and outages.';

  return (
    <>
      <PageHeader
        title="Internet"
        description={description}
        actions={isAdmin(user) && status && <RunSpeedTestButton running={status.speedTestRunning} />}
      />
      <InternetStatCards />
      <SpeedHistoryChart />
      <OutagesCard />
      <QualityCard />
      <IspReportCard />
    </>
  );
}
