const net = require('node:net');
const { execFile } = require('node:child_process');

function canBindPort(host, port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

function getPortPid(port) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve('');
      return;
    }

    const script = `(Get-NetTCPConnection -LocalPort ${Number(port)} -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)`;
    execFile('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true }, (error, stdout) => {
      if (error) {
        resolve('');
        return;
      }
      resolve(stdout.trim());
    });
  });
}

async function assertPortFree(serviceName, service) {
  const free = await canBindPort(service.host || '127.0.0.1', service.port);
  if (free) {
    return;
  }

  const pid = await getPortPid(service.port);
  const suffix = pid ? ` PID: ${pid}` : '';
  throw new Error(`${serviceName} port ${service.port} is already in use.${suffix}`);
}

module.exports = { assertPortFree, canBindPort, getPortPid };
