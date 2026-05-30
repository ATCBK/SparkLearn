const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('node:path');
const { loadConfig } = require('./config-loader');
const { LogManager } = require('./log-manager');
const { ProcessManager } = require('./process-manager');

let mainWindow;
let processManager;
let logManager;
let config;

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

  mainWindow.loadURL(config.frontend.url);
}

async function bootstrap() {
  logManager = new LogManager();
  config = loadConfig();
  processManager = new ProcessManager(config, logManager);

  ipcMain.handle('desktop:get-status', () => ({
    frontendUrl: config.frontend.url,
    backendUrl: config.backend.healthUrl,
    nanobotUrl: config.nanobot.healthUrl,
    logDir: logManager.logDir,
  }));

  ipcMain.handle('desktop:open-logs', () => shell.openPath(logManager.logDir));

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
