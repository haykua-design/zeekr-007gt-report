#!/usr/bin/env node
// Static component import check.
//
// Purpose: catch '@/components/...' imports that do not resolve to files in the
// template before Vite turns the page module request into a browser-check 500.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_ROOT = path.resolve(__dirname, '..');
const COMPONENT_ROOT = path.resolve(TEMPLATE_ROOT, 'src/components');
const PAGES_DIR = path.resolve(TEMPLATE_ROOT, 'src/pages');
const SRC_DIR = path.resolve(TEMPLATE_ROOT, 'src');
const EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];

// Top-level shell files in `src/` that the coder may write to (App, main,
// routes, etc). They sit outside `src/pages/` but their `@/components/...`
// imports still feed Vite's import-analysis and produce dev-server 500s on
// failure. We scan them alongside pages.
export function listShellTsx(srcDir = SRC_DIR) {
  if (!fs.existsSync(srcDir)) return [];
  return fs
    .readdirSync(srcDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.tsx'))
    .map((e) => path.join(srcDir, e.name));
}

export function findComponentImports(src) {
  const imports = [];
  const re = /import\s+(?:type\s+)?[\s\S]*?\s+from\s+['"](@\/components\/[^'"]+)['"]/g;
  for (const m of src.matchAll(re)) {
    imports.push({ specifier: m[1], index: m.index ?? 0 });
  }
  return imports;
}

export function resolveComponentImport(specifier, componentRoot = COMPONENT_ROOT, exists = fs.existsSync) {
  const rel = specifier.replace(/^@\/components\/?/, '');
  const base = path.resolve(componentRoot, rel);
  for (const ext of EXTENSIONS) {
    const file = `${base}${ext}`;
    if (exists(file)) return file;
  }
  for (const ext of EXTENSIONS) {
    const file = path.join(base, `index${ext}`);
    if (exists(file)) return file;
  }
  return null;
}

function walkTsx(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkTsx(p));
    else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

function walkFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkFiles(p));
    else if (EXTENSIONS.some((ext) => e.name.endsWith(ext))) out.push(p);
  }
  return out;
}

function lineOf(src, index) {
  let n = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src[i] === '\n') n++;
  return n;
}

function toSpecifier(file, componentRoot) {
  const rel = path.relative(componentRoot, file).replace(/\\/g, '/');
  return `@/components/${rel.replace(/\.(tsx|ts|jsx|js)$/, '').replace(/\/index$/, '')}`;
}

function nearestSpecifier(specifier, candidates) {
  let best = null;
  let bestScore = Infinity;
  const targetName = specifier.split('/').at(-1) ?? specifier;
  for (const candidate of candidates) {
    const candidateName = candidate.split('/').at(-1) ?? candidate;
    const score = editDistance(targetName, candidateName) + editDistance(specifier, candidate) * 0.25;
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function editDistance(a, b) {
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

export function check({
  pageFiles,
  componentRoot = COMPONENT_ROOT,
  readFile = (p) => fs.readFileSync(p, 'utf8'),
  exists = fs.existsSync,
  listFiles = () => walkFiles(componentRoot),
}) {
  const errors = [];
  const candidates = listFiles().map((file) => toSpecifier(file, componentRoot));
  for (const pagePath of pageFiles) {
    const src = readFile(pagePath);
    for (const item of findComponentImports(src)) {
      if (resolveComponentImport(item.specifier, componentRoot, exists)) continue;
      const guess = nearestSpecifier(item.specifier, candidates);
      const hint = guess ? ` Did you mean "${guess}"?` : '';
      errors.push({
        page: pagePath,
        line: lineOf(src, item.index),
        message: `Cannot resolve component import "${item.specifier}".${hint}`,
      });
    }
  }
  return errors;
}

function main() {
  const files = [...walkTsx(PAGES_DIR), ...listShellTsx(SRC_DIR)];
  const errors = check({ pageFiles: files });
  if (errors.length === 0) {
    console.log(`[check-component-imports] OK — ${files.length} file(s) scanned`);
    process.exit(0);
  }
  console.error(`[check-component-imports] ${errors.length} unresolved component import(s):`);
  for (const e of errors) {
    const rel = path.relative(TEMPLATE_ROOT, e.page);
    console.error(`  ${rel}:${e.line}  ${e.message}`);
  }
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
