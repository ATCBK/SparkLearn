const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { assertPortFree } = require('./port-utils');
const { waitForHealth, checkHealth } = require('./health-checker');

class ProcessManager {
  constructor(config, logManager) {
    this.config = config;
    this.logManager = logManager;
    this.children = new Map();
    this.restartCounts = new Map();
    this.shuttingDown = false;
  }

  async startAll() {
    await this.startService('backend', this.config.backend);
    await this.startService('frontend', this.config.frontend);
    this.startNanobotGateway().catch((error) => {
      this.logManager.error(`nanobotGateway startup failed: ${error.message}`);
    });
  }

  getNanobotGatewayConfig() {
    const rootDir = this.config.rootDir || path.resolve(__dirname, '..', '..');
    const projectDir = this.config.env?.NANOBOT_PROJECT_DIR || path.join(rootDir, 'nanobot-main');
    const configPath = this.config.env?.NANOBOT_CONFIG_PATH || path.join(projectDir, '.nanobot', 'config.json');
    const workspace = this.config.env?.NANOBOT_WORKSPACE || path.join(projectDir, '.workspace');
    const pythonExe = this.config.env?.NANOBOT_PYTHON_EXE || 'python';

    return {
      enabled: true,
      required: false,
      cwd: projectDir,
      command: pythonExe,
      args: ['-m', 'nanobot', 'gateway', '--port', '18790', '--config', configPath, '--workspace', workspace],
      healthUrl: 'http://127.0.0.1:18790/health',
    };
  }

  async startNanobotGateway() {
    const service = this.getNanobotGatewayConfig();

    if (!fs.existsSync(service.cwd)) {
      this.logManager.warn(`nanobotGateway cwd does not exist: ${service.cwd}; skipping`);
      return;
    }

    if (service.command.includes('\\') || service.command.includes('/')) {
      if (!fs.existsSync(service.command)) {
        this.logManager.warn(`nanobotGateway command does not exist: ${service.command}; falling back to python`);
        service.command = 'python';
      }
    }

    try {
      await checkHealth(service.healthUrl);
      this.logManager.info(`nanobotGateway already healthy at ${service.healthUrl}`);
      return;
    } catch (_) {
      await assertPortFree('nanobotGateway', service);
    }

    this.logManager.info(`Starting nanobotGateway: ${service.command} ${service.args.join(' ')}`);
    const child = spawn(service.command, service.args, {
      cwd: service.cwd,
      env: {
        ...process.env,
        ...(this.config.env || {}),
      },
      shell: process.platform === 'win32',
      windowsHide: true,
      detached: false,
    });

    this.children.set('nanobotGateway', child);
    this.pipeLogs('nanobotGateway', child);
    this.watchExit('nanobotGateway', service, child);

    await waitForHealth(service.healthUrl, {
      timeoutMs: this.config.startup.healthTimeoutMs,
      intervalMs: this.config.startup.healthIntervalMs,
    });
    this.logManager.info(`nanobotGateway healthy at ${service.healthUrl}`);
  }

  async startService(name, service) {
    if (!service || !service.enabled) {
      this.logManager.info(`${name} disabled`);
      return;
    }

    if (!fs.existsSync(service.cwd)) {
      const message = `${name} cwd does not exist: ${service.cwd}`;
      if (service.required) {
        throw new Error(message);
      }
      this.logManager.warn(`${message}; skipping optional service`);
      return;
    }

    if (service.command.includes('\\') || service.command.includes('/')) {
      if (!fs.existsSync(service.command)) {
        const message = `${name} command does not exist: ${service.command}`;
        if (service.required) {
          throw new Error(message);
        }
        this.logManager.warn(`${message}; skipping optional service`);
        return;
      }
    }

    try {
      if (service.healthUrl) {
        await checkHealth(service.healthUrl);
        this.logManager.info(`${name} already healthy at ${service.healthUrl}`);
        return;
      }
    } catch (_) {
      try {
        await assertPortFree(name, service);
      } catch (error) {
        if (service.required) {
          throw error;
        }
        this.logManager.warn(`${error.message}; reusing existing ${name} process`);
        return;
      }
    }

    this.logManager.info(`Starting ${name}: ${service.command} ${(service.args || []).join(' ')}`);
    const apiBaseUrl =
      this.config.api?.baseUrl ||
      this.config.env?.NEXT_PUBLIC_API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      'http://127.0.0.1:8000';
    const child = spawn(service.command, service.args || [], {
      cwd: service.cwd,
      env: {
        ...process.env,
        ...(this.config.env || {}),
        BROWSER: 'none',
        NEXT_PUBLIC_API_BASE_URL: apiBaseUrl,
        ...(service.env || {}),
      },
      shell: process.platform === 'win32',
      windowsHide: true,
      detached: false,
    });

    this.children.set(name, child);
    this.pipeLogs(name, child);
    this.watchExit(name, service, child);

    if (service.healthUrl) {
      await waitForHealth(service.healthUrl, {
        timeoutMs: this.config.startup.healthTimeoutMs,
        intervalMs: this.config.startup.healthIntervalMs,
      });
      this.logManager.info(`${name} healthy at ${service.healthUrl}`);
    }
  }

  isRunning(name) {
    const child = this.children.get(name);
    return Boolean(child && !child.killed);
  }

  async restartService(name, service) {
    await this.stopService(name);
    this.restartCounts.set(name, 0);
    await this.startService(name, service);
  }

  pipeLogs(name, child) {
    const stdoutPath = this.logManager.streamPath(name, 'stdout');
    const stderrPath = this.logManager.streamPath(name, 'stderr');
    const stdout = fs.createWriteStream(stdoutPath, { flags: 'a' });
    const stderr = fs.createWriteStream(stderrPath, { flags: 'a' });
    child.stdout && child.stdout.pipe(stdout);
    child.stderr && child.stderr.pipe(stderr);
  }

  watchExit(name, service, child) {
    child.once('exit', async (code, signal) => {
      if (this.children.get(name) === child) {
        this.children.delete(name);
      }
      this.logManager.warn(`${name} exited with code=${code} signal=${signal}`);
      if (this.shuttingDown) {
        return;
      }

      const used = this.restartCounts.get(name) || 0;
      const limit = this.config.startup.restartLimit || 0;
      if (used >= limit) {
        this.logManager.error(`${name} restart limit reached`);
        return;
      }

      this.restartCounts.set(name, used + 1);
      try {
        await this.startService(name, service);
      } catch (error) {
        this.logManager.error(`${name} restart failed: ${error.message}`);
      }
    });
  }

  async stopAll() {
    this.shuttingDown = true;
    await this.stopService('nanobotGateway');
    await this.stopService('frontend');
    await this.stopService('backend');
  }

  async stopService(name) {
    const child = this.children.get(name);
    if (!child) {
      return;
    }

    this.logManager.info(`Stopping ${name} pid=${child.pid}`);
    this.children.delete(name);
    await new Promise((resolve) => {
      child.once('exit', resolve);
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
          windowsHide: true,
          shell: false,
        }).once('exit', resolve);
      } else {
        child.kill('SIGTERM');
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
          resolve();
        }, 5000);
      }
    });
  }
}

module.exports = { ProcessManager };
