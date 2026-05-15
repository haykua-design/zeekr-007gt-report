#!/usr/bin/env node
// Report bridge codegen.
//
// Reads src/reports/*.md, parses each into a structured block tree, and writes
// src/reports/.generated/<basename>.gen.ts. Pages import from the .gen file and
// render content via <ProseBlock content={report.sections[id].blocks[n]} />.
//
// Block schema (one per leaf in the .md):
//   - heading:    { type: 'heading', id, level, text, html }
//   - paragraph:  { type: 'paragraph', id, text, html, leadNumber?, leadEntity?, stats }
//   - list-item:  { type: 'list-item', id, text, html, leadNumber?, leadEntity?, stats }
//   - table:      { type: 'table', id, header, rows, stats }
//   - image:      { type: 'image', id, src, alt }
//   - raw:        { type: 'raw', id, text } (fallback when parser can't classify)
//
// Stats (paragraph / list-item / table only):
//   { chars, words, maxWordLen }
// Coders use these at design time to pick a layout that fits the content —
// short blocks belong in callouts/cards, long blocks need full-width slots,
// large `maxWordLen` requires `break-words` regardless of total length.
// "Words" = natural human words, NOT LLM tokens (CJK char = 1, Latin run = 1).
//
// Sections are formed by H2 / H3 boundaries and inherit ids from `{#anchor}`
// suffixes if present, else slugified from the heading text.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeBlockStats } from './browser-check/word-stats.mjs';
import { validateReportImageSource } from './check-report-images.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_TEMPLATE_ROOT = path.resolve(__dirname, '..');

// ---------- helpers ----------

// Map fullwidth punctuation to ASCII so downstream slug stripping catches them.
// Needed because `：` (U+FF1A) looks identical to `:` but would otherwise survive
// into section ids and collide with the `::` fqId delimiter when coders hand-
// type references.
const FULLWIDTH_PUNCT = {
  '\uFF1A': ':', '\uFF0C': ',', '\u3001': ',', '\u3002': '.', '\uFF0E': '.',
  '\uFF01': '!', '\uFF1F': '?', '\uFF08': '(', '\uFF09': ')',
  '\uFF3B': '[', '\uFF3D': ']', '\uFF5B': '{', '\uFF5D': '}',
  '\u201C': '"', '\u201D': '"', '\u2018': "'", '\u2019': "'",
  '\u300A': '<', '\u300B': '>', '\u2014': '-', '\u2013': '-',
};
function normalizeFullwidth(text) {
  return text.replace(
    /[\uFF1A\uFF0C\u3001\u3002\uFF0E\uFF01\uFF1F\uFF08\uFF09\uFF3B\uFF3D\uFF5B\uFF5D\u201C\u201D\u2018\u2019\u300A\u300B\u2014\u2013]/g,
    ch => FULLWIDTH_PUNCT[ch] || ch,
  );
}

