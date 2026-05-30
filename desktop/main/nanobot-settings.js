const fs = require('node:fs');
const path = require('node:path');
const { safeStorage } = require('electron');
const { checkHealth } = require('./health-checker');

const CHANNELS = {
  feishu: {
    label: '飞书 / Lark',
    status: 'ready',
    env: {
      appId: 'NANOBOT_FEISHU_APP_ID',
      appSecret: 'NANOBOT_FEISHU_APP_SECRET',
      encryptKey: 'NANOBOT_FEISHU_ENCRYPT_KEY',
      verificationToken: 'NANOBOT_FEISHU_VERIFICATION_TOKEN',
    },
    defaults: {
      enabled: false,
      domain: 'feishu',
      groupPolicy: 'mention',
      streaming: true,
      replyToMessage: false,
      allowFrom: '*',
    },
  },
  dingtalk: {
    label: '钉钉',
    status: 'planned',
    defaults: { enabled: false, allowFrom: '*' },
  },
  wecom: {
    label: '企业微信',
    status: 'planned',
    defaults: { enabled: false, allowFrom: '*' },
  },
  whatsapp: {
    label: 'WhatsApp',
    status: 'planned',
    defaults: { enabled: false, allowFrom: '*' },
  },
  qq: {
    label: 'QQ',
    status: 'planned',
    defaults: { enabled: false, allowFrom: '*' },
  },
  weixin: {
    label: '微信',
    status: 'planned',
    defaults: { enabled: false, allowFrom: '*' },
  },
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function encryptSecret(value) {
  const text = String(value || '');
  if (!text) {
    return '';
  }
  if (!safeStorage.isEncryptionAvailable()) {
    return Buffer.from(text, 'utf8').toString('base64');
  }
  return safeStorage.encryptString(text).toString('base64');
}

function decryptSecret(value) {
  if (!value) {
    return '';
  }
  const buffer = Buffer.from(String(value), 'base64');
  if (!safeStorage.isEncryptionAvailable()) {
    return buffer.toString('utf8');
  }
  try {
    return safeStorage.decryptString(buffer);
  } catch (_) {
    return '';
  }
}

function redactChannel(channelName, channel) {
  const copy = { ...channel };
  const envMap = CHANNELS[channelName] && CHANNELS[channelName].env;
  if (!envMap) {
    return copy;
  }
  for (const key of Object.keys(envMap)) {
    copy[key] = channel[key] ? '********' : '';
  }
  return copy;
}

class NanobotSettings {
  constructor({ userDataDir, rootDir, desktopDir, baseConfig }) {
    this.rootDir = rootDir;
    this.desktopDir = desktopDir;
    this.baseConfig = baseConfig;
    this.dir = path.join(userDataDir, 'nanobot');
    this.settingsPath = path.join(this.dir, 'channels.settings.json');
    this.runtimeConfigPath = path.join(this.dir, 'config.json');
    this.workspacePath = path.join(this.dir, 'workspace');
  }

  defaultSettings() {
    return {
      runMode: 'hybrid',
      model: {
        provider: 'deepseek',
        model: 'deepseek-chat',
        apiBase: 'https://api.deepseek.com',
        apiKey: '',
      },
      tools: {
        webSearch: true,
        restrictToWorkspace: true,
      },
      channels: Object.fromEntries(
        Object.entries(CHANNELS).map(([name, meta]) => [name, { ...meta.defaults }]),
      ),
    };
  }

  loadRaw() {
    return {
      ...this.defaultSettings(),
      ...readJson(this.settingsPath, {}),
    };
  }

  loadForRenderer() {
    const raw = this.loadRaw();
    return {
      ...raw,
      model: {
        ...raw.model,
        apiKey: raw.model && raw.model.apiKey ? '********' : '',
      },
      channels: Object.fromEntries(
        Object.entries(raw.channels || {}).map(([name, channel]) => [name, redactChannel(name, channel)]),
      ),
      runtimeConfigPath: this.runtimeConfigPath,
      workspacePath: this.workspacePath,
      availableChannels: Object.entries(CHANNELS).map(([id, meta]) => ({
        id,
        label: meta.label,
        status: meta.status,
      })),
    };
  }

  mergeSettings(next) {
    const current = this.loadRaw();
    const merged = {
      ...current,
      ...next,
      model: { ...current.model, ...(next.model || {}) },
      tools: { ...current.tools, ...(next.tools || {}) },
      channels: { ...current.channels },
    };

    for (const [name, value] of Object.entries(next.channels || {})) {
      const previous = current.channels[name] || {};
      const meta = CHANNELS[name] || {};
      const envMap = meta.env || {};
      const channel = { ...previous, ...value };
      for (const key of Object.keys(envMap)) {
        if (value[key] === '********') {
          channel[key] = previous[key] || '';
        } else if (value[key]) {
          channel[key] = encryptSecret(value[key]);
        }
      }
      merged.channels[name] = channel;
    }

    if (next.model && next.model.apiKey === '********') {
      merged.model.apiKey = current.model.apiKey || '';
    } else if (next.model && next.model.apiKey) {
      merged.model.apiKey = encryptSecret(next.model.apiKey);
    }

    writeJson(this.settingsPath, merged);
    this.writeRuntimeConfig(merged);
    return this.loadForRenderer();
  }

  envFromSettings(settings = this.loadRaw()) {
    const env = {};
    if (settings.model && settings.model.apiKey) {
      env.DEEPSEEK_API_KEY = decryptSecret(settings.model.apiKey);
    }
    for (const [name, meta] of Object.entries(CHANNELS)) {
      const channel = settings.channels && settings.channels[name];
      if (!channel || !meta.env) {
        continue;
      }
      for (const [field, envName] of Object.entries(meta.env)) {
        if (channel[field]) {
          env[envName] = decryptSecret(channel[field]);
        }
      }
    }
    return env;
  }

  channelConfig(name, channel) {
    if (name !== 'feishu') {
      return null;
    }
    if (!channel.enabled) {
      return null;
    }
    const required = ['appId', 'appSecret'];
    if (required.some((key) => !channel[key])) {
      return null;
    }
    return {
      enabled: true,
      appId: '${NANOBOT_FEISHU_APP_ID}',
      appSecret: '${NANOBOT_FEISHU_APP_SECRET}',
      allowFrom: this.allowFromList(channel.allowFrom),
      groupPolicy: channel.groupPolicy || 'mention',
      replyToMessage: Boolean(channel.replyToMessage),
      streaming: channel.streaming !== false,
      domain: channel.domain || 'feishu',
      ...(channel.encryptKey ? { encryptKey: '${NANOBOT_FEISHU_ENCRYPT_KEY}' } : {}),
      ...(channel.verificationToken ? { verificationToken: '${NANOBOT_FEISHU_VERIFICATION_TOKEN}' } : {}),
    };
  }

  allowFromList(value) {
    if (!value || value === '*') {
      return ['*'];
    }
    if (Array.isArray(value)) {
      return value;
    }
    return String(value)
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  writeRuntimeConfig(settings = this.loadRaw()) {
    ensureDir(this.dir);
    ensureDir(this.workspacePath);
    const enabledChannels = {};
    for (const [name, channel] of Object.entries(settings.channels || {})) {
      const generated = this.channelConfig(name, channel);
      if (generated) {
        enabledChannels[name] = generated;
      }
    }

    const runtime = {
      providers: {
        deepseek: {
          apiKey: '${DEEPSEEK_API_KEY}',
          apiBase: settings.model.apiBase || 'https://api.deepseek.com',
        },
      },
      agents: {
        defaults: {
          provider: settings.model.provider || 'deepseek',
          model: settings.model.model || 'deepseek-chat',
          workspace: this.workspacePath,
          timezone: 'Asia/Shanghai',
          unifiedSession: true,
          maxIterations: 20,
          maxConcurrentSubagents: 1,
          restrictToWorkspace: settings.tools.restrictToWorkspace !== false,
        },
      },
      api: {
        host: '127.0.0.1',
        port: 8900,
        timeout: 120,
      },
      gateway: {
        host: '127.0.0.1',
        port: 18790,
      },
      channels: {
        sendProgress: true,
        sendToolHints: true,
        ...enabledChannels,
      },
      tools: {
        restrictToWorkspace: settings.tools.restrictToWorkspace !== false,
        web: {
          enabled: settings.tools.webSearch !== false,
          search: {
            provider: 'tavily',
            apiKey: '${TAVILY_API_KEY}',
          },
        },
      },
    };
    writeJson(this.runtimeConfigPath, runtime);
  }

  applyToDesktopConfig(config) {
    const settings = this.loadRaw();
    this.writeRuntimeConfig(settings);
    const env = this.envFromSettings(settings);
    const runGateway = settings.runMode === 'hybrid' || settings.runMode === 'channels';
    const runServe = settings.runMode === 'hybrid' || settings.runMode === 'serve';

    const patchArgs = (mode) => {
      if (mode === 'gateway') {
        return [
          '-m',
          'nanobot',
          'gateway',
          '--port',
          '18790',
          '--config',
          this.runtimeConfigPath,
          '--workspace',
          this.workspacePath,
        ];
      }
      return [
        '-m',
        'nanobot',
        'serve',
        '--host',
        '127.0.0.1',
        '--port',
        '8900',
        '--config',
        this.runtimeConfigPath,
        '--workspace',
        this.workspacePath,
      ];
    };

    const nanobot = {
      ...config.nanobot,
      enabled: Boolean(config.nanobot && config.nanobot.enabled && runServe),
      args: patchArgs('serve'),
      env: { ...(config.nanobot.env || {}), ...env },
    };

    const nanobotGateway = {
      ...config.nanobot,
      enabled: Boolean(config.nanobot && config.nanobot.enabled && runGateway),
      port: 18790,
      healthUrl: 'http://127.0.0.1:18790/health',
      args: patchArgs('gateway'),
      env: { ...(config.nanobot.env || {}), ...env },
    };

    return {
      ...config,
      env: { ...(config.env || {}), ...env },
      nanobot,
      nanobotGateway,
    };
  }

  async status(config, processManager) {
    const settings = this.loadForRenderer();
    const services = {
      serve: {
        enabled: config.nanobot && config.nanobot.enabled,
        running: processManager && processManager.isRunning('nanobot'),
        healthUrl: config.nanobot && config.nanobot.healthUrl,
      },
      gateway: {
        enabled: config.nanobotGateway && config.nanobotGateway.enabled,
        running: processManager && processManager.isRunning('nanobotGateway'),
        healthUrl: config.nanobotGateway && config.nanobotGateway.healthUrl,
      },
    };

    for (const service of Object.values(services)) {
      if (!service.healthUrl) {
        service.healthy = false;
        continue;
      }
      try {
        await checkHealth(service.healthUrl);
        service.healthy = true;
      } catch (error) {
        service.healthy = false;
        service.reason = error.message;
      }
    }

    return { settings, services };
  }
}

module.exports = { NanobotSettings, CHANNELS };
