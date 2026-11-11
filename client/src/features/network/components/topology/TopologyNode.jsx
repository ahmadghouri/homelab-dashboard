import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatRelativeTime } from '@/lib/format';
import { networkDeviceName } from '../../utils';
import { KIND_STYLES } from './kindStyles';
import { NODE_RADIUS } from './layout';

const LABEL_CHARS = 11;
// Text halo in the card color keeps labels readable where they cross a link line.
const HALO = { paintOrder: 'stroke', stroke: 'var(--card)', strokeWidth: 3, strokeLinejoin: 'round' };

// Company suffixes that waste label space ("Dell Inc." -> "Dell", "LCFC(Hefei) Electronics ..." -> "LCFC").
const VENDOR_NOISE =
  /\(.*?\)|,|\.com\b|\b(inc|corp|corporation|corporate|co|ltd|limited|llc|gmbh|systems|technology|technologies|electronics|mobility|international)\b\.?/gi;

function truncateLabel(text, max = LABEL_CHARS) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

// Label text for a node: the device name, with vendor names shortened when the vendor is all we know.
export function nodeLabel(device, max = LABEL_CHARS) {
  const name = networkDeviceName(device);
  if (name !== device.vendor) {
    return truncateLabel(name, max);
  }
  const short = name
    .replace(/hewlett[ -]packard( enterprise)?/i, 'HP')
    .replace(VENDOR_NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return truncateLabel(short || name, max);
}

// ".101" for 192.168.79.101: the subnet is the same for every node, so the last part is what tells them apart.
function shortIp(ip) {
  return ip ? `.${ip.split('.').pop()}` : '';
}

export function DeviceTooltipBody({ device, kindLabel }) {
  const rows = [
    ['IP', device.ip],
    ['MAC', device.mac],
    ['Vendor', device.randomizedMac ? 'Private (random) MAC' : (device.vendor ?? 'Unknown')],
    ['Kind', kindLabel],
    ['Last seen', device.online ? 'Online now' : formatRelativeTime(device.lastSeenAt)],
  ];
  return (
    <div className="flex flex-col gap-1 py-0.5">
      <span className="font-medium">{networkDeviceName(device)}</span>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="opacity-70">{label}</dt>
            <dd className="font-mono break-all">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// One device on the map: a focusable button-like group with a tooltip. Coordinates are map units.
export function TopologyNode({ device, kind, x, y, selected, matched, dimmed, onSelect }) {
  const { Icon, color, label: kindLabel } = KIND_STYLES[kind];
  const name = networkDeviceName(device);
  const status = device.online ? 'online' : 'offline';
  const ariaLabel = `${name}, ${device.ip}, ${kindLabel}, ${status}${device.trusted ? '' : ', unknown device'}`;
  const emphasis = selected || matched;

  let opacity = device.online ? 1 : 0.45;
  if (dimmed) {
    opacity = 0.18;
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(device.id);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <g
          role="button"
          tabIndex={0}
          aria-label={ariaLabel}
          aria-pressed={selected}
          transform={`translate(${x} ${y})`}
          opacity={opacity}
          className="group cursor-pointer outline-none transition-opacity"
          onClick={() => onSelect(device.id)}
          onKeyDown={handleKeyDown}
        >
          {/* Large invisible hit area so small nodes are easy to hover and tap. */}
          <circle r={NODE_RADIUS + 8} fill="transparent" />
          <circle
            r={NODE_RADIUS + 7}
            fill="none"
            stroke="var(--ring)"
            strokeWidth={3}
            className="opacity-0 group-focus-visible:opacity-100"
          />
          {matched && (
            <circle r={NODE_RADIUS + 6} fill="color-mix(in oklch, var(--info) 22%, transparent)" stroke="var(--info)" />
          )}
          {!device.trusted && (
            <circle r={NODE_RADIUS + 3.5} fill="none" stroke="var(--warning)" strokeWidth={1.5} strokeDasharray="3 2.5" />
          )}
          <circle
            r={NODE_RADIUS}
            fill={`color-mix(in oklch, ${color} 16%, var(--card))`}
            stroke={color}
            strokeWidth={emphasis ? 2.5 : 1.5}
            strokeDasharray={device.online ? undefined : '4 3'}
          />
          <Icon x={-8} y={-8} width={16} height={16} color={color} aria-hidden="true" />
          <circle
            cx={NODE_RADIUS * 0.72}
            cy={-NODE_RADIUS * 0.72}
            r={4}
            fill={device.online ? 'var(--success)' : 'var(--muted-foreground)'}
            stroke="var(--card)"
            strokeWidth={1.5}
          />
          <text
            y={NODE_RADIUS + 14}
            textAnchor="middle"
            fontSize={11}
            fontWeight={emphasis ? 600 : 500}
            fill="var(--foreground)"
            style={HALO}
          >
            {nodeLabel(device)}
          </text>
          <text
            y={NODE_RADIUS + 26}
            textAnchor="middle"
            fontSize={9.5}
            fill="var(--muted-foreground)"
            className="font-mono"
            style={HALO}
          >
            {shortIp(device.ip)}
          </text>
        </g>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-72">
        <DeviceTooltipBody device={device} kindLabel={kindLabel} />
      </TooltipContent>
    </Tooltip>
  );
}
