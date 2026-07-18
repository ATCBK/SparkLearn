const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { loadConfig } = require('./config-loader');
const { LogManager } = require('./log-manager');
const { ProcessManager } = require('./process-manager');

let mainWindow;
let configWindow;
let processManager;
let logManager;
let config;
const AUTH_SESSION_FILE = 'auth-session.json';
const PROFILE_SYNC_DIRNAME = 'studybuddy';
const PROFILE_SYNC_FILENAME = 'live-profile.json';
const PROFILE_MEMORY_START = '<!-- STUDYBUDDY_PROFILE_START -->';
const PROFILE_MEMORY_END = '<!-- STUDYBUDDY_PROFILE_END -->';
const APP_ICON_PATH = path.join(__dirname, '..', 'assets', 'icon.png');

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
    return;
  }
  if (config) {
    createWindow();
  }
});

function getNanobotConfigPath() {
  return config?.env?.NANOBOT_CONFIG_PATH
    || path.join(config?.rootDir || path.resolve(__dirname, '..', '..'), 'nanobot-main', '.nanobot', 'config.json');
}

function getNanobotWorkspacePath() {
  const configPath = getNanobotConfigPath();
  const raw = readJson(configPath);
  return raw.agents?.defaults?.workspace
    || config?.env?.NANOBOT_WORKSPACE
    || path.join(config?.rootDir || path.resolve(__dirname, '..', '..'), 'nanobot-main', '.workspace');
}

function getAuthSessionPath() {
  return path.join(app.getPath('userData'), AUTH_SESSION_FILE);
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function prettyJson(value) {
  return `${JSON.stringify(value || {}, null, 2)}\n`;
}

function readAuthSession() {
  const session = readJson(getAuthSessionPath());
  if (!session || typeof session !== 'object') {
    return null;
  }
  return session;
}

function saveAuthSession(payload) {
  const token = String(payload?.token || '').trim();
  const user = payload?.user && typeof payload.user === 'object' ? payload.user : null;
  if (!token || !user) {
    throw new Error('Invalid auth session payload');
  }
  const session = {
    token,
    user,
    updatedAt: new Date().toISOString(),
  };
  writeJson(getAuthSessionPath(), session);
  return session;
}

function clearAuthSession() {
  const filePath = getAuthSessionPath();
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  return { cleared: true };
}

function getBackendProfileSnapshotPath() {
  return path.join(config?.rootDir || path.resolve(__dirname, '..', '..'), 'backend', 'data', 'users', 'single_user', 'profile_snapshot.json');
}

function getStudyBuddyProfilePath() {
  return path.join(getNanobotWorkspacePath(), PROFILE_SYNC_DIRNAME, PROFILE_SYNC_FILENAME);
}

function getMemoryFilePath() {
  return path.join(getNanobotWorkspacePath(), 'memory', 'MEMORY.md');
}

function formatProfileValue(value) {
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item).trim()).filter(Boolean);
    return items.length ? items.join('、') : '未提供';
  }
  const text = String(value || '').trim();
  return text || '未提供';
}

function renderStudyBuddyProfileSection(profileBundle) {
  const authUser = profileBundle.authUser || {};
  const profile = profileBundle.profile || {};
  const lines = [
    '## Current Synced Learner Profile',
    '',
    PROFILE_MEMORY_START,
    `- Synced at: ${profileBundle.syncedAt || new Date().toISOString()}`,
    `- Source: ${profileBundle.source || 'desktop'}`,
    `- User ID: ${formatProfileValue(authUser.user_id || profile.user_id)}`,
    `- Name: ${formatProfileValue(authUser.name || profile.name)}`,
    `- Phone: ${formatProfileValue(authUser.phone)}`,
    `- Major: ${formatProfileValue(profile.major)}`,
    `- Grade: ${formatProfileValue(profile.grade)}`,
    `- Learning Goal: ${formatProfileValue(profile.goal)}`,
    `- Current Stage: ${formatProfileValue(profile.current_stage)}`,
    `- Knowledge Level: ${formatProfileValue(profile.knowledge_level)}`,
    `- Weak Points: ${formatProfileValue(profile.weak_points)}`,
    `- Learning Preference: ${formatProfileValue(profile.learning_preference)}`,
    `- Cognitive Style: ${formatProfileValue(profile.cognitive_style)}`,
    `- Daily Time: ${profile.daily_time ? `${profile.daily_time} minutes` : '未提供'}`,
    `- Practical Ability: ${formatProfileValue(profile.practical_ability)}`,
    `- Profile Version: ${formatProfileValue(profile.version)}`,
    `- Next Use Rule: prioritize this synced profile when StudyBuddy gives recommendations, path guidance, resource suggestions, and practice follow-up.`,
    PROFILE_MEMORY_END,
  ];
  return `${lines.join('\n')}\n`;
}

