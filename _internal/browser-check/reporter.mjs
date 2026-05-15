import fs from 'node:fs';
import path from 'node:path';

function normalizeMessage(event) {
  if (typeof event.text === 'string' && event.text.trim()) return event.text.trim();
  if (typeof event.message === 'string' && event.message.trim()) return event.message.trim();
  if (typeof event.errorText === 'string' && event.errorText.trim()) return event.errorText.trim();
  if (typeof event.stack === 'string' && event.stack.trim()) return event.stack.trim().split('\n')[0];
  return '';
}

// Vite's dev/preview server pre-bundles deps under `/.vite/deps/*.js?v=<hash>`
// and rotates the hash on every cache rebuild. Without normalization, the same
// logical console error (e.g. a single `<NavLink activeClassName=...>` site)
// fingerprints as N distinct entries because each page emit gets a fresh
// `?v=...` token. Stripping the token lets dedup actually collapse them.
function stripViteCacheToken(url) {
  return url.replace(/\?v=[a-f0-9]+/, '');
}

function normalizeSource(event) {
  let url = '';
  if (typeof event.source === 'string' && event.source) url = event.source;
  else if (typeof event.url === 'string' && event.url) url = event.url;
  else if (event.location && typeof event.location.url === 'string' && event.location.url) {
    url = event.location.url;
  } else if (
    event.location &&
    typeof event.location.sourceURL === 'string' &&
    event.location.sourceURL
  ) {
    url = event.location.sourceURL;
  }
  return stripViteCacheToken(url);
}

// Types that describe the *same* underlying image problem from different
// vantage points. When they share a path, one asset is producing all of them
// and we collapse to a single combined entry so the coder doesn't read the
// same root cause 3–4 times.
const IMAGE_ERROR_TYPES = new Set([
  'invalid-image',
  'unregistered-image',
  'external-image',
  'duplicate-image-subjects',
]);

function extractImagePath(event) {
  if (typeof event.path === 'string' && event.path) return event.path;
  if (event.type === 'response-error' && event.resourceType === 'image' && typeof event.url === 'string') {
    return event.url;
  }
  return '';
}

function isCascadedConsoleError(event, imagePaths) {
  if (event.type !== 'console-error') return false;
  const url = event.location && typeof event.location.url === 'string' ? event.location.url : '';
  if (!url) return false;
  for (const p of imagePaths) {
    if (!p) continue;
    if (url === p || url.endsWith(p)) return true;
  }
  return false;
}

function collapseImageErrors(errors) {
  // First pass: collect image paths already reported as image-specific errors
  // (or as response-errors for image resources). These are the "primary"
  // causes.
  const primaryPaths = new Set();
  for (const e of errors) {
    if (IMAGE_ERROR_TYPES.has(e.type)) {
      if (typeof e.path === 'string' && e.path) primaryPaths.add(e.path);
    }
    if (e.type === 'response-error' && e.resourceType === 'image' && typeof e.url === 'string') {
      primaryPaths.add(e.url);
    }
  }

  const byPath = new Map();
  const passthrough = [];

  for (const e of errors) {
    const path = extractImagePath(e);
    const isImageEvent =
      IMAGE_ERROR_TYPES.has(e.type) ||
      (e.type === 'response-error' && e.resourceType === 'image');

    // Drop console-errors that merely echo an image path we already reported
    // as a primary error. We preserve the count in `stats` and in the combined
    // entry's `reasons[]` if it contributes new info.
    if (!isImageEvent && isCascadedConsoleError(e, primaryPaths)) {
      continue;
    }

    if (!isImageEvent || !path) {
      passthrough.push(e);
      continue;
    }

    const existing = byPath.get(path);
    const reason = {
      type: e.type,
      text: e.text,
      hint: e.hint,
    };
    if (e.status != null) reason.status = e.status;

    if (!existing) {
      byPath.set(path, {
        type: 'image-error',
        path,
        routes: Array.isArray(e.routes) ? e.routes : undefined,
        reasons: [reason],
        // Surface the most actionable hint at the top level. External/path
        // hints are usually the root cause; 404 hints are symptoms.
        hint: e.hint,
        text: e.text,
      });
    } else {
      existing.reasons.push(reason);
      // Prefer hints from path/registry errors (root cause) over 404 hints.
      if (e.type === 'invalid-image' || e.type === 'external-image') {
        existing.hint = e.hint;
        existing.text = e.text;
      }
    }
  }

  return [...passthrough, ...byPath.values()];
}

