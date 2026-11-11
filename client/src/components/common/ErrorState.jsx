import { RotateCwIcon, TriangleAlertIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ErrorState({ title = 'Something went wrong', message, onRetry, isRetrying = false }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-danger/30 bg-danger/5 p-10 text-center"
    >
      <TriangleAlertIcon className="size-8 text-danger" aria-hidden="true" />
      <div className="flex max-w-sm flex-col gap-1">
        <h2 className="font-medium">{title}</h2>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} disabled={isRetrying}>
          <RotateCwIcon className={isRetrying ? 'animate-spin' : undefined} aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  );
}
