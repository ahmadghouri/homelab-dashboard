import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { compareIp, networkDeviceName } from '../../utils';
import { DeviceDetailsSheet } from './DeviceDetailsSheet';
import { DEVICE_KINDS, findRouterDevice, guessDeviceKind } from './deviceKind';
import { TopologyLegend } from './TopologyLegend';
import { TopologyMap } from './TopologyMap';
import { TopologyToolbar } from './TopologyToolbar';

function matchesSearch(device, term) {
  return [networkDeviceName(device), device.ip, device.mac, device.vendor, device.hostname]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(term));
}

const kindOrder = (kind) => DEVICE_KINDS.indexOf(kind);

// The whole map card: filters, the SVG map, the legend and the details panel.
// devices and scan come straight from useNetworkDevices(), so live updates flow through.
export function NetworkTopology({ devices, scan }) {
  const [search, setSearch] = useState('');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [hiddenKinds, setHiddenKinds] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const routerDevice = findRouterDevice(devices, scan.subnet);
  const router = routerDevice ? { device: routerDevice } : null;

  // Sorted by kind first, so the layout gives every kind its own wedge of the map.
  const all = devices
    .filter((device) => device.id !== routerDevice?.id)
    .map((device) => ({ device, ...guessDeviceKind(device) }))
    .sort((a, b) => kindOrder(a.kind) - kindOrder(b.kind) || compareIp(a.device.ip, b.device.ip));

  const kindCounts = {};
  for (const entry of all) {
    if (!onlineOnly || entry.device.online) {
      kindCounts[entry.kind] = (kindCounts[entry.kind] ?? 0) + 1;
    }
  }
  const visible = all.filter((entry) => !hiddenKinds.includes(entry.kind) && (!onlineOnly || entry.device.online));

  const term = search.trim().toLowerCase();
  const matchIds = term
    ? new Set(visible.filter((entry) => matchesSearch(entry.device, term)).map((entry) => entry.device.id))
    : null;

  let selected = null;
  if (selectedId && selectedId === routerDevice?.id) {
    selected = { device: routerDevice, isRouter: true };
  } else if (selectedId) {
    selected = all.find((entry) => entry.device.id === selectedId) ?? null;
  }

  const toggleKind = (kind) =>
    setHiddenKinds((current) => (current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind]));

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <TopologyToolbar
          search={search}
          onSearchChange={setSearch}
          onlineOnly={onlineOnly}
          onOnlineOnlyChange={setOnlineOnly}
          kindCounts={kindCounts}
          hiddenKinds={hiddenKinds}
          onToggleKind={toggleKind}
          matchCount={matchIds ? matchIds.size : null}
        />
        <div className="relative">
          <TopologyMap
            router={router}
            entries={visible}
            selectedId={selectedId}
            matchIds={matchIds}
            onSelect={setSelectedId}
          />
          {visible.length === 0 && (
            <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-sm text-muted-foreground">
              No devices match the filters.
            </p>
          )}
        </div>
        <TopologyLegend />
      </CardContent>
      <DeviceDetailsSheet entry={selected} onClose={() => setSelectedId(null)} />
    </Card>
  );
}
