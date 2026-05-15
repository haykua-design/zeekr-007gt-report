#!/usr/bin/env node
/**
 * Shell-host role boundary check.
 *
 * The template has two artifact roles, distinguished by **directory**:
 *
 *   src/pages/p{N}_<slug>.tsx          — content pages (1:1 with a report)
 *   src/shell_pages/shell{M}_<slug>.tsx — composing shells (no own content)
 *
 * This check enforces that the directory matches what's actually inside
 * the file:
 *
 *   1. shell-content-leak  — a file under src/shell_pages/ contains
 *      `byId(` or `data-block-ref=`. Shell pages must not render canonical
 *      report content of their own. Either move the file to src/pages/,
 *      or strip the refs.
 *
 *   2. page-imports-shell  — a file under src/pages/ imports from
 *      `../shell_pages/`. Role inversion: content pages should not depend
 *      on shells. If you genuinely need cross-page composition, the
 *      composing file belongs in src/shell_pages/.
 *
 * Why this matters: `text-fidelity.mjs` only walks src/pages/ to compute
 * per-report recall. Putting content into src/shell_pages/ silently
 * bypasses that floor. The directory boundary makes the role
 * unambiguous; this check makes a mismatch loud.
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, relative } from 'path';

const PAGES_DIR = 'src/pages';
const SHELL_DIR = 'src/shell_pages';
const EXT = /\.tsx$/;

const BYID_RE = /\bbyId\s*\(/g;
const BLOCKREF_RE = /\bdata-block-ref\s*=/g;
const SHELL_IMPORT_RE = /from\s+['"`][^'"`]*\/shell_pages\/[^'"`]+['"`]/g;

function listTsx(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && EXT.test(e.name))
    .map((e) => join(dir, e.name));
}

function findMatches(src, re) {
  const out = [];
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(lines[i])) !== null) {
      out.push({ line: i + 1, snippet: lines[i].trim() });
    }
  }
  return out;
}

const errors = [];

for (const file of listTsx(SHELL_DIR)) {
  const src = readFileSync(file, 'utf8');
  const byIds = findMatches(src, BYID_RE);
  const refs = findMatches(src, BLOCKREF_RE);
  if (byIds.length === 0 && refs.length === 0) continue;
  errors.push({
    file: relative('.', file),
    kind: 'shell-content-leak',
    hits: [...byIds, ...refs],
    hint:
      'Shell pages compose other pages — they must not render canonical ' +
      'report content of their own. Move this file to src/pages/ (and ' +
      'rename to p{N}_<slug>.tsx), or strip the byId / data-block-ref ' +
      'references and let the embedded <P{N} /> components render that ' +
      'content via their own routes.',
  });
}

for (const file of listTsx(PAGES_DIR)) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    SHELL_IMPORT_RE.lastIndex = 0;
    let m;
    while ((m = SHELL_IMPORT_RE.exec(lines[i])) !== null) {
      hits.push({ line: i + 1, snippet: lines[i].trim() });
    }
  }
  if (hits.length === 0) continue;
  errors.push({
    file: relative('.', file),
    kind: 'page-imports-shell',
    hits,
    hint:
      'Content pages must not import from src/shell_pages/. If you need ' +
      'to compose multiple pages, the composing file belongs in ' +
      'src/shell_pages/shell{M}_<slug>.tsx, not under src/pages/.',
  });
}

if (errors.length === 0) {
  console.log('✓ check:shell-host — no issues');
  process.exit(0);
}

console.error(`\n✗ check:shell-host — ${errors.length} issue(s)\n`);
for (const e of errors) {
  console.error(`  [${e.kind}] ${e.file}`);
  for (const h of e.hits.slice(0, 6)) {
    console.error(`    line ${h.line}: ${h.snippet}`);
  }
  if (e.hits.length > 6) console.error(`    …+${e.hits.length - 6} more`);
  console.error(`    ${e.hint}\n`);
}
process.exit(1);
