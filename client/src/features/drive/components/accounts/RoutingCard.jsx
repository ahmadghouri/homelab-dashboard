import { toast } from 'sonner';
import { ErrorState } from '@/components/common/ErrorState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccountMutations, useRouting } from '@/features/drive/hooks/useDriveAccounts';
import { ROUTING_MODES } from '@/features/drive/queryKeys';

// Chooses which connected account receives each new upload.
export function RoutingCard() {
  const { data, isPending, isError, error, refetch, isRefetching } = useRouting();
  const { setRouting } = useAccountMutations();

  const change = (mode) =>
    setRouting.mutate(mode, {
      onSuccess: () => toast.success(`Uploads now use: ${ROUTING_MODES.find((item) => item.value === mode).label}`),
      onError: (mutationError) => toast.error(mutationError.message),
    });

  let content;
  if (isPending) {
    content = <Skeleton className="h-40 w-full" />;
  } else if (isError) {
    content = <ErrorState message={error.message} onRetry={() => refetch()} isRetrying={isRefetching} />;
  } else {
    const current = setRouting.isPending ? setRouting.variables : data.mode;
    content = (
      <fieldset disabled={setRouting.isPending} className="flex flex-col gap-2">
        <legend className="sr-only">Upload routing</legend>
        {ROUTING_MODES.map((mode) => (
          <label
            key={mode.value}
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm has-checked:border-primary/40 has-checked:bg-primary/5 has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
          >
            <input
              type="radio"
              name="drive-routing"
              value={mode.value}
              checked={current === mode.value}
              onChange={() => change(mode.value)}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{mode.label}</span>
              <span className="text-muted-foreground">{mode.description}</span>
            </span>
          </label>
        ))}
        <p className="text-xs text-muted-foreground">
          Only connected accounts with Accept uploads on and enough free space are used.
        </p>
      </fieldset>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload routing</CardTitle>
        <CardDescription>Which account a new upload goes to.</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
