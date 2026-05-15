// Browser console checker script using Playwright.
// Usage:
//   node _internal/check-browser.mjs <preview_url> [--single-route /path]
//
// --single-route: scope the audit to a single route. Skips route discovery,
// cross-page link-target validation, image-registry reverse check, duplicate-
// subjects check, and coverage-truncation. Per-page audits (placeholder,
// link collection, image fetch + forward registry, contrast, overflow,
// text-fidelity) still run. Used by the page_check tool so a copy agent can
// validate its own page without seeing or depending on sibling pages.

import { runBrowserCheck } from './browser-check/run-browser-check.mjs';

function parseArgs(argv) {
  const args = { previewUrl: null, singleRoute: null };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--single-route') {
      args.singleRoute = argv[i + 1] || null;
      i += 1;
    } else if (a.startsWith('--single-route=')) {
      args.singleRoute = a.slice('--single-route='.length);
    } else {
      rest.push(a);
    }
  }
  args.previewUrl = rest[0] || null;
  return args;
}

async function main() {
  const { previewUrl, singleRoute } = parseArgs(process.argv.slice(2));

  if (!previewUrl) {
    console.error('Usage: node _internal/check-browser.mjs <preview_url> [--single-route /path]');
    process.exit(1);
  }

  const { result, exitCode } = await runBrowserCheck(previewUrl, { singleRoute });

  if (result.success && (!result.errors || result.errors.length === 0)) {
    console.log(JSON.stringify(result));
  } else {
    console.error(JSON.stringify(result));
  }

  process.exit(exitCode);
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      success: false,
      fatal: true,
      error: String(error && error.message ? error.message : error),
    }),
  );
  process.exit(1);
});
