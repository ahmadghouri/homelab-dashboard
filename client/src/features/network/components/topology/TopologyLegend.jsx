import { RouterIcon } from 'lucide-react';

// Small SVG swatches that match how nodes are drawn on the map.
function Swatch({ children }) {
  return (
    <svg width="22" height="22" viewBox="-11 -11 22 22" aria-hidden="true" className="shrink-0">
      {children}
    </svg>
  );
}

const NODE_FILL = 'color-mix(in oklch, var(--muted-foreground) 16%, var(--card))';

const ITEMS = [
  {
    label: 'Router',
    swatch: (
      <>
        <circle r={9} fill="var(--primary)" />
        <RouterIcon x={-5.5} y={-5.5} width={11} height={11} color="var(--primary-foreground)" />
      </>
    ),
  },
  {
    label: 'Online',
    swatch: (
      <>
        <circle r={7} fill={NODE_FILL} stroke="var(--muted-foreground)" strokeWidth={1.5} />
        <circle cx={5.5} cy={-5.5} r={3} fill="var(--success)" stroke="var(--card)" />
      </>
    ),
  },
  {
    label: 'Offline (faded)',
    swatch: (
      <g opacity={0.45}>
        <circle r={7} fill={NODE_FILL} stroke="var(--muted-foreground)" strokeWidth={1.5} strokeDasharray="3 2" />
        <circle cx={5.5} cy={-5.5} r={3} fill="var(--muted-foreground)" stroke="var(--card)" />
      </g>
    ),
  },
  {
    label: 'Unknown device (not trusted yet)',
    swatch: (
      <>
        <circle r={9.5} fill="none" stroke="var(--warning)" strokeWidth={1.5} strokeDasharray="3 2.5" />
        <circle r={6.5} fill={NODE_FILL} stroke="var(--muted-foreground)" strokeWidth={1.5} />
      </>
    ),
  },
  {
    label: 'Search match',
    swatch: (
      <>
        <circle r={10} fill="color-mix(in oklch, var(--info) 22%, transparent)" stroke="var(--info)" />
        <circle r={6.5} fill={NODE_FILL} stroke="var(--muted-foreground)" strokeWidth={2} />
      </>
    ),
  },
];

export function TopologyLegend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground" aria-label="Map legend">
      {ITEMS.map(({ label, swatch }) => (
        <li key={label} className="flex items-center gap-1.5">
          <Swatch>{swatch}</Swatch>
          {label}
        </li>
      ))}
      <li className="flex items-center">Drag to pan, use the buttons to zoom. Tab to a device and press Enter for details.</li>
    </ul>
  );
}
