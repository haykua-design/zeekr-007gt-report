#!/usr/bin/env node
// Content coverage check.
//
// Reads src/reports/.generated/*.gen.ts (knows every block id), then greps
// src/pages/ for references in JSX. Reports coverage (how many blocks are
// placed on some page) and fails only on DUPLICATE — the same block id
// referenced as canonical from more than one place, which is an unambiguous
// bug (same content rendered twice without intent).
//
// Unreferenced blocks are reported as UNUSED but do not fail the build.
// Runtime DOM token-set fidelity (DDT_CHECK_TEXT_FIDELITY) is the real
// fidelity gate — this static check is informational for unused-block cases.
//
// Rich UNUSED reporting: each unused block is attributed to the page(s)
// that import its report (`import <var> from '@/reports/.generated/<stem>.gen'`).
// A page only imports one report; cross-report leakage is not a coder option,
// so candidate pages for an unused block in report X = pages importing X.
// Reports imported by no page are flagged as ORPHAN — that's a separate
// failure mode (the report was generated but never wired into the SPA).
//
// Exit code: 0 = no DUPLICATE; 1 = DUPLICATE violations.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { findReportImport } from './check-byid.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_ROOT = path.resolve(__dirname, '..');
const GEN_DIR = path.resolve(TEMPLATE_ROOT, 'src/reports/.generated');
const PAGES_DIR = path.resolve(TEMPLATE_ROOT, 'src/pages');

export function loadGeneratedReports(genDir = GEN_DIR) {
  if (!fs.existsSync(genDir)) return [];
  return fs.readdirSync(genDir)
    .filter(f => f.endsWith('.gen.ts'))
    .map(f => {
      const src = fs.readFileSync(path.join(genDir, f), 'utf8');
      const m = src.match(/const report: Report = ([\s\S]*?) as const;/);
      if (!m) throw new Error(`Could not parse ${f}`);
      const obj = JSON.parse(m[1]);
      return { file: f, stem: f.replace(/\.gen\.ts$/, ''), ...obj };
    });
}

