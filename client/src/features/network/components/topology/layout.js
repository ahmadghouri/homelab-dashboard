// Pure layout for the topology map. The router sits at (0, 0); devices sit on concentric ellipses ("rings")
// stretched to the map container's aspect ratio. Devices arrive sorted by kind, and slots are handed out in
// clockwise order across all rings, so every kind ends up in its own wedge of the map.

export const NODE_RADIUS = 15;
export const ROUTER_RADIUS = 26;

// Minimum distance between neighbours on a ring. Labels sit under nodes, so neighbours side by side need room
// for a label width, while neighbours above each other only need room for the node plus two short text lines.
const MIN_GAP_X = 74;
const MIN_GAP_Y = 62;
const FIRST_RING = 120;
const RING_STEP = 95;
const SAMPLES = 720;
// Rings are filled to at most this share of their length, because curved arcs are longer than the straight gap.
const FILL = 0.97;
// Extra room around the outermost nodes for labels.
const MARGIN_X = 60;
const MARGIN_Y = 56;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Samples an ellipse clockwise from the top and measures its length in "gap units":
// one unit is the minimum distance two neighbours need in that direction.
function measureRing(rx, ry) {
  const points = [];
  const lengths = [0];
  for (let i = 0; i <= SAMPLES; i += 1) {
    const t = (i / SAMPLES) * Math.PI * 2;
    points.push({ x: rx * Math.sin(t), y: -ry * Math.cos(t) });
    if (i > 0) {
      const dx = (points[i].x - points[i - 1].x) / MIN_GAP_X;
      const dy = (points[i].y - points[i - 1].y) / MIN_GAP_Y;
      lengths.push(lengths[i - 1] + Math.max(Math.abs(dx), Math.abs(dy)));
    }
  }
  return { rx, ry, points, lengths, total: lengths[SAMPLES] };
}

function pointAt(ring, distance) {
  const { points, lengths } = ring;
  let low = 0;
  let high = lengths.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (lengths[mid] < distance) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return points[low];
}

function buildRings(count, aspect) {
  const stretch = Math.sqrt(clamp(aspect, 0.8, 1.55));
  const rings = [];
  let capacity = 0;
  while (capacity < count || rings.length === 0) {
    const size = FIRST_RING + RING_STEP * rings.length;
    const ring = measureRing(size * stretch, size / stretch);
    ring.capacity = Math.floor(ring.total * FILL);
    capacity += ring.capacity;
    rings.push(ring);
  }
  return { rings, capacity };
}

// Splits `count` over the rings in proportion to their capacity, so spacing is even everywhere.
function slotsPerRing(rings, capacity, count) {
  const exact = rings.map((ring) => (count * ring.capacity) / capacity);
  const slots = exact.map(Math.floor);
  let left = count - slots.reduce((sum, value) => sum + value, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);
  for (const { index } of byRemainder) {
    if (left === 0) {
      break;
    }
    if (slots[index] < rings[index].capacity) {
      slots[index] += 1;
      left -= 1;
    }
  }
  return slots;
}

// Clockwise angle from the top, 0..2PI.
function clockAngle({ x, y }) {
  const angle = Math.atan2(x, -y);
  return angle < 0 ? angle + Math.PI * 2 : angle;
}

// items: [{ id }] already in display order. aspect: container width / height.
// Returns { nodes: [{ id, x, y }], rings: [{ rx, ry }], width, height } in map units (1 unit = 1 px at 100%).
export function layoutTopology(items, aspect) {
  if (items.length === 0) {
    const { rx, ry } = buildRings(0, aspect).rings[0];
    return { nodes: [], rings: [{ rx, ry }], width: 2 * (rx + MARGIN_X), height: 2 * (ry + MARGIN_Y) };
  }

  const { rings, capacity } = buildRings(items.length, aspect);
  const counts = slotsPerRing(rings, capacity, items.length);

  const slots = [];
  rings.forEach((ring, ringIndex) => {
    const count = counts[ringIndex];
    // Every other ring is shifted by half a slot so labels on neighbouring rings do not line up.
    const offset = ringIndex % 2 === 0 ? 0 : 0.5;
    for (let i = 0; i < count; i += 1) {
      const point = pointAt(ring, ((i + offset) * ring.total) / count);
      slots.push({ x: point.x, y: point.y, angle: clockAngle(point) });
    }
  });
  slots.sort((a, b) => a.angle - b.angle);

  const nodes = items.map((item, index) => ({ id: item.id, x: slots[index].x, y: slots[index].y }));
  const maxX = Math.max(...nodes.map((node) => Math.abs(node.x)));
  const maxY = Math.max(...nodes.map((node) => Math.abs(node.y)));

  return {
    nodes,
    rings: rings.filter((_, index) => counts[index] > 0).map(({ rx, ry }) => ({ rx, ry })),
    width: 2 * (maxX + MARGIN_X),
    height: 2 * (maxY + MARGIN_Y),
  };
}
