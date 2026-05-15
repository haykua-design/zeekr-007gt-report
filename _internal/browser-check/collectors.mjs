import { parseStackLocation } from './url-utils.mjs';

// Chrome's console API uses printf-style %s/%d/%o substitutions; Playwright's
// `msg.text()` returns the format template with literal `%s` instead of the
// substituted form. This produces unreadable errors like
// "React does not recognize the `%s` prop on a DOM element ... activeClassName"
// where the agent has to manually splice the trailing args into the template.
// We mirror Chrome's substitution so the captured `text` reads naturally.
function formatConsoleTemplate(template, values) {
  let i = 0;
  return template.replace(/%[sdifoOcj]/g, (match) => {
    if (match === '%c') return ''; // CSS spec — consumes a style arg, prints nothing
    if (i >= values.length) return match;
    const v = values[i++];
    if (match === '%s') return String(v);
    if (match === '%d' || match === '%i') {
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? String(n) : String(v);
    }
    if (match === '%f') {
      const n = parseFloat(v);
      return Number.isFinite(n) ? String(n) : String(v);
    }
    try {
      return typeof v === 'object' ? JSON.stringify(v) : String(v);
    } catch {
      return String(v);
    }
  });
}

async function getInterpolatedText(msg) {
  let text = '';
  try {
    text = msg.text();
  } catch {
    return '';
  }
  if (!text || !/%[sdifoOcj]/.test(text)) return text;
  if (typeof msg.args !== 'function') return text;
  try {
    const handles = msg.args();
    if (!Array.isArray(handles) || handles.length <= 1) return text;
    const values = await Promise.all(
      handles.slice(1).map((h) => h.jsonValue().catch(() => undefined)),
    );
    return formatConsoleTemplate(text, values);
  } catch {
    return text;
  }
}

const REACT_WARNING_PATTERNS = [
  /Invalid value for prop.*className/i,
  /Invalid value for prop.*on.*tag/i,
  /Unknown event handler property/i,
  /Received.*for a non-boolean attribute/i,
  /outside.*Router/i,
  /No\s+routes\s+matched\s+location/i,
];

const REACT_HOOK_ERROR_PATTERNS = [
  /Invalid hook call/i,
  /Hooks can only be called inside/i,
  /rendered more hooks than during the previous render/i,
  /rendered fewer hooks than expected/i,
  /Cannot read.*useState/i,
  /Cannot read.*useEffect/i,
  /Cannot read.*useContext/i,
  /Cannot read.*useReducer/i,
  /Minified React error #\d+/i,
];

const ENTERPRISE_DOMAINS = ['hwa.his.huawei.com', 'huawei.com', 'his.huawei.com'];

// Canonical map-tile hosts referenced by `src/lib/map.ts` `TILES`. Headless
// browsers in restricted-network sandboxes routinely fail to fetch these
// (`ERR_ABORTED`, `ERR_NAME_NOT_RESOLVED`, etc.), which previously left the
// coder with no green-build path other than commenting `<TileLayer>` out.
// Ignoring tile-host failures by *host* (not by errorText) lets a legit
// `<TileLayer>` pass the check while the static `check:tile-presence` lint
// keeps the markup honest. Keep this list in sync with `TILES` in
// `src/lib/map.ts`; if a future template adds another tile provider, list it
// here too.
export const CANONICAL_TILE_HOSTS = [
  'tile.openstreetmap.org',
  'basemaps.cartocdn.com',
];

function mergePageContext(page, getPageContext, payload) {
  const context = getPageContext(page);
  return {
    ...payload,
    route: context.route,
    routeUrl: context.url,
    pageId: context.pageId,
    contextType: context.contextType,
    sourceUrl: context.sourceUrl,
  };
}

// Vite's dev server pre-bundles deps under `/.vite/deps/*.js?v=<hash>`. When it
// discovers a new dep mid-load it triggers a full page reload, aborting any
// in-flight dep requests with net::ERR_ABORTED. The reloaded page is fine —
// the aborted request is a false alarm, so we suppress it in every policy.
export function isViteDevDepAbort({ url, errorText, isLocalhost }) {
  if (!isLocalhost || !errorText) return false;
  if (!errorText.includes('ERR_ABORTED')) return false;
  return url.includes('/.vite/deps/') || url.includes('/@vite/') || url.includes('/@fs/');
}

