#!/usr/bin/env node
/**
 * Static lint: every `<MapContainer>` JSX block must contain a `<TileLayer>`.
 *
 * Why this exists: a coder hit `request-failed` errors on tile fetches in a
 * headless sandbox and "fixed" them by commenting out `<TileLayer />` inside
 * the shared `src/components/MapView.tsx`. The build went green; the rendered
 * page lost its basemap. The fake-map lint exempts files that import from
 * `@/lib/map`, so it didn't catch the regression. This lint is the positive-
 * presence counterpart: if a file mounts `<MapContainer>` it must also mount
 * `<TileLayer>` — anything else is a map without a basemap.
 *
 * Heuristic (intentionally narrow):
 *   File contains an UNCOMMENTED `<MapContainer` → it must also contain an
 *   UNCOMMENTED `<TileLayer`. Comments are stripped (JS line, JS block, and
 *   JSX `{/* ... *\/}` forms) before the check, so a commented-out
 *   `<TileLayer>` is treated as absent.
 *
 * Files that don't touch maps pass automatically. The runtime browser-check
 * allowlists canonical tile hosts (collectors.mjs CANONICAL_TILE_HOSTS), so
 * the legit `<TileLayer>` no longer fails the build in restricted sandboxes —
 * removing the temptation that produced the original regression.
 *
 * Escape hatch: add `// @allow-no-tiles` anywhere in the file to opt out
 * (rare — e.g. a custom map composition that uses an `<ImageOverlay>` instead
 * of tiles). Prefer fixing the markup over reaching for the hatch.
 */
import { readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';

const SRC_DIR = 'src';
const EXT = /\.(tsx|jsx)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', '.vite', '.generated', '_showcase']);
const ALLOW_RE = /@allow-no-tiles/;

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (EXT.test(entry.name)) yield p;
  }
}

// Strip comments so a commented-out `<TileLayer>` reads as absent.
// Order matters: block comments first (they may contain `//`), then JSX
// `{/* ... */}` (which our block-comment regex above already covers since the
// inner `/* ... */` is a JS comment — but JSX wraps it in braces, so we still
// need to remove the surrounding `{}` to avoid leaving stray braces, even if
// only cosmetically). Finally, line comments.
function stripComments(text) {
  // JS block + JSX `{/* ... */}` (the JSX form's inner /* */ is what matters,
  // but we also clear the wrapping braces if present).
  let out = text.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ');
  out = out.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // JS line comments (within JSX you write these only inside `{}`; outside
  // attribute syntax this is harmless).
  out = out.replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  return out;
}

const MAP_CONTAINER_RE = /<MapContainer[\s>/]/;
const TILE_LAYER_RE = /<TileLayer[\s>/]/;

const errors = [];

for (const file of walk(SRC_DIR)) {
  const text = readFileSync(file, 'utf8');
  if (ALLOW_RE.test(text)) continue;

  const stripped = stripComments(text);
  if (!MAP_CONTAINER_RE.test(stripped)) continue;
  if (TILE_LAYER_RE.test(stripped)) continue;

  // Find the line of the offending <MapContainer in the *original* text so
  // the error points where a human can see it.
  const lines = text.split('\n');
  let hitLine = 1;
  for (let i = 0; i < lines.length; i++) {
    if (MAP_CONTAINER_RE.test(lines[i])) {
      hitLine = i + 1;
      break;
    }
  }
  errors.push({ file: relative('.', file), line: hitLine });
}

if (errors.length === 0) {
  console.log('✓ Every <MapContainer> has a <TileLayer> basemap.');
  process.exit(0);
}

console.error(`Tile-presence check failed (${errors.length} file(s)):\n`);
console.error('  A `<MapContainer>` is mounted without a `<TileLayer>`. Without a tile');
console.error('  layer the map renders as an empty grey panel — markers float on nothing.\n');
console.error('  Fix: add `<TileLayer {...TILES.cartoLight} />` (or another spread from');
console.error('  `@/lib/map` `TILES`) as a child of the `<MapContainer>`. The runtime');
console.error('  browser-check allowlists the canonical tile hosts, so a real');
console.error('  `<TileLayer>` will not fail the build even in restricted-network');
console.error('  sandboxes.\n');
console.error('  Escape hatch (rare): add `// @allow-no-tiles` if the map intentionally');
console.error('  uses an `<ImageOverlay>`/custom layer instead of a tile basemap.\n');

for (const e of errors) {
  console.error(`    - ${e.file}:${e.line}`);
}
console.error('');
console.error(JSON.stringify({ success: false, errors }, null, 2));
process.exit(1);
