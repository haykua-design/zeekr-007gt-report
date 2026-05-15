// Text fidelity check.
//
// Complementary to the static check-content-coverage:
//   - check-content-coverage guarantees every source block is *referenced*
//     somewhere in JSX (via byId() or data-block-ref).
//   - text-fidelity verifies that the referenced text actually *renders* —
//     i.e. it survives CSS (display:none, line-clamp + overflow-hidden,
//     collapsed accordions) and isn't reduced to a fragment-only <Extract>
//     when the block was never also placed as a full <ProseBlock>.
//
// Granularity: PER PAGE. Each visited route is graded independently by
//   ratio = rendered_words / expected_words
// where expected_words is the sum over the page's byId / data-block-ref
// references. A page is flagged when its ratio dips below the threshold.
// A global cross-route ratio would let a fat overview page mask an empty
// detail page; per-page catches the regression where it lives.
//
// Word-counting rule: mirrors `ddl_client/src/tools/common/word_count.py`
// (the same counter used by the file-write progress hook), so "words"
// means the same thing in both places.
//   - each CJK character (Ideographs, Hiragana, Katakana, Hangul) = 1 word
//   - each Latin / digit run = 1 word (word-boundary tokenisation)
//   - whitespace and punctuation are dropped
// Repetition is preserved — counts are totals, not distinct-word counts.
//
// Image blocks are EXCLUDED from source counts. They render as <img alt=…>;
// alt text never appears in innerText, so counting alt words guarantees a
// deficit on every image-bearing page. The check measures *visible prose*
// fidelity, not metadata fidelity.
//
// Rendered text is <main>.innerText on each visited route after React
// has hydrated — the text the user actually sees. CSS-hidden content
// (display:none, height:0 overflow:hidden, line-clamp) is excluded by
// innerText, which is the whole point. Content from imported
// sub-components (<S1_HeroIntro/> etc.) is included naturally.
//
// Source filtering: [DDLive-TODO: ...] and [DDT-PLACEHOLDER: ...] markers
// are stripped from block text before counting. They are explicit "not yet
// authored" stubs that the coder is *supposed* to drop at render time;
// counting them against fidelity punishes correct behaviour.
//
// Pages with zero canonical references (chrome-only landing shells) are
// skipped — they're either intentional or already caught by other checks.
// `unknownRefs` (byId strings that don't resolve to any block) are surfaced
// in the per-page payload so the coder can see typos that drag expected=0.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { countWords } from './word-stats.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_ROOT = path.resolve(__dirname, '..', '..');
const GEN_DIR = path.resolve(TEMPLATE_ROOT, 'src/reports/.generated');
const PAGES_DIR = path.resolve(TEMPLATE_ROOT, 'src/pages');

function wordsForBlock(block) {
  // Image blocks render alt-only, which never paints; exclude from source.
  if (block.type === 'image') return 0;
  if (block.type === 'table') {
    let n = 0;
    for (const cell of block.header || []) n += countWords(cell);
    for (const row of block.rows || []) for (const cell of row) n += countWords(cell);
    return n;
  }
  if (typeof block.text === 'string') return countWords(block.text);
  return 0;
}

function collectSourceData() {
  // wordsByBlockId: fqId "section::block" → { words, report }
  // blocksByReport: report name → [{ fqId, words }] (for "candidates to add")
  const wordsByBlockId = new Map();
  const blocksByReport = new Map();
  const reports = [];
  if (!fs.existsSync(GEN_DIR)) return { reports, wordsByBlockId, blocksByReport };
  for (const file of fs.readdirSync(GEN_DIR).filter((f) => f.endsWith('.gen.ts'))) {
    const src = fs.readFileSync(path.join(GEN_DIR, file), 'utf8');
    const m = src.match(/const report: Report = ([\s\S]*?) as const;/);
    if (!m) continue;
    const obj = JSON.parse(m[1]);
    reports.push(obj.name);
    const reportBlocks = [];
    for (const sec of Object.values(obj.sections || {})) {
      for (const block of sec.blocks || []) {
        const fqId = `${sec.id}::${block.id}`;
        const w = wordsForBlock(block);
        wordsByBlockId.set(fqId, { words: w, report: obj.name });
        reportBlocks.push({ fqId, words: w });
      }
    }
    blocksByReport.set(obj.name, reportBlocks);
  }
  return { reports, wordsByBlockId, blocksByReport };
}

