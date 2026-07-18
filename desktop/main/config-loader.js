const fs = require('node:fs');
const path = require('node:path');

function getAppRootDir() {
  if (process.versions?.electron) {
    try {
      const { app } = require('electron');
      return app.getAppPath();
    } catch (_) {
      return path.resolve(__dirname, '..');
    }
  }
  return path.resolve(__dirname, '..', '..');
}

const rootDir = getAppRootDir();
const desktopDir = path.basename(rootDir) === 'desktop' ? rootDir : path.join(rootDir, 'desktop');

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
  const patched = mergeDeep({}, config);
  const apiBaseUrl = env.SPARKLEARN_API_BASE_URL || env.NEXT_PUBLIC_API_BASE_URL;
  const frontendUrl = env.SPARKLEARN_FRONTEND_URL;
  const frontendEnabled = env.SPARKLEARN_DESKTOP_FRONTEND_ENABLED;
  const backendEnabled = env.SPARKLEARN_DESKTOP_BACKEND_ENABLED;

  if (frontendUrl && patched.frontend) {
    patched.frontend = {
      ...patched.frontend,
      url: frontendUrl,
    };
  }

  if (typeof frontendEnabled === 'string' && patched.frontend) {
    patched.frontend = {
      ...patched.frontend,
      enabled: !['0', 'false', 'no', 'off'].includes(frontendEnabled.trim().toLowerCase()),
    };
  }

  if (apiBaseUrl) {
    patched.api = {
      ...(patched.api || {}),
      baseUrl: apiBaseUrl,
    };
    patched.frontend = {
      ...(patched.frontend || {}),
      env: {
        ...((patched.frontend && patched.frontend.env) || {}),
        NEXT_PUBLIC_API_BASE_URL: apiBaseUrl,
      },
    };
  }

  if (typeof backendEnabled === 'string' && patched.backend) {
    patched.backend = {
      ...patched.backend,
      enabled: !['0', 'false', 'no', 'off'].includes(backendEnabled.trim().toLowerCase()),
    };
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
  const configDir = fs.existsSync(path.join(rootDir, 'config'))
    ? path.join(rootDir, 'config')
    : path.join(desktopDir, 'config');
  const examplePath = path.join(configDir, 'desktop.config.example.json');
  const localPath = path.join(configDir, 'desktop.config.json');
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
  };
}

module.exports = { loadConfig, rootDir, desktopDir };
