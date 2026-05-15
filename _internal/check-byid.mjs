#!/usr/bin/env node
// Static byId reference check.
//
// Purpose: catch `byId(report, 'sid::bid')` calls whose section or block id
// does not exist in the report imported by that page — *before* Vite/Chromium
// boots. Without this, the coder only sees the failure as a runtime
// "section not found" pageerror and burns retries trying neighbouring slugs.
//
// Strategy:
//   1. Parse src/reports/.generated/*.gen.ts → { name → {sections, blocks} }.
//   2. Walk src/pages/**.tsx. For each page:
//        - find `import <var> from '@/reports/.generated/<name>.gen'` to learn
//          which report this page is bound to;
//        - find every `byId(<var>, '<sid>::<bid>')` literal;
//        - check sid exists in that report; check bid exists in that section.
//   3. On miss, print the available ids and the nearest match — same shape
//      as the runtime error, so the coder sees identical guidance whether
//      caught statically or at runtime.
//
// Pages that don't import a generated report, or `byId(...)` calls with
// non-literal args, are skipped (nothing to verify statically).
//
// Exit code: 0 = OK, 1 = at least one bad reference.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_ROOT = path.resolve(__dirname, '..');
const GEN_DIR = path.resolve(TEMPLATE_ROOT, 'src/reports/.generated');
const PAGES_DIR = path.resolve(TEMPLATE_ROOT, 'src/pages');

export function loadReports(genDir = GEN_DIR) {
  const reports = {};
  if (!fs.existsSync(genDir)) return reports;
  for (const f of fs.readdirSync(genDir).filter(n => n.endsWith('.gen.ts'))) {
    const src = fs.readFileSync(path.join(genDir, f), 'utf8');
    const m = src.match(/const report: Report = ([\s\S]*?) as const;/);
    if (!m) continue;
    let obj;
    try { obj = JSON.parse(m[1]); } catch { continue; }
    const stem = f.replace(/\.gen\.ts$/, '');
    const sections = {};
    for (const [sid, sec] of Object.entries(obj.sections || {})) {
      sections[sid] = (sec.blocks || []).map(b => b.id);
    }
    reports[stem] = { name: obj.name || stem, sections };
  }
  return reports;
}

export function findReportImport(src) {
  // import <var> from '@/reports/.generated/<stem>.gen'  (or '...gen.ts')
  const m = src.match(
    /import\s+(\w+)\s+from\s+['"]@\/reports\/\.generated\/([\w-]+)\.gen(?:\.ts)?['"]/,
  );
  return m ? { varName: m[1], stem: m[2] } : null;
}

// Inline `const NAME = '<literal>';` → expand `${NAME}` template references
// inside string literals. Mirrors the same trick used by check-content-coverage,
// so pages that build fqIds via top-of-file constants (a common pattern) don't
// produce false positives here.
export function resolveConsts(src) {
  const consts = {};
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*['"`]([^'"`]+)['"`]\s*;/g)) {
    consts[m[1]] = m[2];
  }
  return src.replace(/\$\{(\w+)\}/g, (_, name) =>
    Object.prototype.hasOwnProperty.call(consts, name) ? consts[name] : `\${${name}}`,
  );
}

export function findByIdCalls(rawSrc, varName) {
  const src = resolveConsts(rawSrc);
  // Match byId(<varName>, '<fqId>') — single/double/back-tick literal only.
  // Skip dynamic args (e.g. byId(report, item.id)).
  const re = new RegExp(
    `byId\\(\\s*${varName}\\s*,\\s*['"\`]([^'"\`]+)['"\`]\\s*\\)`,
    'g',
  );
  const out = [];
  for (const m of src.matchAll(re)) {
    const [sid, bid] = m[1].split('::');
    if (!sid || !bid) continue;
    out.push({ sid, bid, fqId: m[1], index: m.index ?? 0 });
  }
  return out;
}

function lineOf(src, index) {
  let n = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src[i] === '\n') n++;
  return n;
}

export function nearest(target, candidates, maxDist = 3) {
  let best = null, bestD = Infinity;
  for (const c of candidates) {
    const d = editDistance(target, c);
    if (d < bestD) { bestD = d; best = c; }
  }
  return bestD <= maxDist ? best : null;
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

export function check(reports, pageFiles, readFile = (p) => fs.readFileSync(p, 'utf8')) {
  const errors = [];
  for (const pagePath of pageFiles) {
    const src = readFile(pagePath);
    const imp = findReportImport(src);
    if (!imp) continue;
    const report = reports[imp.stem];
    if (!report) {
      errors.push({
        page: pagePath,
        line: 0,
        message:
          `imports '@/reports/.generated/${imp.stem}.gen' but no such report ` +
          `was generated. Available: [${Object.keys(reports).join(', ')}]`,
      });
      continue;
    }
    const calls = findByIdCalls(src, imp.varName);
    for (const call of calls) {
      const sectionIds = Object.keys(report.sections);
      if (!Object.prototype.hasOwnProperty.call(report.sections, call.sid)) {
        const guess = nearest(call.sid, sectionIds);
        const hint = guess ? ` Did you mean "${guess}::${call.bid}"?` : '';
        errors.push({
          page: pagePath,
          line: lineOf(src, call.index),
          message:
            `byId('${call.fqId}'): section "${call.sid}" not found in ` +
            `report "${report.name}".${hint} ` +
            `Available sections: [${sectionIds.join(', ')}]`,
        });
        continue;
      }
      const blockIds = report.sections[call.sid];
      if (!blockIds.includes(call.bid)) {
        const guess = nearest(call.bid, blockIds);
        const hint = guess ? ` Did you mean "${call.sid}::${guess}"?` : '';
        errors.push({
          page: pagePath,
          line: lineOf(src, call.index),
          message:
            `byId('${call.fqId}'): block "${call.bid}" not found in ` +
            `section "${call.sid}" of report "${report.name}".${hint} ` +
            `Available blocks: [${blockIds.join(', ')}]`,
        });
      }
    }
  }
  return errors;
}

function main() {
  const reports = loadReports();
  if (Object.keys(reports).length === 0) {
    console.log('[check-byid] no generated reports found; skipping');
    process.exit(0);
  }
  const pages = walkTsx(PAGES_DIR);
  const errors = check(reports, pages);
  if (errors.length === 0) {
    console.log(`[check-byid] OK — ${pages.length} page(s) scanned, all byId(...) refs resolve`);
    process.exit(0);
  }
  console.error(`[check-byid] ${errors.length} bad byId reference(s):`);
  for (const e of errors) {
    const rel = path.relative(TEMPLATE_ROOT, e.page);
    console.error(`  ${rel}:${e.line}  ${e.message}`);
  }
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
