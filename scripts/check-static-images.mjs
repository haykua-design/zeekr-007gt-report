#!/usr/bin/env node
/**
 * Static pre-lint for image usage — catches three classes of bugs *before*
 * Chromium boots in the browser check:
 *
 *   1. Hardcoded `/public/...` prefix in JSX `src=` (Vite serves the public
 *      folder at the site root; correct form is `/assets/...`).
 *   2. External `http(s)://` URLs in `<img>` / `<ZoomableImage>` / `<source>` —
 *      content images must come from the image_registry (local `/assets/...`).
 *   3. External `http(s)://` URLs inside CSS `url(...)` — covers Tailwind
 *      arbitrary values (`bg-[url('https://...')]`), JSX inline styles
 *      (`style={{ backgroundImage: "url('https://...')" }}`), and any
 *      `.css` file. The "grainy-gradients.vercel.app" / "tailwindcss noise"
 *      cargo-cult URLs commonly emitted by LLMs all 404 at runtime; this
 *      catches them up-front.
 *
 * This duplicates hints already present in the browser-check validators so the
 * coder sees the *same* guidance but ~90× faster (<100ms vs ~9s). The browser
 * check remains the final guardrail; this is additive.
 */
import { readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';

const SRC_DIR = 'src';
const EXT = /\.(tsx?|jsx?|css)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', '.vite', '_showcase']);

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (EXT.test(entry.name)) yield p;
  }
}

// Match `src="..."` where the tag is an image-bearing element. We only scan a
// small line window because JSX attributes rarely span many lines; false
// negatives here are fine (browser check catches them) but false positives
// would spam the coder.
const IMG_TAG_RE = /<(img|ZoomableImage|source|image)\b/;
const SRC_ATTR_RE = /\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|\{\s*["'`]([^"'`]+)["'`]\s*\})/g;

// Match every CSS `url(...)` reference in a line — covers all of:
//   - Tailwind arbitrary values: className="bg-[url('https://...')]"
//   - JSX inline styles:        style={{ backgroundImage: "url('https://...')" }}
//   - Plain CSS:                background: url('https://...');
// The optional whitespace + optional quote handling matches CSS spec.
// Captures the URL string itself in group 1.
const CSS_URL_RE = /\burl\(\s*['"]?([^'")\s]+)['"]?\s*\)/g;

const errors = [];

function report(file, line, kind, value, hint) {
  errors.push({
    file: relative('.', file),
    line: line + 1,
    kind,
    value,
    hint,
  });
}

for (const file of walk(SRC_DIR)) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');

  // Pass 1: image-bearing JSX tags with `src=` (existing behavior).
  for (let i = 0; i < lines.length; i++) {
    if (!IMG_TAG_RE.test(lines[i])) continue;

    // Look ahead up to 5 lines for the src attr on the same element.
    const window = lines.slice(i, Math.min(i + 6, lines.length)).join(' ');
    SRC_ATTR_RE.lastIndex = 0;
    let match;
    while ((match = SRC_ATTR_RE.exec(window)) !== null) {
      const value = match[1] ?? match[2] ?? match[3] ?? '';
      if (!value) continue;

      if (value.startsWith('/public/')) {
        report(
          file,
          i,
          'public-prefix',
          value,
          'Use `/assets/filename` in src, not `/public/assets/...`. Vite serves the public folder at the site root.',
        );
      } else if (/^https?:\/\//i.test(value)) {
        report(
          file,
          i,
          'external-url',
          value,
          'Content images must be downloaded to /public/assets/ and verified via image_qa. Reference as `/assets/filename` — never an external URL.',
        );
      }
    }
  }

  // Pass 2: any `url(...)` reference in the file. This covers CSS bg-images
  // in Tailwind arbitrary values, JSX inline styles, and `.css` files. We
  // only flag external `http(s)://` here — local `/assets/...` refs and
  // data: URIs (inline SVG textures) are intentional and pass through.
  for (let i = 0; i < lines.length; i++) {
    CSS_URL_RE.lastIndex = 0;
    let match;
    while ((match = CSS_URL_RE.exec(lines[i])) !== null) {
      const value = match[1];
      if (!value) continue;
      if (!/^https?:\/\//i.test(value)) continue;
      report(
        file,
        i,
        'external-css-url',
        value,
        'CSS `url(...)` must reference a local `/assets/<file>` (downloaded + verified via image_qa) or be replaced by inline SVG / a CSS gradient. External URLs commonly 404 at runtime — never embed `https://*.vercel.app/noise.svg` or similar one-off CDN textures.',
      );
    }
  }
}

if (errors.length === 0) {
  process.exit(0);
}

// Human-readable lines first (coder reads stderr/stdout as prose), JSON last
// for any tooling that wants to parse it.
const grouped = new Map();
for (const e of errors) {
  const key = e.kind;
  if (!grouped.has(key)) grouped.set(key, []);
  grouped.get(key).push(e);
}

const KIND_TITLE = {
  'public-prefix': 'Wrong path: `/public/...` in JSX src (use `/assets/...`)',
  'external-url': 'External image URL in JSX src (use local `/assets/...`)',
  'external-css-url': 'External URL in CSS `url(...)` — Tailwind bg, inline style, or .css',
};

console.error(`Static image check failed (${errors.length} error(s)):\n`);
for (const [kind, group] of grouped.entries()) {
  console.error(`  ${KIND_TITLE[kind] ?? kind} — ${group.length} occurrence(s)`);
  console.error(`    hint: ${group[0].hint}`);
  for (const e of group.slice(0, 10)) {
    console.error(`    - ${e.file}:${e.line}  src=${JSON.stringify(e.value)}`);
  }
  if (group.length > 10) console.error(`    ... (+${group.length - 10} more)`);
  console.error('');
}

console.error(JSON.stringify({ success: false, errors }, null, 2));
process.exit(1);
