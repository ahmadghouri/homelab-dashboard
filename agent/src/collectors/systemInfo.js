import os from 'node:os';
import si from 'systeminformation';

// Hardware and OS details. Sent once on every (re)connect as `agent:hello`.
export async function collectSystemInfo(agentVersion) {
  const [cpu, osInfo, mem] = await Promise.all([si.cpu(), si.osInfo(), si.mem()]);

  return {
    hostname: os.hostname(),
    platform: osInfo.platform,
    osName: osInfo.distro,
    osVersion: osInfo.release,
    arch: osInfo.arch,
    cpuModel: `${cpu.manufacturer} ${cpu.brand}`.trim(),
    cpuCores: cpu.cores,
    totalMemBytes: mem.total,
    agentVersion,
  };
}
