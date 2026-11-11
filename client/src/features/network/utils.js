// The best name we have for a device, from most to least specific.
export function networkDeviceName(device) {
  if (device.customName) {
    return device.customName;
  }
  if (device.isScanner) {
    return device.hostname ? `${device.hostname} (server)` : 'This server';
  }
  return device.hostname || device.vendor || (device.randomizedMac ? 'Private device' : 'Unknown device');
}

// Numeric IP order (so .9 comes before .10).
export function compareIp(a, b) {
  const toNumber = (ip) => ip.split('.').reduce((acc, part) => acc * 256 + Number(part), 0);
  return toNumber(a ?? '0.0.0.0') - toNumber(b ?? '0.0.0.0');
}