export function walkPages(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkPages(p));
    else if (entry.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

function resolveConsts(src) {
  const consts = {};
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*['"`]([^'"`]+)['"`]\s*;/g)) {
    consts[m[1]] = m[2];
  }
  return src.replace(/\$\{(\w+)\}/g, (_, name) =>
    Object.prototype.hasOwnProperty.call(consts, name) ? consts[name] : `\${${name}}`,
  );
}

export function findReferencesInSrc(rawSrc) {
  const src = resolveConsts(rawSrc);
  const canonical = new Set();
  const extracted = new Set();
  for (const m of src.matchAll(/byId\(\s*\w+\s*,\s*['"`]([^'"`]+)['"`]\s*\)/g)) canonical.add(m[1]);
  for (const m of src.matchAll(/data-block-ref=['"`]([^'"`]+)['"`]/g)) canonical.add(m[1]);
  for (const m of src.matchAll(/data-extract-ref=['"`]([^'"`]+)['"`]/g)) extracted.add(m[1]);
  return { canonical, extracted };
}

export function check({ reports, pages, readFile }) {
  // Refs are keyed by `${stem}|${fqId}` — the page's local `report` variable
  // is bound to a specific .gen.ts via its `import ... from '@/reports/.generated/<stem>.gen'`,
  // and the same fqId (e.g. `sec-3::p-1`) lives in nearly every report. Without
  // stem-scoping, two pages legitimately referencing their own report's `sec-3::p-1`
  // would falsely collide as a DUPLICATE.
  // Pages with no resolvable report import are skipped from canonical accounting
  // (refs cannot be attributed to a report). Those pages' refs simply do not count.
  const refsByScopedId = new Map(); // `${stem}|${fqId}` → { canonical, extracted, files: [] }
  const pageImports = new Map(); // pagePath → reportStem
  const refsPerPage = new Map(); // pagePath → canonical Set

  for (const page of pages) {
    const src = readFile(page);
    const imp = findReportImport(src);
    if (imp) pageImports.set(page, imp.stem);

    const { canonical, extracted } = findReferencesInSrc(src);
    refsPerPage.set(page, canonical);
    if (!imp) continue;

    const stem = imp.stem;
    for (const id of canonical) {
      const key = `${stem}|${id}`;
      if (!refsByScopedId.has(key)) refsByScopedId.set(key, { canonical: 0, extracted: 0, files: [] });
      const r = refsByScopedId.get(key);
      r.canonical += 1;
      r.files.push(page);
    }
    for (const id of extracted) {
      const key = `${stem}|${id}`;
      if (!refsByScopedId.has(key)) refsByScopedId.set(key, { canonical: 0, extracted: 0, files: [] });
      refsByScopedId.get(key).extracted += 1;
    }
  }

  // stem → [pagePath ...] sorted by current canonical-ref count ascending so
  // the page with the most room is suggested first.
  const pagesByReport = new Map();
  for (const [page, stem] of pageImports) {
    if (!pagesByReport.has(stem)) pagesByReport.set(stem, []);
    pagesByReport.get(stem).push(page);
  }
  for (const list of pagesByReport.values()) {
    list.sort((a, b) => (refsPerPage.get(a)?.size || 0) - (refsPerPage.get(b)?.size || 0));
  }

  const duplicates = [];
  const unusedByReport = new Map(); // stem → { candidatePages, items: [fqId] }
  const orphanReports = []; // [{ stem, blockCount }]
  let totalBlocks = 0;
  let coveredBlocks = 0;

  for (const report of reports) {
    const stem = report.stem;
    const candidatePages = pagesByReport.get(stem) || [];
    if (candidatePages.length === 0 && (report.allBlockIds || []).length > 0) {
      orphanReports.push({ stem, blockCount: report.allBlockIds.length });
    }
    for (const fqId of report.allBlockIds || []) {
      totalBlocks += 1;
      const r = refsByScopedId.get(`${stem}|${fqId}`);
      if (!r || r.canonical === 0) {
        if (!unusedByReport.has(stem)) unusedByReport.set(stem, { candidatePages, items: [] });
        unusedByReport.get(stem).items.push(fqId);
      } else {
        coveredBlocks += 1;
        if (r.canonical > 1) {
          duplicates.push({ report: report.name, fqId, count: r.canonical, files: r.files.slice() });
        }
      }
    }
  }

  return { duplicates, unusedByReport, orphanReports, totalBlocks, coveredBlocks };
}

function format({ duplicates, unusedByReport, orphanReports, totalBlocks, coveredBlocks }, relTo) {
  const out = [];
  out.push(`[content-coverage] ${coveredBlocks}/${totalBlocks} blocks referenced`);

  const unusedTotal = [...unusedByReport.values()].reduce((n, g) => n + g.items.length, 0);
  if (unusedTotal > 0) {
    out.push(`[content-coverage] ${unusedTotal} UNUSED block(s) (informational; not a failure):`);
    for (const [stem, group] of unusedByReport) {
      const orphan = group.candidatePages.length === 0;
      const candidateNote = orphan
        ? 'NOT IMPORTED BY ANY PAGE — orphan report'
        : `referenced by ${group.candidatePages.map(p => path.relative(relTo, p)).join(', ')}`;
      out.push(`  Report ${stem} — ${candidateNote}:`);
      for (const fqId of group.items) {
        out.push(`    UNUSED  ${fqId}`);
      }
      if (orphan) {
        out.push(
          `    Hint: add \`import report from '@/reports/.generated/${stem}.gen'\` to a page, ` +
            `then reference blocks via byId(report, '<fqId>') / data-block-ref="<fqId>".`,
        );
      } else {
        const target = path.relative(relTo, group.candidatePages[0]);
        out.push(
          `    Hint: add byId(report, '<fqId>') or data-block-ref="<fqId>" in ${target}` +
            (group.candidatePages.length > 1 ? ' (or another page importing this report)' : '') +
            '.',
        );
      }
    }
  }

  if (orphanReports.length > 0 && unusedTotal === 0) {
    // Edge case: orphan report with zero blocks — still worth flagging.
    out.push(`[content-coverage] ${orphanReports.length} ORPHAN report(s) (no page imports them):`);
    for (const o of orphanReports) {
      out.push(`  ${o.stem}.gen.ts  (${o.blockCount} block(s))`);
    }
  }

  if (duplicates.length === 0) {
    out.push('[content-coverage] OK — no DUPLICATE references');
    return { text: out.join('\n'), exitCode: 0 };
  }

  out.push(`[content-coverage] ${duplicates.length} DUPLICATE violation(s):`);
  for (const d of duplicates) {
    const files = d.files.map(f => path.relative(relTo, f)).join(', ');
    out.push(`  DUPLICATE ${d.report}  ${d.fqId}  ×${d.count}  in ${files}`);
  }
  return { text: out.join('\n'), exitCode: 1 };
}

function main() {
  const reports = loadGeneratedReports();
  if (reports.length === 0) {
    console.log('[content-coverage] no generated reports found; skipping');
    process.exit(0);
  }
  const pages = walkPages(PAGES_DIR);
  const readFile = (p) => fs.readFileSync(p, 'utf8');
  const result = check({ reports, pages, readFile });
  const { text, exitCode } = format(result, TEMPLATE_ROOT);
  if (exitCode === 0) console.log(text);
  else console.error(text);
  process.exit(exitCode);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
