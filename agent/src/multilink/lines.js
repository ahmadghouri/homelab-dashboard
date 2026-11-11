import os from 'node:os';
import si from 'systeminformation';

// Finds the internet lines of this PC: every non-internal IPv4 interface that is up and has a
// real address (not 169.254.x.x). Read-only: never changes any network setting.

// systeminformation needs ~2 s on Windows (it runs PowerShell), so its adapter descriptions are
// cached and refreshed only now and then or when a new interface appears.
const DESCRIBE_REFRESH_MS = 10 * 60_000;
const MAX_ID_LENGTH = 64;

// Phones shared over USB show up as RNDIS / Apple / vendor network adapters.
const TETHERING_PATTERN =
  /remote ndis|rndis|bluetooth|personal area network|apple mobile device|iphone|ipad|android|samsung|xiaomi|redmi|huawei|honor|oneplus|oppo|vivo|realme|pixel|motorola|nokia|mobile broadband|wwan|cellular/i;
const WIFI_PATTERN = /wi-?fi|wlan|wireless|802\.11/i;
const ETHERNET_PATTERN = /ethernet|gbe|gigabit|realtek pcie|\blan\b/i;
// Hypervisor and VPN adapters are not internet lines of their own.
const VIRTUAL_PATTERN = /hyper-v|vethernet|virtualbox|vmware|wsl|docker|tap-windows|wintun|wireguard|npcap|loopback/i;

export function classifyKind({ iface = '', ifaceName = '', type = '' }) {
  const text = `${iface} ${ifaceName}`;
  if (TETHERING_PATTERN.test(text)) {
    return 'tethering';
  }
  if (type === 'wireless' || WIFI_PATTERN.test(text)) {
    return 'wifi';
  }
  if (type === 'wired' || ETHERNET_PATTERN.test(text)) {
    return 'ethernet';
  }
  return 'other';
}

function isVirtual(iface, description) {
  if (description?.virtual === true) {
    return true;
  }
  return VIRTUAL_PATTERN.test(`${iface} ${description?.ifaceName ?? ''}`);
}

function isUsableAddress(entry) {
  return entry.family === 'IPv4' && !entry.internal && !entry.address.startsWith('169.254.');
}

async function describeWithSystemInformation() {
  const list = await si.networkInterfaces();
  return (Array.isArray(list) ? list : [list]).map((item) => ({
    iface: item.iface,
    ifaceName: item.ifaceName,
    type: item.type,
    virtual: item.virtual,
  }));
}

// listInterfaces / describeInterfaces can be replaced in tests (fake lines).
export function createLineDetector({
  listInterfaces = () => os.networkInterfaces(),
  describeInterfaces = describeWithSystemInformation,
} = {}) {
  let descriptions = new Map();
  let describedAt = 0;
  const lookedUp = new Set();

  async function refreshDescriptions(names) {
    const stale = Date.now() - describedAt > DESCRIBE_REFRESH_MS;
    // Names asked for once already are not asked again until the cache is stale
    // (an adapter systeminformation does not list would otherwise trigger a lookup every time).
    const unknown = names.some((name) => !lookedUp.has(name));
    if (!stale && !unknown) {
      return;
    }
    describedAt = Date.now();
    names.forEach((name) => lookedUp.add(name));
    try {
      const list = await describeInterfaces();
      descriptions = new Map(list.map((item) => [item.iface, item]));
    } catch (error) {
      // The kind then falls back to the interface name.
      console.warn('[agent] multilink: could not read adapter details:', error.message);
    }
  }

  async function detect() {
    const interfaces = listInterfaces();
    const candidates = Object.entries(interfaces)
      .map(([iface, entries]) => [iface, (entries ?? []).find(isUsableAddress)])
      .filter(([iface, entry]) => entry && iface.length > 0 && iface.length <= MAX_ID_LENGTH);

    await refreshDescriptions(candidates.map(([iface]) => iface));

    return candidates
      .filter(([iface]) => !isVirtual(iface, descriptions.get(iface)))
      .map(([iface, entry]) => {
        const description = descriptions.get(iface) ?? { iface };
        return {
          id: iface,
          name: iface,
          kind: classifyKind(description),
          ip: entry.address,
          mac: entry.mac,
        };
      });
  }

  return { detect };
}

const defaultDetector = createLineDetector();

export function detectLines() {
  return defaultDetector.detect();
}
