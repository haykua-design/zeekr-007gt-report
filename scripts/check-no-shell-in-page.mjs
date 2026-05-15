#!/usr/bin/env node
/**
 * Static lint: catch the "double nav / double footer" bug.
 *
 * Every page in `src/pages/p{N}_{slug}.tsx` is rendered inside the App.tsx
 * layout, which already provides the site `<header>` (nav bar) and
 * `<footer>`. A page that renders its own `<header>` / `<footer>` / `<nav>`
 * stacks on top of the site shell — the user sees two nav bars or two footers.
 *
 * Heuristic (intentionally narrow):
 *   File directly under `src/pages/` AND
 *   contains an opening JSX tag `<header`, `<footer`, or `<nav` AND
 *   the file has no `@allow-page-shell` opt-out marker.
 *
 * Scope: this check applies only to `src/pages/`. Files under
 * `src/shell_pages/` are composing shells that *may* render their own
 * chrome (that's the point of being a shell), so they are out of scope
 * here.
 *
 * Escape hatch: add `// @allow-page-shell` (or `{/* @allow-page-shell *\/}`)
 * anywhere in the file for genuine inner-card semantic use, e.g.
 * `<article><header><h2>...</h2></header></article>` inside a blog post.
 *
 * Same shape as `check-fake-map.mjs`: one sanctioned home (App.tsx + the
 * NavBar / SiteFooter components it renders), narrow heuristic, file-level
 * escape hatch.
 */
import { readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';

const PAGES_DIR = 'src/pages';
const EXT = /\.(tsx|jsx)$/;
const TAG_RE = /<(header|footer|nav)\b/g;
const ALLOW_RE = /@allow-page-shell/;

// Strip JS line comments and JSX/JS block comments so a stray `<header>` in
// a comment ("// don't add a <header> here") doesn't trip the lint.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

const errors = [];
let entries;
try {
  entries = readdirSync(PAGES_DIR, { withFileTypes: true });
} catch {
  // No pages dir (e.g. unusual fixture) — nothing to lint.
  process.exit(0);
}

for (const entry of entries) {
  if (!entry.isFile() || !EXT.test(entry.name)) continue;
  const file = join(PAGES_DIR, entry.name);
  const raw = readFileSync(file, 'utf8');
  if (ALLOW_RE.test(raw)) continue;

  const cleaned = stripComments(raw);
  // Walk lines of the cleaned source so reported line numbers stay close to
  // the original (block-comment removal can shift numbering, but for the
  // vast majority of pages comments are single-line and this stays accurate).
  const lines = cleaned.split('\n');
  for (let i = 0; i < lines.length; i++) {
    let m;
    TAG_RE.lastIndex = 0;
    while ((m = TAG_RE.exec(lines[i])) !== null) {
      errors.push({
        file: relative('.', file),
        line: i + 1,
        tag: m[1],
      });
    }
  }
}

if (errors.length === 0) process.exit(0);

console.error(`Page-shell check failed (${errors.length} occurrence(s)):\n`);
console.error(
  '  Pages must NOT render `<header>`, `<footer>`, or `<nav>` — the App.tsx',
);
console.error(
  '  layout already wraps every page with the site nav and footer. Adding',
);
console.error(
  '  them inside a page stacks on top of the site shell, producing the',
);
console.error('  classic double-nav / double-footer bug.\n');
console.error(
  '  Fix: edit nav content in `src/components/NavBar.tsx`, footer in',
);
console.error(
  '  `src/components/SiteFooter.tsx`, or layout shape in `src/App.tsx`.',
);
console.error(
  '  For page-level',
);
console.error(
  '  chrome (hero title, section heading, end-of-page CTA) use `<section>`,',
);
console.error('  `<div>`, or a heading element — not site-shell tags.\n');
console.error(
  '  Escape hatch (rare): add `// @allow-page-shell` to the file for genuine',
);
console.error(
  '  inner-card semantic use like `<article><header>...</header></article>`.',
);
console.error('  Site shell (header / nav / footer) lives in src/App.tsx + src/components/{NavBar,SiteFooter}.tsx — page files do not render those tags.\n');

for (const e of errors) {
  console.error(`    - ${e.file}:${e.line}  <${e.tag}>`);
}
console.error('');
console.error(JSON.stringify({ success: false, errors }, null, 2));
process.exit(1);