function upsertStudyBuddyProfileSection(memoryPath, sectionText) {
  const current = fs.existsSync(memoryPath) ? fs.readFileSync(memoryPath, 'utf8') : '# StudyBuddy Long-term Memory\n\n';
  if (current.includes(PROFILE_MEMORY_START) && current.includes(PROFILE_MEMORY_END)) {
    const pattern = new RegExp(`${PROFILE_MEMORY_START}[\\s\\S]*?${PROFILE_MEMORY_END}`, 'm');
    return current.replace(pattern, `${PROFILE_MEMORY_START}\n${sectionText.split(PROFILE_MEMORY_START)[1].split(PROFILE_MEMORY_END)[0].trim()}\n${PROFILE_MEMORY_END}`);
  }
  return `${current.trimEnd()}\n\n${sectionText}`;
}

function syncStudyBuddyProfile(payload) {
  const backendProfile = readJson(getBackendProfileSnapshotPath());
  const authSession = readAuthSession();
  const profileBundle = {
    source: String(payload?.source || 'desktop'),
    syncedAt: new Date().toISOString(),
    authUser: payload?.user && typeof payload.user === 'object' ? payload.user : (authSession?.user || {}),
    profile: backendProfile && typeof backendProfile === 'object' ? backendProfile : {},
  };

  const profilePath = getStudyBuddyProfilePath();
  writeJson(profilePath, profileBundle);

  const memoryPath = getMemoryFilePath();
  fs.mkdirSync(path.dirname(memoryPath), { recursive: true });
  const nextMemory = upsertStudyBuddyProfileSection(memoryPath, renderStudyBuddyProfileSection(profileBundle));
  fs.writeFileSync(memoryPath, nextMemory, 'utf8');

  return {
    profilePath,
    memoryPath,
    syncedAt: profileBundle.syncedAt,
  };
}

function readStudyBuddyForm() {
  const configPath = getNanobotConfigPath();
  const raw = readJson(configPath);
  const defaults = raw.agents?.defaults || {};
  const providerName = defaults.provider && defaults.provider !== 'auto' ? defaults.provider : 'deepseek';
  const provider = raw.providers?.[providerName] || {};

  return {
    configPath,
    provider: providerName,
    model: defaults.model || config?.env?.NANOBOT_API_MODEL || 'deepseek-ai/DeepSeek-V3',
    botName: defaults.botName || defaults.bot_name || 'StudyBuddy',
    timezone: defaults.timezone || 'Asia/Shanghai',
    apiKey: provider.apiKey || provider.api_key || '',
    apiBase: provider.apiBase || provider.api_base || '',
    workspace: defaults.workspace || config?.env?.NANOBOT_WORKSPACE || path.join(config?.rootDir || '', 'nanobot-main', '.workspace'),
    apiHost: raw.api?.host || '127.0.0.1',
    apiPort: raw.api?.port || 8900,
    gatewayHost: raw.gateway?.host || '127.0.0.1',
    gatewayPort: raw.gateway?.port || 18790,
    restrictToWorkspace: Boolean(raw.tools?.restrictToWorkspace || raw.tools?.restrict_to_workspace),
    execEnabled: raw.tools?.exec?.enable !== false,
    execSandbox: raw.tools?.exec?.sandbox || '',
    execTimeout: raw.tools?.exec?.timeout ?? 60,
    execPathAppend: raw.tools?.exec?.pathAppend || raw.tools?.exec?.path_append || '',
    mcpServersJson: prettyJson(raw.tools?.mcpServers || raw.tools?.mcp_servers || {}),
    channelsJson: prettyJson(raw.channels || {}),
  };
}

