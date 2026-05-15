#!/usr/bin/env node
/**
 * Static check: src/components/NavBar.tsx must not still contain the
 * PLACEHOLDER_NAVBAR marker comment shipped with the template.
 *
 * Replaces the runtime `throw` placeholder that used to live in AppShell.tsx.
 * The marker exists so the default starter render isn't accepted as a finished
 * site nav; the coder removes it once they've authored the real nav.
 */
import { readFileSync, existsSync } from 'fs';

const NAVBAR = 'src/components/NavBar.tsx';
const MARKER = 'PLACEHOLDER_NAVBAR';

if (!existsSync(NAVBAR)) {
  console.error(`✗ check:navbar — ${NAVBAR} is missing.`);
  console.error('  The site nav lives here. Restore the file from the template.');
  process.exit(1);
}

const src = readFileSync(NAVBAR, 'utf8');
if (src.includes(MARKER)) {
  console.error(`✗ check:navbar — ${NAVBAR} still contains the ${MARKER} marker.`);
  console.error(
    '  Author the real nav (logo / brand + route links in the target language)\n' +
    '  using <AppLink to={...}> from @/components/AppLink, then DELETE the line\n' +
    `  containing the ${MARKER} comment. The default starter render is not\n` +
    '  accepted as a shipped nav.',
  );
  process.exit(1);
}

console.log('✓ check:navbar — NavBar implemented');
