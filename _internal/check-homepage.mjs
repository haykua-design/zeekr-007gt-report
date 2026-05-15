#!/usr/bin/env node
// Static homepage rule.
//
// Rule: the "/" route in routes.ts imports exactly one of:
//   (a) the unique src/pages/p1_*.tsx (content-page homepage — the default),
//       OR
//   (b) the unique src/shell_pages/shell1_*.tsx (composite-shell homepage).
//
// In each directory at most one file may carry the homepage-eligible
// prefix (`p1_` under src/pages/, `shell1_` under src/shell_pages/). If
// both directories contain a homepage-eligible file, routes.ts must
// pick one — that's the homepage, the other file is invalid (rename it
// to a non-p1/non-shell1 prefix).
//
// Failure modes covered:
//   - 0 candidates → no homepage (the agent forgot to create one).
//   - ≥2 candidates in the same directory → ambiguous within that
//     directory; rename the extras.
//   - "/" route imports a file other than a registered homepage candidate
//     → mismatch (the agent renamed one half but not the other).
//   - "/" route missing entirely → no-home-route.
//
// The slug after the prefix is free — p1_overview, p1_popmart,
// shell1_timeline are all valid; the rule is the prefix, not the slug.
//
// Exit code: 0 = OK, 1 = any of the above.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_ROOT = path.resolve(__dirname, '..');
const PAGES_DIR = path.resolve(TEMPLATE_ROOT, 'src/pages');
const SHELL_DIR = path.resolve(TEMPLATE_ROOT, 'src/shell_pages');
const ROUTES_FILE = path.resolve(TEMPLATE_ROOT, 'src/routes.ts');

const PAGE_HOMEPAGE_RE = /^p1_[A-Za-z0-9_-]+\.tsx$/;
const SHELL_HOMEPAGE_RE = /^shell1_[A-Za-z0-9_-]+\.tsx$/;
// One regex per supported home-import shape (pages/p1_… or shell_pages/shell1_…).
const HOME_ROUTE_RE = /\{\s*path:\s*['"`]\/['"`][\s\S]*?import\s*\(\s*['"`]\.\/(pages|shell_pages)\/([^'"`]+)['"`]\s*\)/;

export function listPageFiles(pagesDir = PAGES_DIR) {
  if (!fs.existsSync(pagesDir)) return [];
  return fs.readdirSync(pagesDir)
    .filter(n => /^p\d+_.+\.tsx$/.test(n))
    .map(n => path.join(pagesDir, n));
}

function listShellFiles(shellDir) {
  if (!fs.existsSync(shellDir)) return [];
  return fs.readdirSync(shellDir)
    .filter(n => /^shell\d+_.+\.tsx$/.test(n))
    .map(n => path.join(shellDir, n));
}

export function check({
  pagesDir = PAGES_DIR,
  shellDir = SHELL_DIR,
  routesFile = ROUTES_FILE,
  readFile = (p) => fs.readFileSync(p, 'utf8'),
  exists = (p) => fs.existsSync(p),
  listFiles = listPageFiles,
} = {}) {
  const pageCandidates = listFiles(pagesDir)
    .filter(p => PAGE_HOMEPAGE_RE.test(path.basename(p)));
  const shellCandidates = listShellFiles(shellDir)
    .filter(p => SHELL_HOMEPAGE_RE.test(path.basename(p)));

  // Per-directory uniqueness: at most one p1_* under pages, at most one
  // shell1_* under shell_pages. Routes.ts picks which one is the homepage.
  if (pageCandidates.length >= 2) {
    const names = pageCandidates.map(p => path.basename(p)).sort();
    return [{
      file: pagesDir,
      kind: 'ambiguous',
      message:
        `Multiple p1_*.tsx homepage candidates in src/pages/: ${names.join(', ')}. ` +
        'Only one p1_*.tsx is allowed. Keep the one that serves "/" and rename ' +
        'the others to p2_, p3_, … (and update routes.ts to match).',
    }];
  }
  if (shellCandidates.length >= 2) {
    const names = shellCandidates.map(p => path.basename(p)).sort();
    return [{
      file: shellDir,
      kind: 'ambiguous',
      message:
        `Multiple shell1_*.tsx homepage candidates in src/shell_pages/: ${names.join(', ')}. ` +
        'Only one shell1_*.tsx is allowed. Keep the one that serves "/" and rename ' +
        'the others to shell2_, shell3_, … (and update routes.ts to match).',
    }];
  }

  if (pageCandidates.length === 0 && shellCandidates.length === 0) {
    return [{
      file: pagesDir,
      kind: 'missing',
      message:
        'No homepage found. Create exactly one of:\n' +
        '  - src/pages/p1_<slug>.tsx          (content-page homepage, the default)\n' +
        '  - src/shell_pages/shell1_<slug>.tsx (composite-shell homepage)\n' +
        "and register it in src/routes.ts at { path: '/', ... }.",
    }];
  }

  if (!exists(routesFile)) {
    return [{
      file: routesFile,
      kind: 'routes-missing',
      message: 'src/routes.ts is missing.',
    }];
  }

  const routesSrc = readFile(routesFile);
  const m = routesSrc.match(HOME_ROUTE_RE);
  if (!m) {
    const hintImport = pageCandidates.length === 1
      ? `'./pages/${path.basename(pageCandidates[0]).replace(/\.tsx$/, '')}'`
      : `'./shell_pages/${path.basename(shellCandidates[0]).replace(/\.tsx$/, '')}'`;
    return [{
      file: routesFile,
      kind: 'no-home-route',
      message:
        `routes.ts has no entry for path: '/'. Register the homepage: ` +
        `{ path: '/', component: lazy(() => import(${hintImport})) }.`,
    }];
  }

  const importedDir = m[1]; // 'pages' | 'shell_pages'
  const importedStem = m[2];
  const importedBasename = `${importedStem}.tsx`;

  const expectedCandidates =
    importedDir === 'pages' ? pageCandidates : shellCandidates;
  const expectedNames = expectedCandidates.map(p => path.basename(p));

  if (!expectedNames.includes(importedBasename)) {
    return [{
      file: routesFile,
      kind: 'home-mismatch',
      message:
        `routes.ts "/" imports './${importedDir}/${importedStem}', but ` +
        `no matching homepage file exists in src/${importedDir}/. ` +
        `Candidates currently in that directory: ` +
        `${expectedNames.length ? expectedNames.join(', ') : '(none)'}. ` +
        'Update the import to one of those, or rename the page to match.',
    }];
  }

  return [];
}

function main() {
  const errors = check();
  if (errors.length === 0) {
    console.log('[check-homepage] OK');
    process.exit(0);
  }
  console.error(`[check-homepage] ${errors.length} error(s):`);
  for (const e of errors) {
    const rel = path.relative(TEMPLATE_ROOT, e.file);
    console.error(`  ${rel}  [${e.kind}]  ${e.message}`);
  }
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
