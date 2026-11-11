import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

// Loads and validates workspace.json (the per PC list of dev projects and OS services).
// The file is read again whenever its modification time or size changes.

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,40}$/;
const PROJECT_TYPES = ['node', 'laravel', 'python', 'other'];
const ENV_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,100}$/;
const SERVICE_NAME_PATTERN = /^[A-Za-z0-9_.@-]{1,100}$/;
const MAX_ITEMS = 50;
const MAX_NAME_LENGTH = 80;
const MAX_COMMAND_PARTS = 50;
const MAX_TEXT_LENGTH = 1000;

const EMPTY = Object.freeze({ projects: [], services: [] });

class ConfigError extends Error {}

function fail(message) {
  throw new ConfigError(message);
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireText(value, where, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== 'string' || !value.trim()) {
    fail(`${where} must be a non-empty string`);
  }
  if (value.length > maxLength) {
    fail(`${where} is too long (max ${maxLength} characters)`);
  }
  return value.trim();
}

function readId(value, where, seen) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    fail(`${where}.id must use lowercase letters, digits and dashes (max 41 characters)`);
  }
  if (seen.has(value)) {
    fail(`${where}.id "${value}" is used twice`);
  }
  seen.add(value);
  return value;
}

function readPort(value, where) {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    fail(`${where}.port must be a whole number from 1 to 65535 or null`);
  }
  return value;
}

// Relative paths are resolved against the folder of workspace.json.
function readPath(value, where, baseDir) {
  return path.resolve(baseDir, requireText(value, where));
}

function readCommand(value, where) {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_COMMAND_PARTS) {
    fail(`${where}.command must be a list like ["npm", "run", "dev"]`);
  }
  return value.map((part, index) => {
    if (typeof part !== 'string' || part.length > MAX_TEXT_LENGTH || part.includes('\0')) {
      fail(`${where}.command[${index}] must be a string`);
    }
    if (index === 0 && !part.trim()) {
      fail(`${where}.command[0] must name a program`);
    }
    return part;
  });
}

function readEnv(value, where) {
  if (value === undefined || value === null) {
    return {};
  }
  if (!isPlainObject(value)) {
    fail(`${where}.env must be an object of NAME: value pairs`);
  }
  const env = {};
  for (const [name, entry] of Object.entries(value)) {
    if (!ENV_NAME_PATTERN.test(name)) {
      fail(`${where}.env has an invalid variable name "${name.slice(0, 40)}"`);
    }
    if (!['string', 'number', 'boolean'].includes(typeof entry)) {
      fail(`${where}.env.${name} must be a string, number or boolean`);
    }
    env[name] = String(entry);
  }
  return env;
}

function readProject(raw, index, seen, baseDir) {
  const where = `projects[${index}]`;
  if (!isPlainObject(raw)) {
    fail(`${where} must be an object`);
  }
  const type = raw.type ?? 'other';
  if (!PROJECT_TYPES.includes(type)) {
    fail(`${where}.type must be one of ${PROJECT_TYPES.join(', ')}`);
  }
  return {
    id: readId(raw.id, where, seen),
    name: requireText(raw.name, `${where}.name`, MAX_NAME_LENGTH),
    type,
    cwd: readPath(raw.cwd, `${where}.cwd`, baseDir),
    command: readCommand(raw.command, where),
    port: readPort(raw.port, where),
    env: readEnv(raw.env, where),
    logFile:
      raw.logFile === undefined || raw.logFile === null
        ? null
        : readPath(raw.logFile, `${where}.logFile`, baseDir),
  };
}

function readService(raw, index, seen) {
  const where = `services[${index}]`;
  if (!isPlainObject(raw)) {
    fail(`${where} must be an object`);
  }
  const serviceName = requireText(raw.serviceName, `${where}.serviceName`, 100);
  if (!SERVICE_NAME_PATTERN.test(serviceName)) {
    fail(`${where}.serviceName may only use letters, digits, dots, dashes, underscores and @`);
  }
  return {
    id: readId(raw.id, where, seen),
    name: requireText(raw.name, `${where}.name`, MAX_NAME_LENGTH),
    serviceName,
    port: readPort(raw.port, where),
  };
}

function readList(value, key) {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    fail(`"${key}" must be a list`);
  }
  if (value.length > MAX_ITEMS) {
    fail(`"${key}" has more than ${MAX_ITEMS} entries`);
  }
  return value;
}

// Validates parsed JSON. Throws a ConfigError with a readable message when something is wrong.
export function parseWorkspaceConfig(data, baseDir) {
  if (!isPlainObject(data)) {
    fail('The file must contain a JSON object with "projects" and "services"');
  }
  const projectIds = new Set();
  const serviceIds = new Set();
  return {
    projects: readList(data.projects, 'projects').map((raw, index) =>
      readProject(raw, index, projectIds, baseDir),
    ),
    services: readList(data.services, 'services').map((raw, index) =>
      readService(raw, index, serviceIds),
    ),
  };
}

async function loadFile(filePath) {
  let text;
  try {
    text = await readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { configFound: false, configError: null, ...EMPTY };
    }
    const configError = `Cannot read the file (${error.code ?? 'error'})`;
    return { configFound: true, configError, ...EMPTY };
  }

  try {
    // Editors on Windows sometimes save a byte order mark.
    const data = JSON.parse(text.replace(/^﻿/, ''));
    const parsed = parseWorkspaceConfig(data, path.dirname(filePath));
    return { configFound: true, configError: null, ...parsed };
  } catch (error) {
    const message = error instanceof ConfigError ? error.message : `Invalid JSON: ${error.message}`;
    return { configFound: true, configError: message.slice(0, 300), ...EMPTY };
  }
}

// Returns a loader that caches the parsed file until it changes on disk.
export function createWorkspaceConfigLoader(filePath) {
  let cached = null;
  let cachedKey = null;

  return async function getWorkspaceConfig() {
    let key = 'missing';
    try {
      const info = await stat(filePath);
      key = `${info.mtimeMs}:${info.size}`;
    } catch {
      // Missing file: loadFile reports it.
    }
    if (cached && key === cachedKey) {
      return cached;
    }
    cached = await loadFile(filePath);
    cachedKey = key;
    if (cached.configError) {
      console.warn(`[agent] workspace config error: ${cached.configError}`);
    } else if (cached.configFound) {
      const { projects, services } = cached;
      console.log(
        `[agent] workspace config loaded: ${projects.length} projects, ${services.length} services`,
      );
    }
    return cached;
  };
}