export function shouldIgnoreRequestFailureBalanced({ url, errorText, isLocalhost }) {
  if (ENTERPRISE_DOMAINS.some((domain) => url.includes(domain))) {
    return { ignore: true };
  }

  // Canonical tile hosts: ignore by host regardless of errorText. Tile
  // fetches in headless sandboxes typically fail with ERR_ABORTED on context
  // teardown or ERR_NAME_NOT_RESOLVED with restrictive DNS — neither is a
  // signal that the *page* is broken, just that the headless environment
  // can't reach the tile CDN. Pair: `check:tile-presence` enforces the
  // static markup so the basemap can't be silently dropped.
  if (CANONICAL_TILE_HOSTS.some((host) => url.includes(host))) {
    return { ignore: true };
  }

  if (!errorText) {
    return { ignore: false };
  }

  if (
    errorText.includes('net::ERR_TIMED_OUT') ||
    errorText.includes('TIMED_OUT') ||
    errorText.includes('timeout') ||
    errorText.includes('504')
  ) {
    return { ignore: true };
  }

  if (
    errorText.includes('ERR_TUNNEL_CONNECTION_FAILED') ||
    errorText.includes('TUNNEL_CONNECTION_FAILED')
  ) {
    return { ignore: true };
  }

  if (isLocalhost && (errorText.includes('ERR_PROXY') || errorText.includes('ERR_CONNECTION'))) {
    return {
      ignore: false,
      isLocalProxyDiagnostic: true,
      diagnostic: errorText.includes('ERR_CONNECTION_REFUSED')
        ? 'Connection refused: ensure the dev server is running at this URL (e.g. run start_dev first).'
        : 'This may be caused by corporate proxy settings. Ensure NO_PROXY includes localhost and 127.0.0.1',
    };
  }

  return { ignore: false };
}

export async function installUnhandledRejectionBridge(context, { reporter, getPageContext }) {
  try {
    await context.exposeBinding('__ddtReportRejection', (source, payload) => {
      const page = source && source.page ? source.page : null;
      const message = payload && payload.message != null ? String(payload.message) : '';
      if (!message) return;

      reporter.pushError(
        mergePageContext(page, getPageContext, {
          type: 'unhandledrejection',
          message,
          stack: payload && payload.stack != null ? String(payload.stack) : undefined,
          href: payload && payload.href ? String(payload.href) : undefined,
        }),
      );
    });
  } catch {
    // binding may already exist
  }

  await context.addInitScript(() => {
    window.addEventListener('unhandledrejection', (event) => {
      try {
        const reason = event.reason;
        const message =
          reason != null && typeof reason === 'object' && 'message' in reason
            ? String(reason.message)
            : String(reason);
        const stack =
          reason != null && typeof reason === 'object' && 'stack' in reason
            ? String(reason.stack)
            : undefined;

        if (typeof window.__ddtReportRejection === 'function') {
          window.__ddtReportRejection({
            message,
            stack,
            href: window.location ? String(window.location.href) : '',
          });
        }
      } catch {
        // ignore bridge errors in browser context
      }
    });
  });
}

