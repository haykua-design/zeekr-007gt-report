// Cross-platform script to start Vite dev server and run browser tests.
// Uses dev mode so errors report TSX source paths and line numbers directly.
// Usage: node _internal/start-preview-and-test.mjs

import { spawn } from 'child_process';
import { createServer } from 'http';
import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Track processes for cleanup
let devProcess = null;
let checkProcess = null;
let isCleaningUp = false;

function parsePositiveInt(raw, defaultValue) {
  if (raw == null || raw === '') return defaultValue;
  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return parsed;
}

function parseBoolean(raw, defaultValue = true) {
  if (raw == null || raw === '') return defaultValue;
  const normalized = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

async function ensurePlaywrightChromiumInstalled() {
  const autoInstall = parseBoolean(process.env.DDT_AUTO_INSTALL_PLAYWRIGHT, true);
  if (!autoInstall) return;

  console.log('Ensuring Playwright Chromium runtime is installed...');
  const proc =
    process.platform === 'win32'
      ? spawn('npx playwright install chromium', [], {
          cwd: projectRoot,
          stdio: ['ignore', 'inherit', 'inherit'],
          shell: true,
        })
      : spawn('npx', ['playwright', 'install', 'chromium'], {
          cwd: projectRoot,
          stdio: ['ignore', 'inherit', 'inherit'],
          shell: false,
        });

  const exitCode = await new Promise((resolve, reject) => {
    proc.on('error', reject);
    proc.on('exit', (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    throw new Error(
      'Playwright chromium install failed. ' +
        'Set DDT_AUTO_INSTALL_PLAYWRIGHT=0 to disable auto-install and install manually.',
    );
  }
}

// Find a free port
function findFreePort(startPort = 4173) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(startPort, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        findFreePort(startPort + 1).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

// Wait for HTTP server to be ready
function waitForServer(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const requestFn = url.startsWith('https') ? httpsRequest : httpRequest;
    const check = () => {
      const req = requestFn(url, { method: 'GET' }, (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          // Vite dev server might return 200 or other success codes
          if (res.statusCode < 400) {
            resolve();
          } else {
            if (Date.now() - startTime > timeout) {
              reject(new Error(`Server not ready after ${timeout}ms`));
            } else {
              setTimeout(check, 500);
            }
          }
        });
      });
      req.on('error', () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Server not ready after ${timeout}ms`));
        } else {
          setTimeout(check, 500);
        }
      });
      req.end();
    };
    check();
  });
}

// Signal a POSIX process group. proc is expected to be spawned with
// detached:true so it became its own group leader (PGID==PID). Signaling
// -pid sends to every member, which is the only reliable way to take down
// npx → vite → esbuild together; sending to proc.pid alone only kills npx
// and leaves vite running as an orphan (the inotify-leak failure mode).
function killGroup(proc, sig) {
  try {
    process.kill(-proc.pid, sig);
  } catch (err) {
    // Group already gone, or never created (e.g., detached failed) — fall
    // back to signaling the immediate child.
    try { proc.kill(sig); } catch (_) { /* ignore */ }
  }
}

// Kill process and wait for it to exit
async function killProcessAndWait(proc, timeout = 2000) {
  if (!proc || proc.killed) return;

  try {
    if (process.platform === 'win32') {
      // On Windows, use taskkill to ensure the whole process tree is killed
      // taskkill is an executable, so we can use shell: false to avoid DEP0190 warning
      try {
        const taskkillProcess = spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t'], {
          shell: false,
          stdio: 'ignore'
        });
        // Wait for taskkill to complete
        await new Promise((resolve) => {
          taskkillProcess.on('exit', resolve);
          taskkillProcess.on('error', resolve);
          setTimeout(resolve, 1000); // Timeout after 1s
        });
      } catch (err) {
        // Fallback to direct kill
        proc.kill();
      }
    } else {
      killGroup(proc, 'SIGTERM');
    }

    // Wait for process to exit
    await new Promise((resolve) => {
      if (proc.killed) {
        resolve();
        return;
      }
      proc.on('exit', resolve);
      proc.on('error', resolve);
      setTimeout(() => {
        // Force kill if still running
        if (!proc.killed) {
          if (process.platform === 'win32') {
            try { proc.kill('SIGKILL'); } catch (_) { /* ignore */ }
          } else {
            killGroup(proc, 'SIGKILL');
          }
        }
        resolve();
      }, timeout);
    });
  } catch (err) {
    // Ignore errors during cleanup
  }
}

// Cleanup all processes
async function cleanup() {
  if (isCleaningUp) return;
  isCleaningUp = true;
  
  // Kill check process first
  if (checkProcess) {
    await killProcessAndWait(checkProcess, 5000);
    checkProcess = null;
  }
  
  // Kill dev process
  if (devProcess) {
    await killProcessAndWait(devProcess, 2000);
    devProcess = null;
  }
}

// Setup signal handlers for graceful shutdown
process.on('SIGINT', async () => {
  console.error('\n[Interrupted] Cleaning up processes...');
  await cleanup();
  process.exit(130); // Exit code 130 for SIGINT
});

process.on('SIGTERM', async () => {
  console.error('\n[Terminated] Cleaning up processes...');
  await cleanup();
  process.exit(143); // Exit code 143 for SIGTERM
});

async function main() {
  try {
    await ensurePlaywrightChromiumInstalled();

    // Find a free port
    const defaultPort = 4173;
    const port = await findFreePort(defaultPort);
    if (port !== defaultPort) {
      console.warn(`Port ${defaultPort} is in use. Using ${port} instead. If this is from a previous run, end the process using that port and retry.`);
    }
    const devUrl = `http://127.0.0.1:${port}`;

    // Start Vite dev server (so errors report TSX source paths and line numbers)
    console.log(`Starting Vite dev server on ${devUrl}...`);
    
    // Cross-platform pnpm command handling
    // On Windows: use shell:true with command string to avoid EINVAL error
    // On Linux: use shell:false with array to avoid DEP0190 warning
    if (process.platform === 'win32') {
      const devCmd = `npx vite --port ${port} --host 127.0.0.1 --strictPort`;
      devProcess = spawn(devCmd, [], {
        cwd: projectRoot,
        stdio: ['ignore', 'inherit', 'inherit'],
        shell: true,
      });
    } else {
      // detached:true makes the child a new process-group leader so that
      // killGroup() can take down npx + vite + esbuild in one signal.
      // Without this, SIGTERM to npx leaves vite running as an orphan and
      // leaks inotify watches across runs.
      devProcess = spawn('npx', ['vite', '--port', String(port), '--host', '127.0.0.1', '--strictPort'], {
        cwd: projectRoot,
        stdio: ['ignore', 'inherit', 'inherit'],
        shell: false,
        detached: true,
      });
    }

    // Handle dev process errors
    devProcess.on('error', async (err) => {
      console.error(`Dev process error: ${err.message}`);
      await cleanup();
      process.exit(1);
    });

    // Wait for dev server to be ready
    try {
      await waitForServer(devUrl, 30000);
      console.log(`Dev server is ready at ${devUrl}`);
    } catch (err) {
      console.error(`Failed to start dev server: ${err.message}`);
      await cleanup();
      process.exit(1);
    }

    // Run browser check
    console.log('Running browser tests...');
    try {
      checkProcess = spawn('node', [join(__dirname, 'check-browser.mjs'), devUrl], {
        cwd: projectRoot,
        stdio: ['ignore', 'pipe', 'pipe'], // stdin: ignore (prevent terminal hijacking), stdout: pipe, stderr: pipe
        shell: false,
      });
    } catch (err) {
      console.error(`Failed to start browser check process: ${err.message}`);
      await cleanup();
      process.exit(1);
    }
    
    // Forward stdout to parent stdout (for success messages)
    checkProcess.stdout.on('data', (data) => {
      process.stdout.write(data);
    });
    
    // Forward stderr to parent stderr (for error messages)
    checkProcess.stderr.on('data', (data) => {
      process.stderr.write(data);
    });

    // Wait for check to complete with timeout (2 minutes for browser check)
    const checkTimeout = parsePositiveInt(process.env.DDT_BROWSER_CHECK_TIMEOUT_MS, 240000);
    const checkExitCode = await new Promise((resolve) => {
      let timeoutId;
      let resolved = false;
      
      const cleanupPromise = (code) => {
        if (resolved) return;
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        
        // If detection failed, ensure we notify about it in stderr
        if (code !== 0) {
          console.error(`\n[Browser Check] Failed with exit code ${code}`);
        }
        
        resolve(code);
      };
      
      checkProcess.on('exit', (code) => {
        cleanupPromise(code);
      });
      
      checkProcess.on('error', (err) => {
        console.error(`Browser check process error: ${err.message}`);
        cleanupPromise(1);
      });
      
      // Set timeout to kill process if it hangs
      timeoutId = setTimeout(() => {
        if (!resolved) {
          console.error(`Browser check timed out after ${checkTimeout / 1000}s. Killing process...`);
          try {
            checkProcess.kill('SIGTERM');
            // Force kill after 5 seconds if still running
            setTimeout(() => {
              if (!checkProcess.killed) {
                try {
                  checkProcess.kill('SIGKILL');
                } catch (err) {
                  // Ignore errors
                }
              }
            }, 5000);
          } catch (err) {
            console.error(`Failed to kill browser check process: ${err.message}`);
          }
          cleanupPromise(1);
        }
      }, checkTimeout);
    });

    // Cleanup dev server
    await cleanup();

    process.exit(checkExitCode || 0);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    await cleanup();
    process.exit(1);
  }
}

main();
