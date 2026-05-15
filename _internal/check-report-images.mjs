#!/usr/bin/env node
// Static image-reference lint for src/reports/*.md.
//
// Image-path protocol (two surfaces, two forms):
//   - `.md` (here, seeker)  → filesystem-form `/public/assets/<file>` so the
//                              raw .md previews correctly in any markdown
//                              viewer (project root acts as web root).
//   - `.tsx` (coder)        → Vite URL-form `/assets/<file>` because Vite
//                              serves the public/ folder at the site root.
// The bridge stores .md image src verbatim; the coder never bridges image
// blocks and always retypes with <ZoomableImage src="/assets/..." />. The
// JSX-side lint (scripts/check-static-images.mjs) is the mirror of this one.
//
// Bugs caught by this file:
//
//   1. Bare `/assets/...` in markdown — missing `/public` prefix; the .md
//      won't render in standalone markdown previews. Fix: `/public${src}`.
//   2. External `http(s)://` URLs — content images must live under
//      `public/assets/` (registered via image_qa). External URLs bypass
//      registry checks and frequently 404 / get rate-limited at runtime.
//   3. Missing files — a `/public/assets/foo.jpg` reference with no matching
//      file under `<workspace>/public/assets/` will 404 when retyped in JSX.
//
// Used by:
//   - `pnpm run check:report-images` (CLI; wired into build:check) — fails
//     fast before npm_build, surfaces issues without booting Chromium.
//   - `build-report-bridge.mjs` `validateParsedReport` (in --strict mode) —
//     so the seeker's `task_done` guard rejects broken images and asks copies
//     to fix them, instead of letting the bug slide downstream to the coder.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_TEMPLATE_ROOT = path.resolve(__dirname, '..');

// Match every markdown image reference `![alt](src)`. We scan the raw .md
// text — image refs nested inside lists / paragraphs / standalone lines all
// need to be checked uniformly.
const IMG_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

/**
 * Validate every image reference in a markdown source string.
 *
 * @param {string} reportName — bare name like "p1_popmart" (no `.md`).
 * @param {string} source — full file contents.
 * @param {{ templateRoot?: string }} opts
 * @returns {string[]} human-readable issues, one per offending ref. Empty when clean.
 */
export function validateReportImageSource(reportName, source, { templateRoot = DEFAULT_TEMPLATE_ROOT } = {}) {
  const issues = [];
  IMG_RE.lastIndex = 0;
  let match;
  while ((match = IMG_RE.exec(source)) !== null) {
    const src = match[2];
    if (!src) continue;

    if (/^https?:\/\//i.test(src)) {
      issues.push(
        `${reportName}: image src "${src}" is an external URL — download to public/assets/ ` +
        `via the image_qa-verified pipeline and reference as /public/assets/<file> in markdown`,
      );
      continue;
    }
    if (src.startsWith('/public/')) {
      // Correct form. Verify the file exists on disk so the coder can find it.
      const onDisk = path.resolve(templateRoot, '.' + src);
      if (!fs.existsSync(onDisk)) {
        issues.push(
          `${reportName}: image src "${src}" not found on disk (looked at ${path.relative(templateRoot, onDisk)}) — ` +
          `download must complete before embedding, and the URL must match the saved filename`,
        );
      }
      continue;
    }
    if (src.startsWith('/assets/')) {
      // Bare site-root form — that's the coder's JSX form, not the .md form.
      // Tell the seeker how to rewrite, and remind them the protocol keeps
      // both forms aligned.
      issues.push(
        `${reportName}: image src "${src}" is missing the /public prefix — markdown uses filesystem-form, ` +
        `write "/public${src}" instead. (Coders retype with <ZoomableImage src="${src}" />; the protocol ` +
        `keeps .md filesystem-form and JSX URL-form aligned around the same filename.)`,
      );
      continue;
    }
    if (src.startsWith('/')) {
      // Some other absolute path — definitely not under public/.
      issues.push(
        `${reportName}: image src "${src}" is not under /public/assets/ — content images must be downloaded ` +
        `to public/assets/ via image_qa and referenced as /public/assets/<file> in markdown`,
      );
      continue;
    }
    // Relative paths (e.g. "./foo.jpg", "../assets/x.jpg") are not supported
    // by the report bridge — flag so the seeker rewrites to /public/assets/<file>.
    issues.push(
      `${reportName}: image src "${src}" is a relative path — use markdown filesystem-form "/public/assets/<file>" instead`,
    );
  }
  return issues;
}

/**
 * Walk every src/reports/*.md and validate image refs.
 *
 * @param {{ templateRoot?: string }} opts
 * @returns {string[]} all issues across all reports, prefixed with the report name.
 */
export function validateAllReportImages({ templateRoot = DEFAULT_TEMPLATE_ROOT } = {}) {
  const reportsDir = path.resolve(templateRoot, 'src/reports');
  if (!fs.existsSync(reportsDir)) return [];
  const all = [];
  for (const f of fs.readdirSync(reportsDir)) {
    if (!f.endsWith('.md')) continue;
    const source = fs.readFileSync(path.join(reportsDir, f), 'utf8');
    const issues = validateReportImageSource(f.replace(/\.md$/, ''), source, { templateRoot });
    all.push(...issues);
  }
  return all;
}

// CLI: `node _internal/check-report-images.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  const issues = validateAllReportImages();
  if (issues.length === 0) {
    console.log('[check-report-images] OK — no broken image refs in src/reports/*.md');
    process.exit(0);
  }
  console.error(`[check-report-images] ${issues.length} issue(s):`);
  for (const line of issues) console.error(`  - ${line}`);
  process.exit(1);
}
