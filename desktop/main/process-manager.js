const fs = require('node:fs');
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
    await this.startService('nanobot', this.config.nanobot);
    await this.startService('backend', this.config.backend);
    await this.startService('frontend', this.config.frontend);
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
      await assertPortFree(name, service);
    }

    this.logManager.info(`Starting ${name}: ${service.command} ${(service.args || []).join(' ')}`);
    const child = spawn(service.command, service.args || [], {
      cwd: service.cwd,
      env: {
        ...process.env,
        ...(this.config.env || {}),
        ...(service.env || {}),
        BROWSER: 'none',
        NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:8000',
        NANOBOT_AUTO_START: 'false',
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
    await this.stopService('frontend');
    await this.stopService('backend');
    await this.stopService('nanobot');
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
