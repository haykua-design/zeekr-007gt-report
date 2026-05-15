#!/usr/bin/env node
/**
 * Enforce: every <DdlFormula> / <DdlFormulaBlock> must pass content
 * via String.raw tagged template. No content prop, no plain-text children,
 * no untagged templates.
 *
 * Run: node scripts/check-formula-raw.mjs
 */
import { readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';

const SRC_DIR = 'src';
const SKIP_DIRS = new Set(['node_modules', 'dist', '.vite', '_showcase']);

// Files exempted from this check. `src/components/Formula.tsx` IS the DdlFormula
// component's implementation — its JSDoc examples legitimately contain the
// literal string "<DdlFormula>", which is not runtime JSX and must not be
// flagged. Use forward-slash-normalized relative paths so it works on Windows.
const EXEMPT_FILES = new Set([
  'src/components/Formula.tsx',
]);

function* walkTsx(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkTsx(p);
    else if (entry.name.endsWith('.tsx')) yield p;
  }
}

const COMPONENT_RE = /<Ddl(?:Formula|FormulaBlock)\b/;

let errors = 0;

for (const file of walkTsx(SRC_DIR)) {
  const relFwd = relative('.', file).replace(/\\/g, '/');
  if (EXEMPT_FILES.has(relFwd)) continue;

  const lines = readFileSync(file, 'utf8').split('\n');

  for (let i = 0; i < lines.length; i++) {
    if (!COMPONENT_RE.test(lines[i])) continue;

    // Skip comment lines — JSDoc/inline examples reference the component without String.raw.
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;

    // Grab this line + a few more to handle multi-line JSX
    const context = lines.slice(i, Math.min(i + 5, lines.length)).join(' ');

    // Match: the component opening through its closing /> or >...</
    // Accept if String.raw appears in that span
    if (/String\.raw\s*`/.test(context)) continue;

    // Self-closing with no content/children (e.g. layout placeholder) — skip
    if (/\/\s*>/.test(lines[i]) && !/content/.test(lines[i]) && !/>.*[^/]>/.test(lines[i])) continue;

    errors++;
    const rel = relative('.', file);
    console.error(`ERROR  ${rel}:${i + 1}`);
    console.error(`  ${lines[i].trim()}`);
    console.error(`  → Must use: <DdlFormula>{String.raw\`$...$\`}</DdlFormula>\n`);
  }
}

if (errors) {
  console.error(`${errors} formula(s) missing String.raw — fix to avoid backslash bugs.`);
  process.exit(1);
}
console.log('✓ All formula components use String.raw');
