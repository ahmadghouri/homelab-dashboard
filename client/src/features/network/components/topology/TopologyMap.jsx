import { LocateFixedIcon, RouterIcon, ZoomInIcon, ZoomOutIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { networkDeviceName } from '../../utils';
import { layoutTopology, ROUTER_RADIUS } from './layout';
import { DeviceTooltipBody, nodeLabel, TopologyNode } from './TopologyNode';
import { useApplyAnchor, useMapViewport } from './useMapViewport';

const DEFAULT_ASPECT = 1.5;

function RouterNode({ router, selected, onSelect }) {
  const device = router?.device;
  const name = device ? networkDeviceName(device) : 'Router';
  const label = device ? nodeLabel(device, 18) : 'Router';
  const body = (
    <>
      <circle
        r={ROUTER_RADIUS + 8}
        fill="none"
        stroke="var(--ring)"
        strokeWidth={3}
        className="opacity-0 group-focus-visible:opacity-100"
      />
      <circle r={ROUTER_RADIUS} fill="var(--primary)" stroke={selected ? 'var(--info)' : 'var(--border)'} strokeWidth={selected ? 3 : 2} />
      <RouterIcon x={-13} y={-13} width={26} height={26} color="var(--primary-foreground)" aria-hidden="true" />
      <text
        y={ROUTER_RADIUS + 16}
        textAnchor="middle"
        fontSize={12}
        fontWeight={600}
        fill="var(--foreground)"
        style={{ paintOrder: 'stroke', stroke: 'var(--card)', strokeWidth: 3 }}
      >
        {label}
      </text>
      <text y={ROUTER_RADIUS + 29} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)" className="font-mono">
        {device ? device.ip : 'not found in scan'}
      </text>
    </>
  );

  // Without a matching device the router is only a drawing, not a control.
  if (!device) {
    return (
      <g role="img" aria-label="Router (not found in the scan)">
        {body}
      </g>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <g
          role="button"
          tabIndex={0}
          aria-label={`Router ${name}, ${device.ip}`}
          aria-pressed={selected}
          className="group cursor-pointer outline-none"
          onClick={() => onSelect(device.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect(device.id);
            }
          }}
        >
          {body}
        </g>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-72">
        <DeviceTooltipBody device={device} kindLabel="Router (gateway)" />
      </TooltipContent>
    </Tooltip>
  );
}

// Interactive SVG map: router in the middle, devices on rings, link lines, zoom and pan controls.
// entries: [{ device, kind }] in display order. matchIds: Set of ids matching the search, or null.
export function TopologyMap({ router, entries, selectedId, matchIds, onSelect }) {
  const viewport = useMapViewport();
  const layout = layoutTopology(
    entries.map(({ device }) => ({ id: device.id })),
    viewport.aspect ?? DEFAULT_ASPECT,
  );
  const positions = new Map(layout.nodes.map((node) => [node.id, node]));
  const view = viewport.measure(layout.width, layout.height);
  useApplyAnchor(viewport, view?.width, view?.height);

  const viewBox = view
    ? `${-view.width / view.scale / 2} ${-view.height / view.scale / 2} ${view.width / view.scale} ${view.height / view.scale}`
    : undefined;

  return (
    <div className="relative">
      <div
        ref={viewport.containerRef}
        {...viewport.panHandlers}
        className="h-[clamp(420px,calc(100svh-9rem),900px)] w-full cursor-grab [contain:inline-size] overflow-auto overscroll-contain rounded-lg border bg-card select-none data-[dragging=true]:cursor-grabbing"
      >
        {view && (
          <svg
            width={view.width}
            height={view.height}
            viewBox={viewBox}
            role="group"
            aria-label={`Network map with ${entries.length} devices around the router`}
            className="block"
          >
            {layout.rings.map((ring) => (
              <ellipse
                key={ring.rx}
                rx={ring.rx}
                ry={ring.ry}
                fill="none"
                stroke="var(--border)"
                strokeDasharray="2 6"
              />
            ))}
            <g aria-hidden="true">
              {entries.map(({ device }) => {
                const node = positions.get(device.id);
                const highlighted = device.id === selectedId || matchIds?.has(device.id);
                return (
                  <line
                    key={device.id}
                    x1={0}
                    y1={0}
                    x2={node.x}
                    y2={node.y}
                    stroke={highlighted ? 'var(--info)' : 'var(--border)'}
                    strokeWidth={highlighted ? 1.75 : 1}
                    strokeDasharray={device.online ? undefined : '3 4'}
                    opacity={matchIds && !highlighted ? 0.4 : 1}
                  />
                );
              })}
            </g>
            <RouterNode router={router} selected={router?.device.id === selectedId} onSelect={onSelect} />
            {entries.map(({ device, kind }) => {
              const node = positions.get(device.id);
              return (
                <TopologyNode
                  key={device.id}
                  device={device}
                  kind={kind}
                  x={node.x}
                  y={node.y}
                  selected={device.id === selectedId}
                  matched={Boolean(matchIds?.has(device.id))}
                  dimmed={Boolean(matchIds) && !matchIds.has(device.id)}
                  onSelect={onSelect}
                />
              );
            })}
          </svg>
        )}
      </div>
      <div className="absolute top-2 right-2 flex flex-col gap-1 rounded-lg border bg-background/90 p-1 shadow-sm backdrop-blur">
        <Button variant="ghost" size="icon-sm" onClick={viewport.zoomIn} disabled={!viewport.canZoomIn} aria-label="Zoom in">
          <ZoomInIcon aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={viewport.zoomOut} disabled={!viewport.canZoomOut} aria-label="Zoom out">
          <ZoomOutIcon aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={viewport.reset} aria-label="Reset zoom and center the map">
          <LocateFixedIcon aria-hidden="true" />
        </Button>
        <span className="text-center text-[10px] text-muted-foreground tabular-nums" aria-live="polite">
          {Math.round(viewport.zoom * 100)}%
        </span>
      </div>
    </div>
  );
}