// Common React/library error patterns whose root cause is well-known and not
// surfaced in the error text itself. Patterns are intentionally narrow — a
// false positive (wrong hint) is worse than a missing hint. Match against the
// already-interpolated `text` (post-`%s` substitution at capture time).
const CONSOLE_ERROR_HINTS = [
  {
    re: /does not recognize the .{0,4}activeClassName/i,
    hint:
      'react-router-dom v6 removed `activeClassName` / `activeStyle` from <NavLink>. ' +
      'Use `className={({ isActive }) => isActive ? "..." : "..."}` (and the same shape for `style`).',
  },
  {
    re: /Each child in a list should have a unique .{0,4}key.{0,4} prop/i,
    hint:
      'Add a stable `key` prop to each item in the .map() above. ' +
      'Avoid the array index when items can reorder; prefer a domain id from the data.',
  },
  {
    re: /Cannot update a component .* while rendering a different component/i,
    hint:
      'A setState/dispatch is firing during render. Move it into useEffect, ' +
      'an event handler, or guard with a ref so it runs after the render commits.',
  },
  {
    re: /Functions are not valid as a React child/i,
    hint:
      'You passed a function where JSX expects an element. Either call it ' +
      '(`{renderItem()}`) or render it as a render-prop pattern (`{children(value)}`).',
  },
];

// Vite's import-analysis surfaces unresolved aliased imports as a runtime
// overlay error. The text contains the failing specifier but no list of
// what *is* available — leaving the coder to guess. We post-process: parse
// the specifier out, list real entries under `src/<bucket>/`, and append
// "Available: [...]. Did you mean: ...". Generalises to any `@/<bucket>/...`
// alias (components, lib, pages, hooks, ...).
const VITE_RESOLVE_RE = /Failed to resolve import\s+["']([^"']+)["']\s+from\s+["']([^"']+)["']/i;
const ALIAS_RE = /^@\/([^/]+)\/(.+)$/;
const SCANNABLE_EXTS = ['.tsx', '.ts', '.jsx', '.js'];

function listAliasEntries(projectRoot, bucket) {
  const dir = path.resolve(projectRoot, 'src', bucket);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  function walk(d, prefix) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) {
        walk(p, rel);
      } else if (SCANNABLE_EXTS.some((ext) => e.name.endsWith(ext))) {
        const stripped = rel.replace(/\.(tsx|ts|jsx|js)$/, '').replace(/\/index$/, '');
        out.push(`@/${bucket}/${stripped}`);
      }
    }
  }
  walk(dir, '');
  return [...new Set(out)].sort();
}

