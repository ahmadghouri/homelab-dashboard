import { WifiOffIcon } from 'lucide-react';
import { DataTable } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/format';
import { useOutages } from '../hooks/useOutages';
import { formatOutageDuration } from '../utils';

const COLUMNS = [
  {
    accessorKey: 'startedAt',
    header: 'Started',
    cell: ({ getValue }) => <span className="whitespace-nowrap">{formatDateTime(getValue())}</span>,
  },
  {
    accessorKey: 'endedAt',
    header: 'Ended',
    enableSorting: false,
    cell: ({ getValue }) =>
      getValue() ? (
        <span className="whitespace-nowrap">{formatDateTime(getValue())}</span>
      ) : (
        <StatusBadge status="offline">Ongoing</StatusBadge>
      ),
  },
  {
    accessorKey: 'durationSec',
    header: 'Duration',
    cell: ({ getValue }) => <span className="tabular-nums">{formatOutageDuration(getValue())}</span>,
    meta: { className: 'text-right' },
  },
];

const PAGE_SIZE = 10;

export function OutagesCard() {
  const { data: outages, isPending, isError, error, refetch, isRefetching } = useOutages();

  let content;
  if (isPending) {
    content = <Skeleton className="h-40 w-full" />;
  } else if (isError) {
    content = <ErrorState message={error.message} onRetry={() => refetch()} isRetrying={isRefetching} />;
  } else if (outages.length === 0) {
    content = (
      <EmptyState
        icon={WifiOffIcon}
        title="No outages recorded"
        description="An outage is saved when two connectivity checks in a row fail (checked every 30 seconds)."
      />
    );
  } else {
    content = (
      <DataTable
        columns={COLUMNS}
        data={outages}
        getRowId={(outage) => outage.id}
        initialSorting={[{ id: 'startedAt', desc: true }]}
        pageSize={PAGE_SIZE}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Outages</CardTitle>
        <CardDescription>Most recent times the internet connection was down</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
