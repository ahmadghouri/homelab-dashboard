import { config } from '../config.js';
import { createWorkspaceConfigLoader } from './config.js';
import { containerAction, containerLogs, listContainers } from './docker.js';
import { readLogFileTail } from './logBuffer.js';
import { getServiceStatuses, serviceAction } from './osServices.js';
import { listListeningPorts } from './ports.js';
import { createProjectManager, getProcessTree } from './projects.js';

// Developer workspace: sends a status snapshot to the server and answers action / log requests.

const SNAPSHOT_INTERVAL_MS = 10_000;
const STATUS_CHANGE_DELAY_MS = 300;
const MAX_PORTS = 300;
const MAX_OUTPUT_LENGTH = 500;
const MAX_ID_LENGTH = 100;
const MAX_LOG_LINES = 500;
const TARGETS = ['project', 'container', 'service'];
const LOG_TARGETS = ['project', 'container'];
const ACTIONS = ['start', 'stop', 'restart'];

export const WORKSPACE_OFF_MESSAGE =
  'Workspace control is turned off on this PC (set WORKSPACE_CONTROL=on in agent/.env)';

function reply(ok, output) {
  return { ok, output: String(output ?? '').trim().slice(0, MAX_OUTPUT_LENGTH) };
}

function logReply(ok, output, lines = []) {
  return { ...reply(ok, output), lines };
}

function readId(payload) {
  const id = payload?.id;
  return typeof id === 'string' && id.length > 0 && id.length <= MAX_ID_LENGTH ? id : null;
}

// Marks listening ports that belong to a configured project, and conflicts:
// a crashed project whose port is taken, or a running project's port also held by another process.
async function describePorts(ports, configProjects, projectStatuses) {
  const ownerByPort = new Map();
  configProjects.forEach((project, index) => {
    if (project.port && !ownerByPort.has(project.port)) {
      ownerByPort.set(project.port, projectStatuses[index]);
    }
  });

  const rows = [];
  for (const entry of ports.slice(0, MAX_PORTS)) {
    const owner = ownerByPort.get(entry.port);
    let conflict = false;
    if (owner?.status === 'crashed') {
      conflict = true;
    } else if (owner?.status === 'running' && owner.pid !== entry.pid) {
      // npm / cmd.exe start the real server as a child process, so check the whole tree.
      const tree = await getProcessTree(owner.pid, entry.pid);
      conflict = !tree.has(entry.pid);
    }
    rows.push({ ...entry, conflict, expectedBy: owner?.id ?? null });
  }
  return rows;
}

// The port list is cached for a few seconds, so it can still hold a process that just stopped.
function isAlive(pid) {
  if (!pid) {
    return true;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists but belongs to another user or the system.
    return error.code === 'EPERM';
  }
}

function listenersOf(ports, port) {
  return port ? ports.filter((entry) => entry.port === port) : [];
}