export function registerPageCollectors(page, {
  reporter,
  getPageContext,
  setPageUrl,
  registerPage,
  onPopup,
  onWorker,
  policy,
  onIgnoredIssue,
}) {
  const recordIgnoredIssue = (payload) => {
    if (typeof onIgnoredIssue !== 'function') return;
    try {
      onIgnoredIssue(payload);
    } catch {
      // ignore collector callback failures
    }
  };

  page.on('framenavigated', (frame) => {
    try {
      if (frame !== page.mainFrame()) return;
      const nextUrl = frame.url();
      setPageUrl(page, nextUrl);
    } catch {
      // ignore
    }
  });

  page.on('popup', (popup) => {
    try {
      onPopup();
      registerPage(popup, 'popup');
    } catch {
      // ignore
    }
  });

  page.on('worker', (worker) => {
    onWorker();

    const workerUrl = typeof worker.url === 'function' ? worker.url() : '';
    if (typeof worker.on !== 'function') return;

    worker.on('console', async (msg) => {
      try {
        if (msg.type() !== 'error') return;
        const text = await getInterpolatedText(msg);
        reporter.pushError(
          mergePageContext(page, getPageContext, {
            type: 'worker-console-error',
            text,
            workerUrl,
          }),
        );
      } catch {
        // ignore
      }
    });
  });

  page.on('response', (response) => {
    try {
      const status = response.status();
      if (status < 400) return;

      const request = response.request();
      const resourceType = request.resourceType();
      const requestUrl = request.url();

      if (policy === 'balanced') {
        if (status === 504) {
          recordIgnoredIssue({
            category: 'response',
            reason: 'balanced-ignore-504',
            status,
            resourceType,
            url: requestUrl,
          });
          return;
        }
        if (resourceType !== 'document' && resourceType !== 'script') {
          recordIgnoredIssue({
            category: 'response',
            reason: 'balanced-ignore-resource-type',
            status,
            resourceType,
            url: requestUrl,
          });
          return;
        }
      }

      reporter.pushError(
        mergePageContext(page, getPageContext, {
          type: 'response-error',
          text: `Server responded with ${status} (${response.statusText()}) for ${resourceType}: ${requestUrl}`,
          status,
          url: requestUrl,
          resourceType,
        }),
      );
    } catch {
      // ignore
    }
  });

  page.on('console', async (msg) => {
    try {
      const msgType = msg.type();
      const location = msg.location ? msg.location() : {};
      const text =
        msgType === 'error' || msgType === 'warn'
          ? await getInterpolatedText(msg)
          : msg.text();

      if (msgType === 'error') {
        if (text && text.startsWith('[FormulaError]')) return;

        reporter.pushError(
          mergePageContext(page, getPageContext, {
            type: 'console-error',
            text,
            location,
          }),
        );
      }

      if (msgType === 'warn') {
        const isReactWarning = REACT_WARNING_PATTERNS.some((pattern) => pattern.test(text));
        if (!isReactWarning) return;

        reporter.pushError(
          mergePageContext(page, getPageContext, {
            type: 'react-warning',
            text,
            location,
            severity: 'error',
          }),
        );
      }

      if (msgType === 'error') {
        const isReactHookError = REACT_HOOK_ERROR_PATTERNS.some((pattern) => pattern.test(text));
        if (!isReactHookError) return;

        reporter.pushError(
          mergePageContext(page, getPageContext, {
            type: 'react-hook-error',
            text,
            location,
            severity: 'critical',
            hint: 'Check: 1) Hook called in function component 2) No hooks in conditions/loops 3) Single React version',
          }),
        );
      }
    } catch {
      // ignore
    }
  });

  page.on('pageerror', (error) => {
    try {
      const errorText = String(error && error.message ? error.message : error);
      const stack = error && error.stack ? error.stack : undefined;
      const parsedLocation = parseStackLocation(stack);

      reporter.pushError(
        mergePageContext(page, getPageContext, {
          type: 'pageerror',
          message: errorText,
          stack,
          source: parsedLocation ? parsedLocation.source : undefined,
          line: parsedLocation ? parsedLocation.line : undefined,
          column: parsedLocation ? parsedLocation.column : undefined,
        }),
      );
    } catch {
      // ignore
    }
  });

  page.on('requestfailed', (request) => {
    try {
      const url = request.url();
      const resourceType = request.resourceType();
      const failure = request.failure();
      const errorText = failure && failure.errorText ? failure.errorText : 'Unknown error';
      const isLocalhost = url.includes('127.0.0.1') || url.includes('localhost') || url.includes('::1');

      if (isViteDevDepAbort({ url, errorText, isLocalhost })) {
        recordIgnoredIssue({
          category: 'requestfailed',
          reason: 'vite-dev-dep-abort',
          resourceType,
          url,
          errorText,
        });
        return;
      }

      if (policy === 'balanced') {
        const decision = shouldIgnoreRequestFailureBalanced({
          url,
          errorText,
          isLocalhost,
        });

        if (decision.ignore) {
          recordIgnoredIssue({
            category: 'requestfailed',
            reason: 'balanced-ignore-request-failure',
            resourceType,
            url,
            errorText,
          });
          return;
        }

        if (decision.isLocalProxyDiagnostic) {
          reporter.pushError(
            mergePageContext(page, getPageContext, {
              type: 'request-failed',
              text: `Failed to load ${resourceType}: ${url} (Possible proxy issue - localhost requests should bypass proxy)`,
              url,
              resourceType,
              diagnostic: decision.diagnostic,
            }),
          );
          return;
        }
      }

      reporter.pushError(
        mergePageContext(page, getPageContext, {
          type: 'request-failed',
          text: `Failed to load ${resourceType}: ${url}`,
          url,
          resourceType,
          errorText,
        }),
      );
    } catch {
      // ignore
    }
  });
}
