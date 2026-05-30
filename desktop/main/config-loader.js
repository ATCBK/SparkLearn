const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..', '..');
const desktopDir = path.join(rootDir, 'desktop');

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readRootEnv() {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const env = {};
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const separator = trimmed.indexOf('=');
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }
  return env;
}

function mergeDeep(base, override) {
  const output = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      output[key] = mergeDeep(output[key] || {}, value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function resolveCwd(cwd) {
  if (!cwd) {
    return rootDir;
  }
  return path.isAbsolute(cwd) ? cwd : path.resolve(desktopDir, cwd);
}

function applyEnvOverrides(config, env = process.env) {
  const patched = { ...config };
  if (env.NANOBOT_PET_ENABLED) {
    patched.nanobot = {
      ...patched.nanobot,
      enabled: env.NANOBOT_PET_ENABLED.toLowerCase() === 'true',
    };
  }
  if (env.NANOBOT_PROJECT_DIR) {
    patched.nanobot = { ...patched.nanobot, cwd: env.NANOBOT_PROJECT_DIR };
  }
  if (env.NANOBOT_PYTHON_EXE && fs.existsSync(env.NANOBOT_PYTHON_EXE)) {
    patched.nanobot = { ...patched.nanobot, command: env.NANOBOT_PYTHON_EXE };
  }
  if (env.NANOBOT_CONFIG_PATH || env.NANOBOT_WORKSPACE) {
    patched.nanobot = {
      ...patched.nanobot,
      env: {
        ...(patched.nanobot && patched.nanobot.env),
        ...(env.NANOBOT_CONFIG_PATH ? { NANOBOT_CONFIG_PATH: env.NANOBOT_CONFIG_PATH } : {}),
        ...(env.NANOBOT_WORKSPACE ? { NANOBOT_WORKSPACE: env.NANOBOT_WORKSPACE } : {}),
      },
    };
  }
  if (patched.nanobot) {
    const args = [...(patched.nanobot.args || [])];
    const configIndex = args.indexOf('--config');
    if (env.NANOBOT_CONFIG_PATH && fs.existsSync(env.NANOBOT_CONFIG_PATH) && configIndex >= 0) {
      args[configIndex + 1] = env.NANOBOT_CONFIG_PATH;
    }
    const workspaceIndex = args.indexOf('--workspace');
    if (env.NANOBOT_WORKSPACE && workspaceIndex >= 0) {
      args[workspaceIndex + 1] = env.NANOBOT_WORKSPACE;
    }
    patched.nanobot = { ...patched.nanobot, args };
  }
  return patched;
}

function normalizeService(service) {
  return {
    ...service,
    cwd: resolveCwd(service.cwd),
  };
}

function loadConfig() {
  const examplePath = path.join(desktopDir, 'config', 'desktop.config.example.json');
  const localPath = path.join(desktopDir, 'config', 'desktop.config.json');
  const defaultConfig = readJsonIfExists(examplePath);
  const localConfig = readJsonIfExists(localPath);
  const rootEnv = readRootEnv();
  const merged = applyEnvOverrides(mergeDeep(defaultConfig, localConfig), { ...rootEnv, ...process.env });

  return {
    ...merged,
    rootDir,
    desktopDir,
    env: rootEnv,
    frontend: normalizeService(merged.frontend),
    backend: normalizeService(merged.backend),
    nanobot: normalizeService(merged.nanobot),
  };
}

module.exports = { loadConfig, rootDir, desktopDir };
