const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('node:path');
const { loadConfig } = require('./config-loader');
const { LogManager } = require('./log-manager');
const { ProcessManager } = require('./process-manager');
const { NanobotSettings } = require('./nanobot-settings');

let mainWindow;
let processManager;
let logManager;
let config;
let nanobotSettings;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    title: 'SparkLearn',
    backgroundColor: '#f7f4ee',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const startUrl = `${config.frontend.url.replace(/\/$/, '')}/auth?desktop=1&recapture=1`;
  mainWindow.loadURL(startUrl);
}

async function bootstrap() {
  logManager = new LogManager();
  config = loadConfig();
  nanobotSettings = new NanobotSettings({
    userDataDir: app.getPath('userData'),
    rootDir: config.rootDir,
    desktopDir: config.desktopDir,
    baseConfig: config,
  });
  config = nanobotSettings.applyToDesktopConfig(config);
  processManager = new ProcessManager(config, logManager);

  ipcMain.handle('desktop:get-status', () => ({
    frontendUrl: config.frontend.url,
    backendUrl: config.backend.healthUrl,
    nanobotUrl: config.nanobot.healthUrl,
    nanobotGatewayUrl: config.nanobotGateway && config.nanobotGateway.healthUrl,
    logDir: logManager.logDir,
  }));

  ipcMain.handle('desktop:open-logs', () => shell.openPath(logManager.logDir));

  ipcMain.handle('nanobot:get-config', () => nanobotSettings.loadForRenderer());

  ipcMain.handle('nanobot:save-config', async (_event, payload) => {
    const saved = nanobotSettings.mergeSettings(payload || {});
    config = nanobotSettings.applyToDesktopConfig(config);
    processManager.config = config;
    return saved;
  });

  ipcMain.handle('nanobot:get-status', async () => nanobotSettings.status(config, processManager));

  ipcMain.handle('nanobot:restart-gateway', async () => {
    config = nanobotSettings.applyToDesktopConfig(config);
    processManager.config = config;
    await processManager.restartService('nanobotGateway', config.nanobotGateway);
    return nanobotSettings.status(config, processManager);
  });

  ipcMain.handle('nanobot:restart-serve', async () => {
    config = nanobotSettings.applyToDesktopConfig(config);
    processManager.config = config;
    await processManager.restartService('nanobot', config.nanobot);
    return nanobotSettings.status(config, processManager);
  });

  try {
    await processManager.startAll();
    createWindow();
  } catch (error) {
    logManager.error(error.stack || error.message);
    dialog.showErrorBox(
      'SparkLearn 启动失败',
      `${error.message}\n\n日志目录：${logManager.logDir}`,
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