function nearestByEditDistance(target, candidates) {
  let best = null;
  let bestScore = Infinity;
  const targetTail = target.split('/').at(-1) ?? target;
  for (const c of candidates) {
    const cTail = c.split('/').at(-1) ?? c;
    const score = editDistanceMin(targetTail, cTail) + editDistanceMin(target, c) * 0.25;
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

function editDistanceMin(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

export function enrichImportResolutionErrors(errors, { projectRoot } = {}) {
  if (!projectRoot) return errors;
  for (const e of errors) {
    if (e.type !== 'runtime-error' && e.type !== 'console-error') continue;
    const text = typeof e.text === 'string' ? e.text : '';
    const m = text.match(VITE_RESOLVE_RE);
    if (!m) continue;
    const specifier = m[1];
    const aliasMatch = specifier.match(ALIAS_RE);
    if (!aliasMatch) continue;
    const bucket = aliasMatch[1];
    const entries = listAliasEntries(projectRoot, bucket);
    if (entries.length === 0) continue;
    const guess = nearestByEditDistance(specifier, entries);
    const preview = entries.slice(0, 30);
    const overflow = entries.length > preview.length ? ` (+${entries.length - preview.length} more)` : '';
    const lines = [
      `Unresolved import "${specifier}" from "${m[2]}".`,
      guess ? `Did you mean "${guess}"?` : '',
      `Available under @/${bucket}/: ${preview.join(', ')}${overflow}`,
    ].filter(Boolean);
    e.hint = lines.join(' ');
  }
  return errors;
}

// Strip dev-server host + query so a `source` URL like
// `http://127.0.0.1:4174/src/pages/p4.tsx?v=abc` becomes `src/pages/p4.tsx`
// — the form the coder's `read_file` tool actually accepts.
function toRepoRelativeSource(source) {
  if (typeof source !== 'string' || !source) return '';
  let s = source;
  // Drop scheme + host
  s = s.replace(/^https?:\/\/[^/]+\//, '');
  // Drop leading slash if any
  s = s.replace(/^\/+/, '');
  // Drop query/hash
  s = s.replace(/[?#].*$/, '');
  return s;
}

// `pageerror` (and stack-bearing runtime-error) events carry a precise
// source/line, but the coder often doesn't realise it can read just the
// failing region of the file. Surface an explicit "read this file at this
// range" hint so the next debug turn jumps straight to the call site.
function enrichPageErrorHints(errors) {
  for (const e of errors) {
    if (e.type !== 'pageerror' && e.type !== 'runtime-error') continue;
    if (e.hint) continue;
    const rel = toRepoRelativeSource(e.source);
    if (!rel || !rel.startsWith('src/')) continue;
    const line = Number(e.line);
    if (!Number.isFinite(line) || line <= 0) continue;
    const start = Math.max(1, line - 30);
    const end = line + 10;
    e.hint =
      `Read \`${rel}\` around line ${line} ` +
      `(e.g. offset=${start}, limit=${end - start + 1}) to inspect the failing site. ` +
      `The error originates at ${rel}:${line}` +
      (e.column ? `:${e.column}` : '') +
      `. Note: the file may be minified in the stack — match by surrounding identifiers, ` +
      `not by exact column. Common causes of "X is not defined" inside a component: ` +
      `a destructured prop/variable was renamed or removed, an import was deleted, ` +
      `or a JSX expression references a name that exists only inside a different scope.`;
  }
  return errors;
}

function enrichConsoleErrorHints(errors) {
  for (const e of errors) {
    if (e.type !== 'console-error' && e.type !== 'react-warning') continue;
    if (e.hint) continue; // never overwrite an existing, more-specific hint
    const text = typeof e.text === 'string' ? e.text : '';
    if (!text) continue;
    for (const { re, hint } of CONSOLE_ERROR_HINTS) {
      if (re.test(text)) {
        e.hint = hint;
        break;
      }
    }
  }
  return errors;
}

function buildFingerprint(event, dedupeMode = 'route') {
  const type = String(event.type || 'unknown');
  const message = normalizeMessage(event).slice(0, 1200);
  const source = normalizeSource(event).slice(0, 600);
  const route = dedupeMode === 'global' ? '' : String(event.route || '');
  return `${type}::${message}::${source}::${route}`;
}

export function createReporter({ dedupeMode = 'route', projectRoot } = {}) {
  const errors = [];
  const warnings = [];
  const seenFingerprints = new Set();
  const seenWarnings = new Set();
  const stats = {
    pagesDiscovered: 0,
    pagesVisited: 0,
    contextsObserved: 0,
    popupsObserved: 0,
    workersObserved: 0,
    routesChecked: 0,
    linksFound: 0,
    invalidLinksFound: 0,
    invalidFormulasFound: 0,
    formulaErrorsFound: 0,
    invalidImagesFound: 0,
    reactHookErrors: 0,
    placeholdersFound: 0,
    rawFormulasFound: 0,
    ignoredByPolicy: 0,
    coverageTruncated: 0,
    duration: 0,
  };

  function pushError(event, { allowDuplicate = false } = {}) {
    if (!event || typeof event !== 'object') return;
    if (!allowDuplicate) {
      const fingerprint = buildFingerprint(event, dedupeMode);
      if (fingerprint && seenFingerprints.has(fingerprint)) return;
      if (fingerprint) seenFingerprints.add(fingerprint);
    }

    errors.push(event);

    if (event.type === 'invalid-link') stats.invalidLinksFound += 1;
    if (event.type === 'invalid-formula-script') stats.invalidFormulasFound += 1;
    if (event.type === 'katex-formula-error') stats.formulaErrorsFound += 1;
    if (event.type === 'invalid-image') stats.invalidImagesFound += 1;
    if (event.type === 'react-hook-error') stats.reactHookErrors += 1;
    if (event.type === 'coverage-truncated') stats.coverageTruncated += 1;
  }

  function pushWarning(event) {
    if (!event || typeof event !== 'object') return;
    const fingerprint = buildFingerprint(event, 'route');
    if (fingerprint && seenWarnings.has(fingerprint)) return;
    if (fingerprint) seenWarnings.add(fingerprint);
    warnings.push(event);

    if (event.type === 'dom-placeholder') stats.placeholdersFound += 1;
    if (event.type === 'raw-formula') stats.rawFormulasFound += 1;
    if (event.type === 'balanced-policy-ignored') {
      const count = Number(event.count || 0);
      if (Number.isFinite(count) && count > 0) {
        stats.ignoredByPolicy += count;
      }
    }
  }

  function toResult({ diagnostics } = {}) {
    return {
      success: errors.length === 0,
      errors: enrichImportResolutionErrors(
        enrichPageErrorHints(enrichConsoleErrorHints(collapseImageErrors(errors))),
        { projectRoot },
      ),
      warnings: warnings.length > 0 ? warnings : undefined,
      has_placeholder_warnings: warnings.some((warning) => warning.type === 'dom-placeholder'),
      has_formula_warnings: warnings.some((warning) => warning.type === 'raw-formula'),
      diagnostics,
      stats,
    };
  }

  return {
    errors,
    warnings,
    stats,
    pushError,
    pushWarning,
    toResult,
  };
}
