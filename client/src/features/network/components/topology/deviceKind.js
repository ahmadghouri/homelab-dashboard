// Pure helpers that guess what a scanned device is. No React here, so a plain Node script can test them.
// The scanner only knows IP, MAC, vendor (from the MAC prefix) and sometimes a hostname, so every result is a guess.

export const DEVICE_KINDS = ['computer', 'phone', 'printer', 'media', 'network', 'server', 'unknown'];

export const KIND_LABELS = {
  computer: 'Computers',
  phone: 'Phones',
  printer: 'Printers',
  media: 'TV / media',
  network: 'Network gear',
  server: 'Servers',
  unknown: 'Unknown',
};

// Hostname or custom name words win over the vendor (an HP printer and an HP laptop share a vendor).
const NAME_RULES = [
  { kind: 'printer', pattern: /print|laserjet|officejet|deskjet|epson|canon|brother|xerox|kyocera|ricoh|lexmark/ },
  { kind: 'media', pattern: /\btv\b|-tv|tv-|chromecast|roku|fire-?tv|apple-?tv|shield|sonos|bravia|xbox|playstation|ps[45]|nintendo|media|speaker|echo/ },
  { kind: 'phone', pattern: /iphone|ipad|android|galaxy|pixel|phone|tablet|redmi|oneplus/ },
  { kind: 'network', pattern: /router|switch|access-?point|\bap\b|mesh|extender|repeater|gateway|mikrotik|unifi/ },
  { kind: 'server', pattern: /\bnas\b|nas-|server|srv|synology|qnap|raspberry|proxmox|truenas|unraid|docker/ },
  { kind: 'computer', pattern: /desktop|laptop|notebook|\bpc\b|-pc|pc-|macbook|imac|mac-?mini|workstation|thinkpad/ },
];

// Vendor names as the OUI database writes them (lower case, partial match).
const VENDOR_RULES = [
  {
    kind: 'network',
    pattern: /routerboard|mikrotik|cisco|tp-?link|ubiquiti|netgear|d-?link|zyxel|aruba|juniper|tenda|linksys|huawei technologies|ruckus|meraki|mercusys|cambium|fortinet/,
  },
  { kind: 'printer', pattern: /canon|seiko epson|epson|brother|xerox|kyocera|ricoh|lexmark|konica|sharp corp/ },
  {
    kind: 'media',
    pattern: /roku|sonos|vizio|hisense|tcl|skyworth|lg electronics|sony|panasonic|philips|amazon|nvidia|nintendo|microsoft xbox|tivo/,
  },
  {
    kind: 'phone',
    pattern: /infinix|tecno|itel|transsion|xiaomi|oppo|vivo|oneplus|realme|motorola|samsung|huawei device|honor|nokia|zte|google/,
  },
  {
    kind: 'computer',
    pattern: /intel|dell|lenovo|lcfc|hewlett|hp inc|liteon|lite-on|asustek|micro-star|gigabyte|acer|apple|azurewave|realtek|quanta|compal|wistron|pegatron|hon hai|foxconn|clevo|toshiba|fujitsu|chicony/,
  },
];

// Vendor strings that say nothing about the device.
const UNHELPFUL_VENDORS = /^(private|ieee registration authority)$/;

function nameOf(device) {
  return [device.customName, device.hostname].filter(Boolean).join(' ').toLowerCase();
}

// Returns { kind, reason } where reason is a short sentence for the details panel.
export function guessDeviceKind(device) {
  if (device.isScanner) {
    return { kind: 'server', reason: 'This is the server running the network scan' };
  }

  const name = nameOf(device);
  if (name) {
    const rule = NAME_RULES.find(({ pattern }) => pattern.test(name));
    if (rule) {
      return { kind: rule.kind, reason: 'Guessed from the device name' };
    }
  }

  const vendor = (device.vendor ?? '').trim().toLowerCase();
  if (vendor && !UNHELPFUL_VENDORS.test(vendor)) {
    const rule = VENDOR_RULES.find(({ pattern }) => pattern.test(vendor));
    if (rule) {
      return { kind: rule.kind, reason: `Guessed from the vendor (${device.vendor})` };
    }
  }

  // Phones (iOS and Android) use a private random MAC per network by default.
  if (device.randomizedMac) {
    return { kind: 'phone', reason: 'Guessed from its private (random) MAC, which phones use by default' };
  }
  return { kind: 'unknown', reason: 'Not enough information to guess' };
}

const ROUTER_VENDOR = /router|routerboard|mikrotik|tp-?link|huawei/;

// The gateway is usually the .1 address of the scanned subnet ("192.168.1.0/24" -> "192.168.1.1").
export function gatewayIp(subnet) {
  const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)\/\d+$/.exec(subnet ?? '');
  if (!match) {
    return null;
  }
  return `${match[1]}.${match[2]}.${match[3]}.${Number(match[4]) + 1}`;
}

// Picks the device that is most likely the router, or null when none looks like one.
export function findRouterDevice(devices, subnet) {
  const gateway = gatewayIp(subnet);
  const byIp = gateway && devices.find((device) => device.ip === gateway);
  if (byIp) {
    return byIp;
  }
  const byVendor = devices.filter((device) => !device.isScanner && ROUTER_VENDOR.test((device.vendor ?? '').toLowerCase()));
  return byVendor.length === 1 ? byVendor[0] : null;
}
