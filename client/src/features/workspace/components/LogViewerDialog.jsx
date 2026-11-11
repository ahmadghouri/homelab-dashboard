import { ArrowDownIcon, CopyIcon, FileTextIcon, RotateCwIcon, TriangleAlertIcon } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useWorkspaceLogs } from '../hooks/useWorkspaceLogs';

// Same words the agent counts as errors; "ERR!" (npm) has no word boundary after "!".
const ERROR_PATTERN = /\b(error|exception|fatal|unhandled|failed)\b|ERR!/i;
// Distance from the bottom (px) that still counts as "at the bottom".
const BOTTOM_THRESHOLD_PX = 24;

const TARGET_LABELS = { project: 'Project', container: 'Container' };

function isErrorLine(line) {
  return line.stream === 'stderr' || ERROR_PATTERN.test(line.text);
}

function formatLineTime(ts) {
  return ts ? new Date(ts).toLocaleTimeString(undefined, { hour12: false }) : null;
}

function linesToText(lines) {
  return lines.map((line) => (line.ts ? `[${line.ts}] ${line.text}` : line.text)).join('\n');
}

function LogLines({ lines }) {
  const scrollRef = useRef(null);
  // Follow new lines only while the user is at the bottom; a ref so scrolling does not re-render.
  const followRef = useRef(true);
  const [following, setFollowing] = useState(true);

  const scrollToBottom = () => {
    const element = scrollRef.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  };

  // Sync with the DOM after new lines render, before paint (no visible jump).
  useLayoutEffect(() => {
    if (followRef.current) {
      scrollToBottom();
    }
  }, [lines]);

  const handleScroll = (event) => {
    const element = event.currentTarget;
    const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight <= BOTTOM_THRESHOLD_PX;
    followRef.current = atBottom;
    if (atBottom !== following) {
      setFollowing(atBottom);
    }
  };

  const handleJumpToLatest = () => {
    followRef.current = true;
    setFollowing(true);
    scrollToBottom();
  };

  return (
    <div className="relative min-h-0">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-label="Log lines"
        aria-live="off"
        tabIndex={0}
        className="h-[55dvh] overflow-auto rounded-md border bg-muted/40 p-2 font-mono text-xs leading-relaxed outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-[60dvh]"
      >
        {lines.map((line, index) => {
          const time = formatLineTime(line.ts);
          return (
            // Lines are plain text without state, so the index is a safe key here.
            <div
              key={index}
              className={cn(
                'break-all whitespace-pre-wrap',
                isErrorLine(line) ? 'text-danger' : 'text-foreground',
              )}
            >
              {time && (
                <span className="mr-2 text-muted-foreground select-none" title={line.ts}>
                  {time}
                </span>
              )}
              {line.text || ' '}
            </div>
          );
        })}
      </div>
      {!following && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={handleJumpToLatest}
          className="absolute right-3 bottom-3 shadow-md"
        >
          <ArrowDownIcon aria-hidden="true" />
          Latest
        </Button>
      )}
    </div>
  );
}

function LogContent({ query, lines, errorsOnly }) {
  const { data, isPending, isError, error, refetch, isRefetching } = query;

  if (isPending) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading logs">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-11/12" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-5 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Could not load the logs"
        message={error.message}
        onRetry={() => refetch()}
        isRetrying={isRefetching}
      />
    );
  }

  // The agent answered but refused (control turned off, unknown id, Docker error, ...).
  if (data.ok === false) {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-md border border-warning/30 bg-warning/10 p-4 text-sm"
      >
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <p className="min-w-0 break-words">{data.output || 'The PC did not return any logs.'}</p>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <EmptyState
        icon={FileTextIcon}
        title={errorsOnly ? 'No error lines' : 'No log lines yet'}
        description={
          errorsOnly
            ? 'Nothing in the recent output looks like an error.'
            : 'Output appears here once the process writes to stdout or stderr.'
        }
      />
    );
  }

  return <LogLines lines={lines} />;
}

// Mounted only while the dialog is open, so switches and scroll state reset on every open.
function LogViewerBody({ deviceId, target, id, name }) {
  const errorsSwitchId = useId();
  const refreshSwitchId = useId();
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Disabled when auto refresh is off: the cached lines stay, "Refresh" fetches on demand.
  const query = useWorkspaceLogs({ deviceId, target, id, enabled: autoRefresh });
  const allLines = query.data?.ok === false ? [] : (query.data?.lines ?? []);
  const errorCount = allLines.filter(isErrorLine).length;
  const visibleLines = errorsOnly ? allLines.filter(isErrorLine) : allLines;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(linesToText(visibleLines));
      toast.success(`Copied ${visibleLines.length} ${visibleLines.length === 1 ? 'line' : 'lines'}`);
    } catch {
      toast.error('Could not copy. Select the text and copy it manually.');
    }
  };

  return (
    <>
      <DialogHeader className="pr-8">
        <DialogTitle className="truncate">Logs: {name || id}</DialogTitle>
        <DialogDescription>
          {TARGET_LABELS[target] ?? 'Process'} output from the PC, newest at the bottom. Logs can contain secrets, so
          share them with care.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex items-center gap-2">
            <Switch id={errorsSwitchId} checked={errorsOnly} onCheckedChange={setErrorsOnly} />
            <Label htmlFor={errorsSwitchId}>Errors only</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id={refreshSwitchId} checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            <Label htmlFor={refreshSwitchId}>Auto refresh</Label>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <RotateCwIcon className={query.isFetching ? 'animate-spin' : undefined} aria-hidden="true" />
            Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={visibleLines.length === 0}
          >
            <CopyIcon aria-hidden="true" />
            Copy
          </Button>
        </div>
      </div>

      <LogContent query={query} lines={visibleLines} errorsOnly={errorsOnly} />

      {allLines.length > 0 && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {errorsOnly ? `${visibleLines.length} of ${allLines.length} lines` : `${allLines.length} lines`}
          {' · '}
          <span className={errorCount > 0 ? 'text-danger' : undefined}>
            {errorCount} {errorCount === 1 ? 'error' : 'errors'}
          </span>
          {autoRefresh ? ' · refreshing every 3 s' : ' · auto refresh paused'}
        </p>
      )}
    </>
  );
}

export function LogViewerDialog({ deviceId, target, id, name, open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[95dvh] flex-col gap-3 overflow-y-auto sm:max-w-4xl">
        {open && (
          <LogViewerBody key={`${deviceId}:${target}:${id}`} deviceId={deviceId} target={target} id={id} name={name} />
        )}
      </DialogContent>
    </Dialog>
  );
}