function findReferencesInPageSrc(src) {
  // Mirrors check-content-coverage.mjs: literal byId(report, '<fqId>') and
  // data-block-ref="<fqId>" both count as canonical references. ${CONST}
  // template substitutions are inlined when the const is a string literal
  // declared in the same file.
  const consts = {};
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*['"`]([^'"`]+)['"`]\s*;/g)) {
    consts[m[1]] = m[2];
  }
  const resolved = src.replace(/\$\{(\w+)\}/g, (_, name) =>
    Object.prototype.hasOwnProperty.call(consts, name) ? consts[name] : `\${${name}}`,
  );
  const refs = new Set();
  for (const m of resolved.matchAll(/byId\(\s*\w+\s*,\s*['"`]([^'"`]+)['"`]\s*\)/g)) refs.add(m[1]);
  for (const m of resolved.matchAll(/data-block-ref=['"`]([^'"`]+)['"`]/g)) refs.add(m[1]);
  return refs;
}

// Read routes.ts and return a Map<pageStem, routePath>.
// Pages not registered in routes.ts are absent from the map and skipped —
// orphan pages are caught by `pnpm run check:routes`.
function readPageRouteMap(srcDir) {
  const routesFile = path.join(srcDir, 'routes.ts');
  if (!fs.existsSync(routesFile)) return new Map();
  const src = fs.readFileSync(routesFile, 'utf8');
  const map = new Map();
  const re = /\{\s*path:\s*['"`]([^'"`]+)['"`][\s\S]*?import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const stem = m[2].replace(/^\.\/pages\//, '').replace(/\.tsx?$/, '');
    map.set(stem, m[1]);
  }
  return map;
}

function collectPagesData(pagesDir = PAGES_DIR) {
  if (!fs.existsSync(pagesDir)) return [];
  const srcDir = path.dirname(pagesDir);
  const routeByStem = readPageRouteMap(srcDir);
  const out = [];
  for (const name of fs.readdirSync(pagesDir)) {
    if (!name.endsWith('.tsx')) continue;
    const stem = name.replace(/\.tsx$/, '');
    const route = routeByStem.get(stem);
    if (!route) continue;
    const src = fs.readFileSync(path.join(pagesDir, name), 'utf8');
    out.push({ name, route, refs: findReferencesInPageSrc(src) });
  }
  return out;
}

// Reports referenced by a page's byIds — used to suggest in-report adoption
// candidates rather than dumping every unreferenced block from every report.
function reportsTouchedByPage(refs, wordsByBlockId) {
  const set = new Set();
  for (const fqId of refs) {
    const info = wordsByBlockId.get(fqId);
    if (info) set.add(info.report);
  }
  return set;
}

function buildPageEntry(page, sample, wordsByBlockId, blocksByReport, allReferenced) {
  const rendered = countWords(sample.visibleText || '');
  const refs = [];
  const unknownRefs = [];
  let expected = 0;
  for (const fqId of page.refs) {
    const info = wordsByBlockId.get(fqId);
    if (info) {
      expected += info.words;
      refs.push({ fqId, words: info.words });
    } else {
      unknownRefs.push(fqId);
    }
  }
  refs.sort((a, b) => b.words - a.words);

  // Adoption candidates: blocks in the same report(s) this page already
  // touches, that aren't referenced by any page yet. Bigger blocks first —
  // those move the needle most. Tagged with their source report so the
  // coder knows which .gen.ts to open when the page touches multiple.
  const reports = reportsTouchedByPage(page.refs, wordsByBlockId);
  const candidates = [];
  for (const reportName of reports) {
    for (const b of blocksByReport.get(reportName) || []) {
      if (b.words > 0 && !allReferenced.has(b.fqId)) {
        candidates.push({ ...b, report: reportName });
      }
    }
  }
  candidates.sort((a, b) => b.words - a.words);

  // Refs annotated with report name too — symmetry with candidates,
  // and helpful when a page imports from >1 report.
  const refsWithReport = refs.map((r) => {
    const info = wordsByBlockId.get(r.fqId);
    return { ...r, report: info ? info.report : null };
  });

  const ratio = expected > 0 ? rendered / expected : null;
  return {
    pageFile: page.name,
    route: page.route,
    rendered,
    expected,
    ratio,
    refs: refsWithReport,
    unknownRefs,
    candidates,
    sourceReports: [...reports],
  };
}

function formatLowPageError(entry, threshold) {
  const pct = Math.round(entry.ratio * 1000) / 10;
  const thresholdPct = Math.round(threshold * 100);
  const targetRendered = Math.ceil(threshold * entry.expected);
  const wordsNeeded = Math.max(0, targetRendered - entry.rendered);

  const lines = [];

  // ── Header: page identity ────────────────────────────────────────────────
  lines.push(`src/pages/${entry.pageFile} (route ${entry.route}) — visible text too short`);

  // ── Numbers block: current / target / short by / threshold / source ──────
  // Show the math explicitly so the coder doesn't have to multiply mentally.
  lines.push(`  current:   ${entry.rendered} word(s) rendered  (${pct}% of expected)`);
  lines.push(
    `  target:    ${targetRendered} word(s) rendered  ` +
      `= ceil(${threshold} × ${entry.expected} expected from blocks this page references)`,
  );
  lines.push(`  short by:  ${wordsNeeded} word(s)`);
  lines.push(`  threshold: ${thresholdPct}%`);
  if (entry.sourceReports && entry.sourceReports.length > 0) {
    // Always derivable from the report name: src/reports/<name>.md is the
    // seeker's source; src/reports/.generated/<name>.gen.ts is the bridge
    // mirror the page imports from.
    for (const reportName of entry.sourceReports) {
      lines.push(
        `  source:    src/reports/${reportName}.md  →  src/reports/.generated/${reportName}.gen.ts`,
      );
    }
  }

  // ── What's already on the page ───────────────────────────────────────────
  lines.push('');
  if (entry.refs.length > 0) {
    lines.push(`This page currently references:`);
    const head = entry.refs.slice(0, 12);
    for (const r of head) {
      const tag = r.report ? `   [report: ${r.report}]` : '';
      lines.push(`  - ${r.fqId} (${r.words}w)${tag}`);
    }
    if (entry.refs.length > head.length) {
      lines.push(`  …+${entry.refs.length - head.length} more`);
    }
  } else {
    lines.push(`This page currently references: (none — page renders nothing from src/reports/)`);
  }

  // ── Remedies ─────────────────────────────────────────────────────────────
  lines.push('');
  lines.push(`Add words via EITHER (a) or (b):`);
  lines.push('');

  // (a) Adopt unreferenced blocks
  if (entry.candidates.length > 0) {
    lines.push(
      `  (a) ADOPT an unreferenced source block — drift-proof; text stays in sync`,
    );
    lines.push(
      `      with the seeker. Candidates in reports this page already touches:`,
    );
    const head = entry.candidates.slice(0, 10);
    for (const c of head) {
      lines.push(`        - ${c.fqId} (${c.words}w)   [report: ${c.report}]`);
    }
    if (entry.candidates.length > head.length) {
      lines.push(`        …+${entry.candidates.length - head.length} more`);
    }
    // Show the exact one-liner using a real candidate so the coder can copy-paste.
    const sample = head[0].fqId;
    lines.push(`      Add either:`);
    lines.push(`        <ProseBlock content={byId(report, '${sample}')} />            // bridge`);
    lines.push(`        <div data-block-ref="${sample}">…retyped exact text…</div>    // retype`);
  } else {
    lines.push(
      `  (a) ADOPT an unreferenced source block — none available: every block in the`,
    );
    lines.push(
      `      report(s) this page touches is already referenced somewhere. Skip to (b),`,
    );
    lines.push(`      or check with the seeker if more source content is warranted.`);
  }

  // (b) Hand-write — with the explicit "no fabrication" guardrail
  lines.push('');
  lines.push(`  (b) HAND-WRITE more visible content in this page's JSX — captions, intros,`);
  lines.push(`      summaries, transitions that elaborate on bridge text.`);
  lines.push(`      NEVER make up statements, numbers, citations, dates, names, or facts.`);
  lines.push(`      Only restate / explain / elaborate what the report already establishes.`);
  lines.push(`      If you need a new fact, ask the seeker — do NOT invent.`);

  // ── Caveats + diagnostics ────────────────────────────────────────────────
  lines.push('');
  lines.push(
    `Note: only text inside <main> the user can SEE counts. Hidden via display:none`,
  );
  lines.push(
    `/ line-clamp / overflow:hidden / closed accordions does not. <Extract pick="…">`,
  );
  lines.push(
    `renders a fragment only — pair with a full <ProseBlock> if you want the whole block.`,
  );

  if (entry.unknownRefs.length > 0) {
    lines.push('');
    lines.push(
      `WARNING: unknown byIds on this page (typo? — they resolve to no source block, ` +
        `so they contribute 0 to expected): ${entry.unknownRefs.join(', ')}`,
    );
  }

  lines.push('');
  lines.push(
    `Env: DDT_TEXT_FIDELITY_THRESHOLD=<0..1> to retune, DDT_CHECK_TEXT_FIDELITY=false to disable.`,
  );
  return lines.join('\n');
}

export function validateTextFidelity({ visibleTextSamples, pageSamples, threshold, reporter }) {
  const { reports, wordsByBlockId, blocksByReport } = collectSourceData();
  if (wordsByBlockId.size === 0) {
    return { skipped: true };
  }

  // Legacy callers pass only `visibleTextSamples` (string[]). Without per-route
  // attribution we cannot compute per-page ratios — fall back to a single
  // pseudo-page graded against the full source pool.
  const samples = Array.isArray(pageSamples) && pageSamples.length > 0
    ? pageSamples
    : null;

  const pages = collectPagesData();
  const allReferenced = new Set();
  for (const p of pages) for (const r of p.refs) allReferenced.add(r);

  const perPage = [];
  if (samples) {
    for (const sample of samples) {
      const page = pages.find((p) => p.route === sample.route);
      if (!page) continue;
      perPage.push(buildPageEntry(page, sample, wordsByBlockId, blocksByReport, allReferenced));
    }
  } else {
    // Legacy single-bucket grading: sum everything as one synthetic page.
    let totalSourceWords = 0;
    for (const { words } of wordsByBlockId.values()) totalSourceWords += words;
    let renderedWordCount = 0;
    for (const sample of visibleTextSamples || []) renderedWordCount += countWords(sample);
    const ratio = totalSourceWords > 0 ? renderedWordCount / totalSourceWords : null;
    perPage.push({
      pageFile: '(aggregate, legacy caller)',
      route: '(aggregate)',
      rendered: renderedWordCount,
      expected: totalSourceWords,
      ratio,
      refs: [],
      unknownRefs: [],
      candidates: [],
    });
  }

  const lowPages = perPage.filter((e) => e.ratio != null && e.ratio < threshold);
  // Sort worst first.
  lowPages.sort((a, b) => a.ratio - b.ratio);

  for (const entry of lowPages) {
    reporter.pushError({
      type: 'text-fidelity-low',
      text: formatLowPageError(entry, threshold),
      ratio: entry.ratio,
      threshold,
      pageFile: entry.pageFile,
      route: entry.route,
      rendered: entry.rendered,
      expected: entry.expected,
      refs: entry.refs,
      unknownRefs: entry.unknownRefs,
      candidates: entry.candidates,
      sourceReports: entry.sourceReports,
    });
  }

  return {
    skipped: false,
    perPage,
    lowPages,
    reports,
  };
}
