// Playwright launchServer() supervisor. The Python-side browser pool spawns
// this as a subprocess, reads the ws endpoint from stdout, and keeps stdin
// open — we shut down when stdin closes (parent died) or on SIGTERM/SIGINT.
//
// Protocol on stdout: a single JSON line  {"wsEndpoint":"ws://..."}\n
// followed by no further output (errors go to stderr).

import { chromium } from 'playwright';

const server = await chromium.launchServer({});
const wsEndpoint = server.wsEndpoint();

process.stdout.write(JSON.stringify({ wsEndpoint }) + '\n');

let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    await server.close();
  } catch {
    // ignore — parent is tearing us down anyway
  }
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.stdin.on('end', shutdown);
process.stdin.on('close', shutdown);
process.stdin.resume();
