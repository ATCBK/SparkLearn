async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkHealth(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}

async function waitForHealth(url, options) {
  const timeoutMs = options.timeoutMs || 60000;
  const intervalMs = options.intervalMs || 1000;
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      await checkHealth(url);
      return;
    } catch (error) {
      lastError = error;
      await sleep(intervalMs);
    }
  }

  throw new Error(`Health check timed out for ${url}: ${lastError ? lastError.message : 'no response'}`);
}

module.exports = { checkHealth, waitForHealth };