// Slugify a heading to a stable ASCII-safe id. Returns null when the input
// contains no ASCII alphanumerics — caller must substitute a synthetic id
// (e.g. `sec-3`). Keeping CJK in ids was unsafe: long strings + fullwidth
// punctuation are easy for LLM coders to mistype, producing silent byId()
// misses that render blank.
function slugify(text) {
  const normalized = normalizeFullwidth(text);
  // If the heading contains ANY CJK / non-ASCII letters, don't try to salvage
  // the ASCII fragment — the result (e.g. "alpha" from "深圳：科技Alpha车展") is
  // misleading and doesn't describe the section. Return null so the caller
  // falls back to a synthetic `sec-{n}` id, which is explicitly opaque.
  if (/[^\x00-\x7F]/.test(normalized)) return null;
  const cleaned = normalized
    .toLowerCase()
    .replace(/[^a-z0-9\-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!/[a-z]/.test(cleaned)) return null; // all-digit or empty
  return cleaned.slice(0, 80);
}

function extractAnchor(headingText) {
  // Match trailing `{#anchor}`; return [cleanText, anchor|null].
  const m = headingText.match(/^(.*?)\s*\{#([\w\-一-龥]+)\}\s*$/);
  if (m) return [m[1].trim(), m[2]];
  return [headingText.trim(), null];
}

// Inline markdown → HTML (minimal: bold, italic, code, links, images).
//
// Image src normalization: markdown stores filesystem-form `/public/assets/...`
// so the .md previews correctly in any markdown viewer. The inline `<img>` lands
// in paragraph HTML rendered via `dangerouslySetInnerHTML`, where it must use
// Vite URL-form `/assets/...` instead. Standalone image *blocks* (image-only
// lines) keep the verbatim filesystem-form — coders never bridge those; they
// retype with <ZoomableImage>. This strip is the inline-only escape hatch.
function inlineToHtml(text) {
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) =>
      `<img alt="${alt}" src="${src.replace(/^\/public\//, '/')}" />`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function inlineToPlainText(text) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

// Heuristic: extract the first dollar/RMB/percent-shaped number and the named
// entity it most likely refers to (the bolded fragment, or the parenthesized
// English title). These are display-extraction hints — a layout designer can
// promote them to large-format treatments without losing the rest of the text.
function extractLeadHints(text) {
  const numberMatch = text.match(/(?:\$|￥|US\$|US ?\$|约|超过|约 )?\s*([\d.]+)\s*(亿美元|亿元|万美元|亿|million|billion|%|percent)/i);
  const leadNumber = numberMatch ? numberMatch[0].trim() : null;

  let leadEntity = null;
  const boldMatch = text.match(/\*\*([^*]+)\*\*/);
  if (boldMatch) {
    leadEntity = boldMatch[1];
  } else {
    const titleMatch = text.match(/《([^》]+)》/);
    if (titleMatch) leadEntity = titleMatch[1];
  }
  return { leadNumber, leadEntity };
}

// ---------- parser ----------

export { slugify };
export function parseMarkdown(source) {
  // Strip frontmatter (--- ... ---) for now; data extraction is a TODO for v2.
  let body = source;
  let frontmatter = {};
  const fmMatch = source.match(/^---\n([\s\S]*?)\n---\n/);
  if (fmMatch) {
    body = source.slice(fmMatch[0].length);
    // Minimal frontmatter parse: key: value pairs only.
    for (const line of fmMatch[1].split('\n')) {
      const kv = line.match(/^(\w+):\s*(.*)$/);
      if (kv) frontmatter[kv[1]] = kv[2];
    }
  }

  const lines = body.split('\n');
  const sections = [];
  let currentSection = null;
  let buffer = []; // pending paragraph lines
  let inList = false;
  let pendingTable = null;
  let blockCounter = 0;

  function nextBlockId(prefix) {
    blockCounter += 1;
    return `${prefix}-${blockCounter}`;
  }

  function flushBuffer() {
    if (buffer.length === 0) return;
    const text = buffer.join(' ').trim();
    buffer = [];
    if (!text || !currentSection) return;
    const hints = extractLeadHints(text);
    const plain = inlineToPlainText(text);
    const html = inlineToHtml(text);
    // Omit `html` when it's byte-identical to `text` (no inline markdown).
    // Consumers fall back to `text`; saves ~50% file size on CJK reports where
    // most paragraphs carry no inline formatting.
    const block = {
      type: 'paragraph',
      id: nextBlockId('p'),
      text: plain,
      leadNumber: hints.leadNumber,
      leadEntity: hints.leadEntity,
      stats: computeBlockStats(plain),
    };
    if (html !== plain) block.html = html;
    currentSection.blocks.push(block);
  }

  function flushTable() {
    if (!pendingTable || !currentSection) {
      pendingTable = null;
      return;
    }
    // Stats sum across all cells. `maxWordLen` here is the worst-case cell
    // token — the predictor for whether the table needs `overflow-x-auto`
    // or per-column `break-words`.
    const allCellText = [
      ...pendingTable.header,
      ...pendingTable.rows.flat(),
    ].join(' ');
    currentSection.blocks.push({
      type: 'table',
      id: nextBlockId('tbl'),
      header: pendingTable.header,
      rows: pendingTable.rows,
      stats: computeBlockStats(allCellText),
    });
    pendingTable = null;
  }

  function startSection(level, rawText) {
    const [cleanText, explicitAnchor] = extractAnchor(rawText);
    // H1 defaults to the stable id "title". H2/H3 get an ASCII slug; when the
    // heading is CJK-only (slugify → null), fall back to a synthetic `sec-{n}`
    // so coders never see an unprintable or ambiguous id. Explicit `{#anchor}`
    // always wins.
    let id;
    if (explicitAnchor) {
      id = explicitAnchor;
    } else if (level === 1) {
      id = 'title';
    } else {
      id = slugify(cleanText) || `sec-${sections.length + 1}`;
    }
    // Collision-proof: two sections with the same slug get numeric suffixes.
    if (sections.some(s => s.id === id)) {
      const base = id;
      let n = 2;
      while (sections.some(s => s.id === `${base}-${n}`)) n++;
      id = `${base}-${n}`;
    }
    const section = {
      id,
      level,
      heading: cleanText,
      blocks: [],
    };
    sections.push(section);
    currentSection = section;
    blockCounter = 0;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushBuffer();
      flushTable();
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      if (level === 1) {
        // Title: synthetic root section with stable id 'title'
        // (unless the author supplied an explicit `{#anchor}`).
        if (!currentSection || currentSection.id !== 'title') {
          startSection(1, headingText);
        } else {
          currentSection.heading = extractAnchor(headingText)[0];
        }
      } else {
        startSection(level, headingText);
      }
      inList = false;
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      flushBuffer();
      flushTable();
      inList = false;
      continue;
    }

    // Table row
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushBuffer();
      const cells = line.trim().slice(1, -1).split('|').map(c => c.trim());
      const isSeparator = cells.every(c => /^:?-+:?$/.test(c));
      if (!pendingTable) {
        pendingTable = { header: cells, rows: [] };
      } else if (isSeparator) {
        // ignore separator
      } else {
        pendingTable.rows.push(cells);
      }
      continue;
    } else if (pendingTable) {
      flushTable();
    }

    // List item
    const listMatch = line.match(/^\s*([*\-+]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      flushBuffer();
      const text = listMatch[2];
      if (!currentSection) continue;
      const hints = extractLeadHints(text);
      const liPlain = inlineToPlainText(text);
      const liHtml = inlineToHtml(text);
      const liBlock = {
        type: 'list-item',
        id: nextBlockId('li'),
        text: liPlain,
        leadNumber: hints.leadNumber,
        leadEntity: hints.leadEntity,
        stats: computeBlockStats(liPlain),
      };
      if (liHtml !== liPlain) liBlock.html = liHtml;
      currentSection.blocks.push(liBlock);
      inList = true;
      continue;
    } else {
      inList = false;
    }

    // Image-only line
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (imgMatch) {
      flushBuffer();
      if (currentSection) {
        currentSection.blocks.push({
          type: 'image',
          id: nextBlockId('img'),
          alt: imgMatch[1],
          src: imgMatch[2],
        });
      }
      continue;
    }

    // Blank line → paragraph break
    if (/^\s*$/.test(line)) {
      flushBuffer();
      continue;
    }

    // Paragraph accumulation
    buffer.push(line);
  }

  flushBuffer();
  flushTable();

  return { frontmatter, sections };
}

// ---------- codegen ----------

function emitGenFile(reportName, parsed) {
  const sectionsObj = {};
  const allBlockIds = [];
  for (const sec of parsed.sections) {
    for (const block of sec.blocks) {
      allBlockIds.push(`${sec.id}::${block.id}`);
    }
    // Emit each section without its `id` field — it's a pure duplicate of the
    // dict key and no consumer reads it. `fqId` is no longer pre-baked onto
    // blocks either; `byId()` is the one supported retrieval path and it
    // attaches fqId at runtime. This trims ~10% off the .gen.ts on CJK reports.
    const { id: _unusedId, ...secWithoutId } = sec;
    sectionsObj[sec.id] = secWithoutId;
  }

  const json = JSON.stringify({
    name: reportName,
    frontmatter: parsed.frontmatter,
    sections: sectionsObj,
    allBlockIds,
  }, null, 2);

  const ts = `// AUTO-GENERATED by scripts/build-report-bridge.mjs — do not edit by hand.
// Source: src/reports/${reportName}.md
import type { Report } from '@/components/report/types';

const report: Report = ${json} as const;

export default report;
export const sections = report.sections;
export const allBlockIds = report.allBlockIds;
`;
  return ts;
}

// ---------- validation ----------

// Inspect a parsed report and return a list of human-readable issues.
// Issues are advisory by default (printed to stderr, build continues), but
// callers can pass `strict: true` to turn them into a thrown error — useful
// for guardians like the seeker's task_done check that want to block
// completion when reports would render empty.
//
// Checks performed:
//   - at least one section
//   - at least one total block across all sections
//   - no empty sections (section with zero blocks = silent content loss)
//   - no duplicate section ids (collision breaks byId lookup)
//   - image refs valid (when `source` + `templateRoot` are provided): markdown
//     uses filesystem-form `/public/assets/<file>` (bare `/assets/...` is the
//     JSX form — rejected with a fix-it), no external http(s) URLs, every
//     referenced file exists on disk under <templateRoot>/public/. See
//     check-report-images.mjs for the protocol rationale.
export function validateParsedReport(reportName, parsed, opts = {}) {
  const issues = [];
  if (parsed.sections.length === 0) {
    issues.push(`${reportName}: parsed 0 sections (markdown may be empty or malformed)`);
    return issues;
  }
  const totalBlocks = parsed.sections.reduce((n, s) => n + s.blocks.length, 0);
  if (totalBlocks === 0) {
    issues.push(`${reportName}: parsed 0 blocks across ${parsed.sections.length} section(s)`);
  }
  const seenIds = new Set();
  for (const sec of parsed.sections) {
    if (seenIds.has(sec.id)) {
      issues.push(`${reportName}: duplicate section id "${sec.id}" — anchors must be unique within a file`);
    }
    seenIds.add(sec.id);
    if (sec.blocks.length === 0) {
      issues.push(`${reportName}: section "${sec.id}" (heading: "${sec.heading}") has 0 blocks — all prose under this heading was lost`);
    }
  }
  // Image-ref validation. Only runs when the caller supplies the raw source
  // (so we can scan inline images embedded in paragraphs / list items, not
  // just standalone image blocks emitted by the parser).
  if (opts.source) {
    issues.push(...validateReportImageSource(reportName, opts.source, { templateRoot: opts.templateRoot }));
  }
  return issues;
}

// ---------- public API ----------

// Generate .gen.ts files for every src/reports/*.md under the given template
// root. Returns an object with the list of written files and any validation
// issues found. Quiet mode skips per-file logging — useful for HMR.
//
// If `strict: true` and any report has validation issues, throws an Error
// naming every failing report. Callers that just want to codegen without
// gating on content quality should leave strict=false (the default).
export function buildReportBridge({ templateRoot = DEFAULT_TEMPLATE_ROOT, quiet = false, strict = false } = {}) {
  const reportsDir = path.resolve(templateRoot, 'src/reports');
  const genDir = path.resolve(reportsDir, '.generated');

  if (!fs.existsSync(reportsDir)) {
    if (!quiet) console.log(`[report-bridge] no reports dir at ${reportsDir}; nothing to do`);
    return { written: [], issues: [] };
  }
  fs.mkdirSync(genDir, { recursive: true });

  const reportFiles = fs.readdirSync(reportsDir).filter(f => f.endsWith('.md'));
  const written = [];
  const allIssues = [];
  let total = 0;
  for (const file of reportFiles) {
    const reportName = file.replace(/\.md$/, '');
    const source = fs.readFileSync(path.join(reportsDir, file), 'utf8');
    const parsed = parseMarkdown(source);
    const ts = emitGenFile(reportName, parsed);
    const outPath = path.join(genDir, `${reportName}.gen.ts`);
    fs.writeFileSync(outPath, ts);
    written.push(outPath);
    const blockCount = parsed.sections.reduce((n, s) => n + s.blocks.length, 0);
    if (!quiet) {
      console.log(`[report-bridge] ${file} → ${reportName}.gen.ts  (${parsed.sections.length} sections, ${blockCount} blocks)`);
    }
    total += blockCount;

    const issues = validateParsedReport(reportName, parsed, { source, templateRoot });
    if (issues.length > 0) {
      for (const issue of issues) {
        console.error(`[report-bridge:validate] ${issue}`);
      }
      allIssues.push(...issues);
    }
  }
  if (!quiet) console.log(`[report-bridge] done. ${reportFiles.length} report(s), ${total} blocks.`);

  if (strict && allIssues.length > 0) {
    const err = new Error(
      `[report-bridge] validation failed with ${allIssues.length} issue(s):\n  - ` +
      allIssues.join('\n  - ')
    );
    err.issues = allIssues;
    throw err;
  }
  return { written, issues: allIssues };
}

// CLI entrypoint: only runs when invoked directly via `node …`.
//
// Usage:
//   node build-report-bridge.mjs              # codegen, warn on issues
//   node build-report-bridge.mjs --strict     # codegen, exit 1 on issues
if (import.meta.url === `file://${process.argv[1]}`) {
  const strict = process.argv.includes('--strict');
  try {
    buildReportBridge({ strict });
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
