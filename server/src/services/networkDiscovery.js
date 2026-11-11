// Finds devices on the local network without admin rights:
// 1. Send one small UDP packet to every address in the subnet. To deliver it, the OS
//    has to resolve each address, which fills its ARP table with the devices that answer.
// 2. Read the ARP table (IP + MAC pairs).
import { execFile } from 'node:child_process';
import dgram from 'node:dgram';
import dns from 'node:dns/promises';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

const DISCARD_PORT = 9;
const ARP_SETTLE_MS = 2000;
const REVERSE_DNS_TIMEOUT_MS = 1500;
// Never sweep more than a /24 (254 hosts), even on bigger networks.
const MIN_PREFIX = 24;

function ipToInt(ip) {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function intToIp(value) {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.');
}

function prefixLength(netmask) {
  return ipToInt(netmask).toString(2).replace(/0/g, '').length;
}

export function normalizeMac(mac) {
  const parts = mac.toLowerCase().split(/[:-]/);
  if (parts.length !== 6) {
    return null;
  }
  return parts.map((part) => part.padStart(2, '0')).join(':');
}

// The first usable IPv4 interface (Wi-Fi or Ethernet).
export function getLocalNetwork() {
  for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal && !address.address.startsWith('169.254.')) {
        const prefix = Math.max(prefixLength(address.netmask), MIN_PREFIX);
        const mask = prefix === 32 ? 0xffffffff : (~((1 << (32 - prefix)) - 1)) >>> 0;
        const network = (ipToInt(address.address) & mask) >>> 0;
        return {
          interfaceName: name,
          address: address.address,
          mac: normalizeMac(address.mac),
          prefix,
          network,
          broadcast: (network | (~mask >>> 0)) >>> 0,
          cidr: `${intToIp(network)}/${prefix}`,
        };
      }
    }
  }
  return null;
}

function hostAddresses(net) {
  const hosts = [];
  for (let value = net.network + 1; value < net.broadcast; value += 1) {
    hosts.push(intToIp(value));
  }
  return hosts;
}

async function probeHosts(hosts) {
  const socket = dgram.createSocket('udp4');
  socket.on('error', () => {});
  const payload = Buffer.from([0]);

  await Promise.all(
    hosts.map(
      (host) =>
        new Promise((resolve) => {
          socket.send(payload, DISCARD_PORT, host, () => resolve());
        }),
    ),
  );
  await new Promise((resolve) => setTimeout(resolve, ARP_SETTLE_MS));
  socket.close();
}

const ARP_LINE_WINDOWS = /^\s*(\d{1,3}(?:\.\d{1,3}){3})\s+([0-9a-f]{2}(?:-[0-9a-f]{2}){5})\s+dynamic/i;
const ARP_LINE_MAC = /\((\d{1,3}(?:\.\d{1,3}){3})\) at ([0-9a-f]{1,2}(?::[0-9a-f]{1,2}){5})/i;

async function readArpTable() {
  if (process.platform === 'linux') {
    const text = await fs.readFile('/proc/net/arp', 'utf8');
    return text
      .split('\n')
      .slice(1)
      .map((line) => line.trim().split(/\s+/))
      // flags 0x0 means the entry is incomplete
      .filter((cols) => cols.length >= 4 && cols[2] !== '0x0')
      .map((cols) => ({ ip: cols[0], mac: cols[3] }));
  }

  const args = process.platform === 'win32' ? ['-a'] : ['-an'];
  const { stdout } = await execFileAsync('arp', args, { timeout: 10_000, windowsHide: true });
  const pattern = process.platform === 'win32' ? ARP_LINE_WINDOWS : ARP_LINE_MAC;
  return stdout
    .split('\n')
    .map((line) => line.match(pattern))
    .filter(Boolean)
    .map(([, ip, mac]) => ({ ip, mac }));
}

let ouiTable = null;

// Vendor from the IEEE OUI list (offline, MACs never leave this server).
function lookupVendor(mac) {
  const firstByte = parseInt(mac.slice(0, 2), 16);
  // Locally administered bit set: a random "private" MAC with no real vendor.
  if (firstByte & 0b10) {
    return { vendor: null, randomizedMac: true };
  }
  ouiTable ??= require('oui-data');
  const entry = ouiTable[mac.replace(/:/g, '').slice(0, 6).toUpperCase()];
  return { vendor: entry ? entry.split('\n')[0].trim() : null, randomizedMac: false };
}

async function reverseLookup(ip) {
  try {
    const names = await Promise.race([
      dns.reverse(ip),
      new Promise((resolve) => setTimeout(() => resolve([]), REVERSE_DNS_TIMEOUT_MS)),
    ]);
    return names[0] ?? null;
  } catch {
    return null;
  }
}

function isUsableMac(mac) {
  if (!mac || mac === '00:00:00:00:00:00' || mac === 'ff:ff:ff:ff:ff:ff') {
    return false;
  }
  // Multicast MACs have the lowest bit of the first byte set.
  return (parseInt(mac.slice(0, 2), 16) & 1) === 0;
}

// Returns { network, devices: [{ ip, mac, vendor, randomizedMac, hostname, isScanner }] }.
export async function discoverDevices() {
  const net = getLocalNetwork();
  if (!net) {
    throw new Error('No network connection found on the server');
  }

  const hosts = hostAddresses(net).filter((ip) => ip !== net.address);
  await probeHosts(hosts);

  const inSubnet = new Set(hosts);
  const byMac = new Map();
  for (const { ip, mac: rawMac } of await readArpTable()) {
    const mac = normalizeMac(rawMac);
    if (inSubnet.has(ip) && isUsableMac(mac)) {
      byMac.set(mac, { ip, mac });
    }
  }

  // This computer is not in its own ARP table.
  if (net.mac && isUsableMac(net.mac)) {
    byMac.set(net.mac, { ip: net.address, mac: net.mac, isScanner: true, hostname: os.hostname() });
  }

  const devices = await Promise.all(
    [...byMac.values()].map(async (device) => ({
      ...device,
      ...lookupVendor(device.mac),
      hostname: device.hostname ?? (await reverseLookup(device.ip)),
      isScanner: Boolean(device.isScanner),
    })),
  );

  return { network: net, devices };
}
