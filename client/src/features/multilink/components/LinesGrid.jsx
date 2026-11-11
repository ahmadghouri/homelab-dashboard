import { NetworkIcon } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { LineCard } from './LineCard';
import { LineSettingsDialog } from './LineSettingsDialog';

// Every line the PC reports, as cards. `data` is the useMultiLink data (settings are saved from it).
export function LinesGrid({ deviceId, data, isAdmin, disabledReason }) {
  const [editingId, setEditingId] = useState(null);
  const lines = data.multilink?.lines ?? [];
  const editing = lines.find((line) => line.id === editingId);

  if (lines.length === 0) {
    return (
      <EmptyState
        icon={NetworkIcon}
        title="No internet lines found"
        description="The PC reports no connected network adapter with an IPv4 address. Connect Wi-Fi, a cable or a phone over USB tethering; new lines show up within 10 seconds."
      />
    );
  }

  return (
    <section aria-labelledby="multilink-lines-title" className="flex flex-col gap-3">
      <h2 id="multilink-lines-title" className="text-base font-semibold">
        Lines ({lines.length})
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
        {lines.map((line) => (
          <LineCard
            key={line.id}
            line={line}
            deviceId={deviceId}
            isAdmin={isAdmin}
            disabledReason={disabledReason}
            onOpenSettings={() => setEditingId(line.id)}
          />
        ))}
      </div>
      {isAdmin && editing && (
        <LineSettingsDialog
          key={editing.id}
          deviceId={deviceId}
          line={editing}
          data={data}
          onOpenChange={(open) => !open && setEditingId(null)}
        />
      )}
    </section>
  );
}
