const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { loadConfig } = require('../main/config-loader');

function commandOk(command, args) {
  if (process.platform === 'win32') {
    const quote = (part) => /\s/.test(String(part)) ? `"${String(part).replace(/"/g, '""')}"` : String(part);
    const line = [command, ...args].map(quote).join(' ');
    const result = spawnSync('cmd.exe', ['/d', '/c', line], {
      stdio: 'pipe',
      shell: false,
      encoding: 'utf8',
    });
    return result.status === 0;
  }

  const candidates = process.platform === 'win32' && !/\.(exe|cmd|bat)$/i.test(command)
    ? [command, `${command}.cmd`, `${command}.exe`]
    : [command];

  for (const candidate of candidates) {
    const result = spawnSync(candidate, args, {
      stdio: 'pipe',
      shell: false,
      encoding: 'utf8',
    });
    if (result.status === 0) {
      return true;
    }
  }
  return false;
}

function checkService(name, service) {
  const issues = [];
  if (!fs.existsSync(service.cwd)) {
    issues.push(`${name}: cwd missing (${service.cwd})`);
  }
  return issues;
}

const config = loadConfig();
const issues = [
  ...checkService('frontend', config.frontend),
  ...checkService('backend', config.backend),
];

if (!commandOk('node', ['--version'])) {
  issues.push('node: command not available');
}
if (!commandOk('npm', ['--version'])) {
  issues.push('npm: command not available');
}
if (!commandOk(config.backend.command, ['--version'])) {
  issues.push(`backend python: command not available (${config.backend.command})`);
}
if (issues.length) {
  console.error('SparkLearn desktop environment issues:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log('SparkLearn desktop environment looks ready.');
