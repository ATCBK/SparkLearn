const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const SECRET_PATTERN = /(api[_-]?key|api[_-]?secret|token|authorization|password)=([^&\s]+)/gi;

class LogManager {
  constructor() {
    const baseDir = app ? app.getPath('userData') : process.cwd();
    this.logDir = path.join(baseDir, 'logs');
    fs.mkdirSync(this.logDir, { recursive: true });
    this.appLogPath = path.join(this.logDir, 'desktop.log');
  }

  mask(message) {
    return String(message).replace(SECRET_PATTERN, '$1=***');
  }

  write(level, message) {
    const line = `[${new Date().toISOString()}] [${level}] ${this.mask(message)}\n`;
    fs.appendFileSync(this.appLogPath, line, 'utf8');
  }

  info(message) {
    this.write('INFO', message);
  }

  warn(message) {
    this.write('WARN', message);
  }

  error(message) {
    this.write('ERROR', message);
  }

  streamPath(name, streamName) {
    return path.join(this.logDir, `${name}.${streamName}.log`);
  }
}

module.exports = { LogManager };
