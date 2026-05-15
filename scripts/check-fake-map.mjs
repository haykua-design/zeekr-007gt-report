#!/usr/bin/env node
/**
 * Static lint: catch "fake maps" — components named `*Map*` that draw markers
 * with hand-positioned `style={{ left: 'X%', top: 'Y%' }}` percentages instead
 * of using the real map bridge (`@/lib/map` / `<MapView>` / `<MapContainer>`).
 *
 * Why this exists: every couple of runs a coder produces a beautifully styled
 * SVG "map" that has zero geographic meaning — the dots float on a hand-drawn
 * squiggle. The template ships react-leaflet (via `@/lib/map`) and a one-import
 * `<MapView>` shortcut, so there's no good reason to fake it.
 *
 * Heuristic (intentionally narrow to avoid false positives):
 *   File whose path contains `map` (case-insensitive in basename) AND
 *   contains absolute-positioned percent-coord markers
 *     (`left:` + `%` + `top:` + `%` in the same JSX expression) AND
 *   does NOT import `MapContainer` or `MapView` from `@/lib/map` (or
 *     `@/components/MapView`).
 *
 * Files that ARE real maps (use the bridge) pass automatically; files that
 * happen to mention "map" but don't draw `%`-positioned markers also pass.
 *
 * Escape hatch: add `// @allow-fake-map` anywhere in the file to opt out
 * (e.g. a stylized "site map" diagram that genuinely isn't geographic).
 */
import { readFileSync, readdirSync } from 'fs';
import { join, basename, relative } from 'path';

const SRC_DIR = 'src';
const EXT = /\.(tsx|jsx)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', '.vite', '.generated', '_showcase']);

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (EXT.test(entry.name)) yield p;
  }
}

const NAME_RE = /map/i;
const ALLOW_RE = /@allow-fake-map/;
const REAL_IMPORT_RE = /from\s+['"](?:@\/lib\/map|@\/components\/MapView)['"]/;

// Detect a JSX style object that pins both `left` and `top` to percent values
// — the canonical fake-map marker pattern. We scan a sliding 3-line window so
// the heuristic survives template literals (`${x}%`) and multi-line style
// objects, both of which break a single-line regex.
//
// Match condition for a window:
//   contains `style={{` AND `left` AND `top` AND at least two `%`
//   AND at least one `%` appears within ~24 chars of `left:` or `top:`
//     (cheap proxy for "the % is the unit on the position", not just any %).
const STYLE_OPEN_RE = /style\s*=\s*\{\{/;
function windowMatches(window) {
  if (!STYLE_OPEN_RE.test(window)) return false;
  if (!/\bleft\b/.test(window) || !/\btop\b/.test(window)) return false;
  const pctCount = (window.match(/%/g) || []).length;
  if (pctCount < 2) return false;
  // Within ~32 chars after `left:` or `top:`, find a `%`. Allow `}` so
  // template-literal expressions (`${node.x}%`) don't break the proxy.
  return /\b(?:left|top)\s*:\s*[^,\n]{0,32}%/.test(window);
}

const errors = [];

for (const file of walk(SRC_DIR)) {
  const base = basename(file);
  if (!NAME_RE.test(base)) continue;

  const text = readFileSync(file, 'utf8');
  if (ALLOW_RE.test(text)) continue;
  if (REAL_IMPORT_RE.test(text)) continue;

  const lines = text.split('\n');
  let hitLine = -1;
  let hitKind = '';
  for (let i = 0; i < lines.length; i++) {
    const window = lines.slice(i, Math.min(i + 3, lines.length)).join(' ');
    if (windowMatches(window)) {
      hitLine = i + 1;
      hitKind = 'inline-percent-style';
      break;
    }
  }

  // Second signal: data objects shaped like `{ ..., x: '45%', y: '35%', ... }`
  // — the `%` lives in a const that flows into `style.left/top`. This is the
  // sneakier variant of the same anti-pattern.
  if (hitLine === -1) {
    for (let i = 0; i < lines.length; i++) {
      const window = lines.slice(i, Math.min(i + 4, lines.length)).join(' ');
      if (
        /\bx\s*:\s*['"][\d.]+%['"]/.test(window) &&
        /\by\s*:\s*['"][\d.]+%['"]/.test(window)
      ) {
        hitLine = i + 1;
        hitKind = 'percent-coord-data';
        break;
      }
    }
  }

  if (hitLine === -1) continue;
  errors.push({ file: relative('.', file), line: hitLine, kind: hitKind });
}

if (errors.length === 0) process.exit(0);

console.error(`Fake-map check failed (${errors.length} file(s)):\n`);
console.error(
  '  A component named like a map is positioning markers with `left/top: %`',
);
console.error('  instead of using the real map bridge. This produces a decorative SVG');
console.error('  with no geographic meaning.\n');
console.error('  Fix: import from `@/lib/map` (`<MapContainer>`, `<TileLayer>`, etc.)');
console.error('  or use the one-shot `<MapView points={[...]}>` from `@/components/MapView`.');
console.error('  See `static-visuals/maps` skill for the full pattern.\n');
console.error('  Escape hatch (rare): add `// @allow-fake-map` if the component is');
console.error('  genuinely not geographic (e.g. an abstract "site map" diagram).\n');

for (const e of errors) {
  console.error(`    - ${e.file}:${e.line}`);
}
console.error('');
console.error(JSON.stringify({ success: false, errors }, null, 2));
process.exit(1);