function saveStudyBuddyForm(input) {
  const configPath = getNanobotConfigPath();
  const raw = readJson(configPath);
  const providerName = String(input.provider || 'deepseek').trim() || 'deepseek';
  const mcpServers = JSON.parse(String(input.mcpServersJson || '{}'));
  const channels = JSON.parse(String(input.channelsJson || '{}'));

  raw.agents = raw.agents || {};
  raw.agents.defaults = {
    ...(raw.agents.defaults || {}),
    provider: providerName,
    model: String(input.model || '').trim(),
    workspace: String(input.workspace || '').trim(),
    botName: String(input.botName || 'StudyBuddy').trim() || 'StudyBuddy',
    timezone: String(input.timezone || 'Asia/Shanghai').trim() || 'Asia/Shanghai',
  };

  raw.providers = raw.providers || {};
  raw.providers[providerName] = {
    ...(raw.providers[providerName] || {}),
    apiKey: String(input.apiKey || '').trim(),
    apiBase: String(input.apiBase || '').trim(),
  };

  raw.api = {
    ...(raw.api || {}),
    host: String(input.apiHost || '127.0.0.1').trim(),
    port: Number(input.apiPort || 8900),
  };

  raw.gateway = {
    ...(raw.gateway || {}),
    host: String(input.gatewayHost || '127.0.0.1').trim(),
    port: Number(input.gatewayPort || 18790),
  };

  raw.tools = {
    ...(raw.tools || {}),
    restrictToWorkspace: Boolean(input.restrictToWorkspace),
    mcpServers,
    exec: {
      ...(raw.tools?.exec || {}),
      enable: input.execEnabled !== false,
      sandbox: String(input.execSandbox || '').trim(),
      timeout: Number(input.execTimeout || 60),
      pathAppend: String(input.execPathAppend || '').trim(),
    },
  };
  raw.channels = channels;

  writeJson(configPath, raw);
  return readStudyBuddyForm();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    title: 'SparkLearn',
    icon: APP_ICON_PATH,
    backgroundColor: '#f7f4ee',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'loading.html'));
}

function loadFrontendWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  }

  const startUrl = `${config.frontend.url.replace(/\/$/, '')}/`;
  mainWindow.loadURL(startUrl);
}

function createConfigWindow() {
  if (configWindow && !configWindow.isDestroyed()) {
    configWindow.focus();
    return;
  }

  configWindow = new BrowserWindow({
    width: 960,
    height: 860,
    minWidth: 820,
    minHeight: 700,
    title: 'StudyBuddy 配置',
    icon: APP_ICON_PATH,
    backgroundColor: '#f8fafc',
    parent: mainWindow || undefined,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  configWindow.loadFile(path.join(__dirname, '..', 'renderer', 'studybuddy-config.html'));
  configWindow.on('closed', () => {
    configWindow = null;
  });
}

function installMenu() {
  const template = [
    {
      label: 'SparkLearn',
      submenu: [
        { label: 'StudyBuddy 配置', click: createConfigWindow },
        { label: '打开日志目录', click: () => shell.openPath(logManager.logDir) },
        { type: 'separator' },
        { label: '退出', role: 'quit' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function bootstrap() {
  try {
  logManager = new LogManager();
  config = loadConfig();
  processManager = new ProcessManager(config, logManager);

  ipcMain.handle('desktop:get-status', () => ({
    frontendUrl: config.frontend.url,
    backendUrl: config.backend.healthUrl,
    logDir: logManager.logDir,
  }));
  ipcMain.handle('desktop:open-logs', () => shell.openPath(logManager.logDir));
  ipcMain.handle('desktop:studybuddy-config:open', () => createConfigWindow());
  ipcMain.handle('desktop:studybuddy-config:get', () => readStudyBuddyForm());
  ipcMain.handle('desktop:studybuddy-config:save', (_event, payload) => saveStudyBuddyForm(payload || {}));
  ipcMain.handle('desktop:studybuddy-config:open-file', () => shell.openPath(getNanobotConfigPath()));
  ipcMain.handle('desktop:auth:get', () => readAuthSession());
  ipcMain.handle('desktop:auth:save', (_event, payload) => saveAuthSession(payload || {}));
  ipcMain.handle('desktop:auth:clear', () => clearAuthSession());
  ipcMain.handle('desktop:studybuddy-profile:sync', (_event, payload) => syncStudyBuddyProfile(payload || {}));

  try {
    installMenu();
    createWindow();
    await processManager.startAll();
    loadFrontendWindow();
  } catch (error) {
    logManager.error(error.stack || error.message);
    dialog.showErrorBox(
      'SparkLearn 启动失败',
      `${error.message}\n\n日志目录：${logManager.logDir}`,
    );
    app.quit();
  }
  } catch (error) {
    if (logManager) {
      logManager.error(error.stack || error.message);
    }
    dialog.showErrorBox(
      'SparkLearn 启动失败',
      `${error.message}\n\n日志目录：${logManager ? logManager.logDir : app.getPath('userData')}`,
    );
    app.quit();
  }
}

app.whenReady().then(bootstrap);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && config) {
    createWindow();
  }
});

app.on('before-quit', async (event) => {
  if (!processManager || processManager.shuttingDown) {
    return;
  }
  event.preventDefault();
  await processManager.stopAll();
  app.quit();
});