export function registerWorkspace(socket) {
  const getConfig = createWorkspaceConfigLoader(config.workspaceFile);
  let building = false;
  let buildAgain = false;
  let statusTimer = null;

  const manager = createProjectManager({
    // Report crashes and exits right away instead of waiting for the next interval.
    onStatusChange() {
      clearTimeout(statusTimer);
      statusTimer = setTimeout(sendSnapshot, STATUS_CHANGE_DELAY_MS);
    },
  });

  async function buildSnapshot() {
    const workspace = await getConfig();
    const [allPorts, containers, services] = await Promise.all([
      listListeningPorts(),
      listContainers(),
      getServiceStatuses(workspace.services),
    ]);
    const ports = allPorts.filter((entry) => isAlive(entry.pid));
    const projects = workspace.projects.map((project) =>
      manager.describe(project, listenersOf(ports, project.port)),
    );
    return {
      at: new Date().toISOString(),
      controlEnabled: config.workspaceControl,
      configFound: workspace.configFound,
      configError: workspace.configError,
      projects,
      containers,
      services,
      ports: await describePorts(ports, workspace.projects, projects),
    };
  }

  // One snapshot at a time; a request during a build schedules one more build afterwards.
  async function sendSnapshot() {
    if (!socket.connected) {
      return;
    }
    if (building) {
      buildAgain = true;
      return;
    }
    building = true;
    try {
      socket.emit('agent:workspace', await buildSnapshot());
    } catch (error) {
      console.error('[agent] could not build the workspace snapshot:', error.message);
    } finally {
      building = false;
    }
    if (buildAgain) {
      buildAgain = false;
      sendSnapshot();
    }
  }

  async function runAction(target, id, action) {
    if (target === 'container') {
      return containerAction(id, action);
    }
    const workspace = await getConfig();
    if (target === 'service') {
      const service = workspace.services.find((item) => item.id === id);
      return service ? serviceAction(service, action) : reply(false, 'Unknown service');
    }
    const project = workspace.projects.find((item) => item.id === id);
    return project ? manager.runAction(project, action) : reply(false, 'Unknown project');
  }

  async function handleAction(payload) {
    const target = payload?.target;
    const action = payload?.action;
    const id = readId(payload);
    if (!TARGETS.includes(target) || !ACTIONS.includes(action) || !id) {
      return reply(false, 'Invalid workspace action');
    }
    if (!config.workspaceControl) {
      return reply(false, WORKSPACE_OFF_MESSAGE);
    }
    const result = await runAction(target, id, action);
    console.log(`[agent] workspace ${target} ${id} ${action}: ${result.ok ? 'ok' : 'failed'}`);
    return reply(result.ok, result.output);
  }

  // Project output from the agent's buffer plus the tail of the project's own log file.
  async function projectLogs(id, count) {
    const project = (await getConfig()).projects.find((item) => item.id === id);
    if (!project) {
      return logReply(false, 'Unknown project');
    }
    const output = manager.logs(id, count);
    if (!project.logFile) {
      return logReply(true, '', output);
    }
    const file = await readLogFileTail(project.logFile, count);
    // Share the line budget when both sources have lines: at most half for the file.
    const fileTake =
      output.length > 0 ? Math.min(file.lines.length, Math.ceil(count / 2)) : file.lines.length;
    const outputTake = count - fileTake;
    const lines = [
      ...file.lines.slice(file.lines.length - fileTake),
      ...(outputTake > 0 ? output.slice(-outputTake) : []),
    ];
    return logReply(true, file.error ?? '', lines);
  }

  async function handleLogs(payload) {
    const target = payload?.target;
    const id = readId(payload);
    const count = payload?.lines;
    const validCount = Number.isInteger(count) && count >= 1 && count <= MAX_LOG_LINES;
    if (!LOG_TARGETS.includes(target) || !id || !validCount) {
      return logReply(false, 'Invalid log request');
    }
    if (!config.workspaceControl) {
      return logReply(false, WORKSPACE_OFF_MESSAGE);
    }
    if (target === 'container') {
      const result = await containerLogs(id, count);
      return logReply(result.ok, result.output, result.lines ?? []);
    }
    return projectLogs(id, count);
  }

  // The server waits for the acknowledgement, so always answer, even for invalid payloads.
  socket.on('agent:workspace:action', async (payload, ack) => {
    if (typeof ack !== 'function') {
      return;
    }
    try {
      ack(await handleAction(payload));
    } catch (error) {
      console.error('[agent] workspace action failed:', error.message);
      ack(reply(false, 'Agent error'));
    }
    sendSnapshot();
  });

  socket.on('agent:workspace:logs', async (payload, ack) => {
    if (typeof ack !== 'function') {
      return;
    }
    try {
      ack(await handleLogs(payload));
    } catch (error) {
      console.error('[agent] workspace logs failed:', error.message);
      ack(logReply(false, 'Agent error'));
    }
  });

  socket.on('connect', sendSnapshot);
  setInterval(sendSnapshot, SNAPSHOT_INTERVAL_MS);
}
