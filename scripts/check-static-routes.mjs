#!/usr/bin/env node
/**
 * Routes integrity check. Two-way recall + link-target validity.
 *
 * Run before Chromium boots. Catches:
 *   1. Page file with no entry in `src/routes.ts` (orphan page — never reachable).
 *   2. routes.ts entry pointing at a missing page file (broken import).
 *   3. <Link to="...">, <NavLink to="...">, <AppLink to="...">, <a href="/...">,
 *      navigate("/..."), router.push("/..."), router.replace("/...") whose
 *      string-literal target does not match any registered route in routes.ts.
 *
 * Dynamic targets (`to={item.path}`, template literals, etc.) are NOT
 * checked here — the runtime browser-check crawl is the final guardrail.
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, relative } from 'path';

const SRC_DIR = 'src';
const PAGES_DIR = join(SRC_DIR, 'pages');
const SHELL_DIR = join(SRC_DIR, 'shell_pages');
// Page files may live in either directory. The import-path prefix in
// routes.ts (`./pages/...` vs `./shell_pages/...`) selects which one.
const PAGE_DIRS = [
  { dir: PAGES_DIR, prefix: './pages/' },
  { dir: SHELL_DIR, prefix: './shell_pages/' },
];
const ROUTES_FILE = join(SRC_DIR, 'routes.ts');
const EXT = /\.(tsx?|jsx?)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', '.vite']);

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (EXT.test(entry.name)) yield p;
  }
}

function listPageFiles() {
  // Returns { dir, prefix, name } entries across both content and shell dirs.
  const out = [];
  for (const { dir, prefix } of PAGE_DIRS) {
    if (!existsSync(dir)) continue;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isFile() && e.name.endsWith('.tsx')) {
        out.push({ dir, prefix, name: e.name });
      }
    }
  }
  return out;
}

function parseRoutesFile() {
  const src = readFileSync(ROUTES_FILE, 'utf8');
  const entries = [];
  const re = /\{\s*path:\s*['"`]([^'"`]+)['"`][\s\S]*?import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    entries.push({ path: m[1], importPath: m[2] });
  }
  return entries;
}

function normalizeRoute(raw) {
  let p = String(raw || '').trim();
  if (!p) return '';
  p = p.split('?')[0].split('#')[0];
  if (!p) return '/';
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p || '/';
}

const errors = [];

const pageFiles = listPageFiles();
const routeEntries = parseRoutesFile();

// Key imports by "prefix+stem" so a `pages/p2` and a hypothetical
// `shell_pages/p2` would not collide. In practice shell files are named
// shell{M}_… but the keying stays robust.
function classifyImport(importPath) {
  for (const { dir, prefix } of PAGE_DIRS) {
    if (importPath.startsWith(prefix)) {
      const stem = importPath.slice(prefix.length).replace(/\.tsx?$/, '');
      return { dir, prefix, stem, key: prefix + stem };
    }
  }
  return null;
}

const importedKeys = new Set();
for (const { path: routePath, importPath } of routeEntries) {
  const cls = classifyImport(importPath);
  if (!cls) {
    errors.push({
      file: ROUTES_FILE,
      kind: 'route-import-not-page-or-shell',
      value: routePath,
      hint:
        `routes.ts registers "${routePath}" → import('${importPath}'), but ` +
        'page imports must start with "./pages/" or "./shell_pages/". ' +
        'Move the file into one of those directories and update the import.',
    });
    continue;
  }
  importedKeys.add(cls.key);
  const expected = join(cls.dir, `${cls.stem}.tsx`);
  if (!existsSync(expected)) {
    errors.push({
      file: ROUTES_FILE,
      kind: 'route-points-at-missing-page',
      value: routePath,
      hint:
        `routes.ts registers "${routePath}" → import('${importPath}'), but ${expected} does not exist. ` +
        'Create the page file, fix the import path, or remove this route entry.',
    });
  }
}

for (const { dir, prefix, name } of pageFiles) {
  const stem = name.replace(/\.tsx$/, '');
  const key = prefix + stem;
  if (!importedKeys.has(key)) {
    errors.push({
      file: join(dir, name),
      kind: 'orphan-page',
      value: stem,
      hint:
        `Page file ${name} (in ${dir}) is not registered in src/routes.ts. ` +
        `Add a route entry { path: "/...", component: lazy(() => import("${prefix}${stem}")) }, ` +
        'or delete the page file if it is no longer needed.',
    });
  }
}

// Home-route existence is still enforced here; the "which file the home
// must import" rule is delegated to check:homepage, which understands the
// pages-vs-shell relaxation.
const homeRoute = routeEntries.find((e) => e.path === '/');
if (!homeRoute) {
  errors.push({
    file: ROUTES_FILE,
    kind: 'no-home-route',
    value: '/',
    hint:
      'routes.ts must include an entry with path: "/" pointing at either ' +
      './pages/p1_<slug> (content homepage, the default) or ' +
      './shell_pages/shell1_<slug> (composite-shell homepage).',
  });
}

const knownRoutes = new Set(routeEntries.map((e) => normalizeRoute(e.path)));

const LINK_TAG_RE = /<(Link|NavLink|AppLink)\b/;
const TO_ATTR_RE = /\bto\s*=\s*(?:"([^"]+)"|'([^']+)'|\{\s*["'`]([^"'`]+)["'`]\s*\})/g;
const A_TAG_RE = /<a\b/;
const HREF_ATTR_RE = /\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|\{\s*["'`]([^"'`]+)["'`]\s*\})/g;
const NAV_CALL_RE = /\b(?:navigate|router\.(?:push|replace))\s*\(\s*["'`]([^"'`]+)["'`]/g;

function isInsideStringLiteral(line, tagIndex) {
  const left = line.slice(0, tagIndex);
  let inSingle = false, inDouble = false, inBack = false;
  for (let k = 0; k < left.length; k++) {
    const ch = left[k];
    if (ch === '\\') { k++; continue; }
    if (!inDouble && !inBack && ch === "'") inSingle = !inSingle;
    else if (!inSingle && !inBack && ch === '"') inDouble = !inDouble;
    else if (!inSingle && !inDouble && ch === '`') inBack = !inBack;
  }
  return inSingle || inDouble || inBack;
}

function isExternalHref(v) {
  return /^https?:\/\//i.test(v) || v.startsWith('mailto:') || v.startsWith('tel:') || v.startsWith('javascript:');
}

function isPureFragment(v) {
  return v.startsWith('#') && v.indexOf('/', 1) === -1;
}

function checkLinkTarget({ file, lineIdx, kind, value }) {
  const normalized = normalizeRoute(value);
  if (!normalized || !normalized.startsWith('/')) return;
  if (knownRoutes.has(normalized)) return;
  errors.push({
    file: relative('.', file),
    line: lineIdx + 1,
    kind,
    value,
    hint:
      `Target "${value}" does not match any route in routes.ts. ` +
      `Known routes: ${[...knownRoutes].sort().join(', ')}. ` +
      'Fix the literal, register the missing route, or rename the page.',
  });
}

for (const file of walk(SRC_DIR)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const linkMatch = line.match(LINK_TAG_RE);
    if (linkMatch && !isInsideStringLiteral(line, linkMatch.index)) {
      const windowText = lines.slice(i, Math.min(i + 6, lines.length)).join(' ');
      TO_ATTR_RE.lastIndex = 0;
      let m;
      while ((m = TO_ATTR_RE.exec(windowText)) !== null) {
        const value = m[1] ?? m[2] ?? m[3] ?? '';
        if (value) checkLinkTarget({ file, lineIdx: i, kind: 'invalid-link-to', value });
      }
    }

    const aMatch = line.match(A_TAG_RE);
    if (aMatch && !isInsideStringLiteral(line, aMatch.index)) {
      const windowText = lines.slice(i, Math.min(i + 6, lines.length)).join(' ');
      HREF_ATTR_RE.lastIndex = 0;
      let m;
      while ((m = HREF_ATTR_RE.exec(windowText)) !== null) {
        const value = m[1] ?? m[2] ?? m[3] ?? '';
        if (!value || isExternalHref(value) || isPureFragment(value)) continue;
        const candidate = value.startsWith('#/') ? value.slice(1) : value;
        if (!candidate.startsWith('/')) continue;
        checkLinkTarget({ file, lineIdx: i, kind: 'invalid-anchor-href', value: candidate });
      }
    }

    NAV_CALL_RE.lastIndex = 0;
    let m;
    while ((m = NAV_CALL_RE.exec(line)) !== null) {
      const value = m[1] ?? '';
      if (value && value.startsWith('/')) {
        checkLinkTarget({ file, lineIdx: i, kind: 'invalid-navigate-call', value });
      }
    }
  }
}

if (errors.length === 0) {
  console.log('✓ check:routes — no issues');
  process.exit(0);
}

console.error(`\n✗ check:routes — ${errors.length} issue(s)\n`);
for (const e of errors) {
  const loc = e.line ? `${e.file}:${e.line}` : e.file;
  console.error(`  [${e.kind}] ${loc}`);
  if (e.value) console.error(`    value: ${JSON.stringify(e.value)}`);
  console.error(`    ${e.hint}\n`);
}
process.exit(1);
