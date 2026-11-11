import { CheckIcon, CopyIcon, TriangleAlertIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function CopyBlock({ label, value }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy. Select the text and copy it manually.');
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-start gap-2">
        <pre className="min-w-0 flex-1 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre select-all">
          {value}
        </pre>
        <Button type="button" variant="outline" size="icon" onClick={handleCopy} aria-label={`Copy ${label}`}>
          {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
        </Button>
      </div>
    </div>
  );
}

// Shows a new agent token once, with the exact setup steps for the PC.
export function AgentTokenDialog({ open, onOpenChange, deviceName, token }) {
  const envFile = `SERVER_URL=${window.location.origin}\nAGENT_TOKEN=${token}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect {deviceName}</DialogTitle>
          <DialogDescription>Run the agent on this PC with the settings below.</DialogDescription>
        </DialogHeader>

        <p className="flex items-start gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          This token is shown only once. Copy it now. If you lose it, create a new token from the device menu.
        </p>

        <ol className="flex list-decimal flex-col gap-4 pl-5 text-sm">
          <li>
            <CopyBlock label="Put this in agent/.env" value={envFile} />
            <p className="mt-1.5 text-xs text-muted-foreground">
              On another PC, replace <code>localhost</code> with this computer&apos;s IP address.
            </p>
          </li>
          <li>
            <CopyBlock label="Start the agent" value={'cd agent\nnpm install\nnpm start'} />
          </li>
        </ol>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
