#!/usr/bin/env node
/**
 * Static lint: `react-leaflet` and `leaflet` may only be imported from the
 * sanctioned map gateway. Any other file → error.
 *
 * Why: every geographic map in this template flows through one entry point
 * (`@/lib/map`) and one shortcut component (`<MapView>`). Agents who try to
 * hand-roll leaflet around their own `*Map*` wrapper produce duplicated,
 * inconsistent, often-broken maps. Locking the import surface forces every
 * real map through `<MapView>` — the same shape DdlFormula uses for LaTeX.
 *
 * Allowlist (forward-slash relative to project root):
 *   - src/lib/map.ts         — the gateway; pulls in react-leaflet + leaflet CSS
 *   - src/components/MapView.tsx — uses leaflet *types* only; runtime via @/lib/map
 *
 * Anyone else importing from `react-leaflet` / `leaflet` → error, with a
 * pointer to `<MapView>` and `@/lib/map`.
 */
import { readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';

const SRC_DIR = 'src';
const EXT = /\.(tsx|jsx|ts|mts)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', '.vite', '.generated', '_showcase']);

const ALLOW = new Set([
  'src/lib/map.ts',
  'src/components/MapView.tsx',
]);

// Match `from 'react-leaflet'` / `from 'leaflet'` / `from 'leaflet/...'`.
// Also catch `import 'leaflet/dist/leaflet.css'` style side-effect imports.
const IMPORT_RE = /\bfrom\s+['"](react-leaflet|leaflet(?:\/[^'"]*)?)['"]/;
const SIDE_EFFECT_RE = /^\s*import\s+['"](react-leaflet|leaflet(?:\/[^'"]*)?)['"]/;

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (EXT.test(entry.name)) yield p;
  }
}

const errors = [];

for (const file of walk(SRC_DIR)) {
  const relFwd = relative('.', file).replace(/\\/g, '/');
  if (ALLOW.has(relFwd)) continue;

  const lines = readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = IMPORT_RE.exec(line) || SIDE_EFFECT_RE.exec(line);
    if (!m) continue;
    errors.push({ file: relFwd, line: i + 1, module: m[1], text: line.trim() });
  }
}

if (errors.length === 0) {
  console.log('✓ Leaflet imports are channeled through @/lib/map / <MapView>');
  process.exit(0);
}

console.error(`Leaflet-channel check failed (${errors.length} import(s)):\n`);
console.error('  `react-leaflet` and `leaflet` may only be imported from the');
console.error('  sanctioned gateway:');
console.error('    - src/lib/map.ts');
console.error('    - src/components/MapView.tsx\n');
console.error('  Use the one-shot `<MapView points={[...]} paths={[...]} />` from');
console.error('  `@/components/MapView` for the common case, or compose primitives');
console.error('  from `@/lib/map` (`MapContainer`, `TileLayer`, `CircleMarker`, …)');
console.error('  if you genuinely need custom layers.\n');

for (const e of errors) {
  console.error(`    - ${e.file}:${e.line}  (${e.module})`);
  console.error(`        ${e.text}`);
}
console.error('');
console.error(JSON.stringify({ success: false, errors }, null, 2));
process.exit(1);
