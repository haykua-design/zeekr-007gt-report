// --- Registry hint helpers --------------------------------------------------
// When a coder uses a wrong/typo image path or an unregistered local asset,
// the error should answer "what *is* available?" — not just "what's wrong".
// We surface the closest registry entries by edit distance plus their human
// description and first QA Q/A pair so the agent can decide whether one of
// them is the right substitute. Format mirrors the byId.ts "Available …"
// pattern.

function editDistance(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

export function buildRegistryHints(brokenPath, registry, k = 3) {
  if (!registry || typeof registry !== 'object') return [];
  const keys = Object.keys(registry);
  if (keys.length === 0) return [];
  const target = String(brokenPath || '');
  const scored = keys.map((key) => ({ key, d: editDistance(target, key) }));
  scored.sort((a, b) => a.d - b.d);
  return scored.slice(0, k).map(({ key }) => {
    const entry = registry[key] || {};
    const history = entry.qa_history || [];
    const firstQa = history[0] || null;
    return {
      path: key,
      width: entry.width,
      height: entry.height,
      description: typeof entry.description === 'string' ? entry.description : '',
      qaPreview: firstQa
        ? {
            q: String(firstQa.q || '').replace(/\s+/g, ' ').slice(0, 80),
            a: String(firstQa.a || '').replace(/\s+/g, ' ').slice(0, 120),
          }
        : null,
    };
  });
}

function formatRegistryHints(hints) {
  if (!hints || hints.length === 0) return '';
  const lines = ['', 'Verified images in registry — closest matches first:'];
  for (const h of hints) {
    const dim = h.width && h.height ? ` (${h.width}×${h.height})` : '';
    const desc = h.description ? ` — ${h.description.slice(0, 120)}` : '';
    lines.push(`  ${h.path}${dim}${desc}`);
    if (h.qaPreview) {
      lines.push(`    Q: ${h.qaPreview.q}`);
      lines.push(`    A: ${h.qaPreview.a}`);
    }
  }
  return lines.join('\n');
}

export async function loadImageRegistry(projectRoot) {
  try {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const registryPath = resolve(projectRoot, '_internal', 'image_registry.json');
    return JSON.parse(readFileSync(registryPath, 'utf-8'));
  } catch {
    return {};
  }
}

function isImageContentType(headerValue) {
  const contentType = (headerValue || '').trim().toLowerCase();
  return contentType.startsWith('image/');
}

function buildSourceLocation(source) {
  if (!source || !source.fileName) return '';
  const normalizedPath = source.fileName.replace(/\\/g, '/');
  const shortFile = normalizedPath.split('/src/').pop() || source.fileName;
  return ` [at src/${shortFile}:${source.lineNumber}]`;
}

function buildRoutesLabel(routes) {
  if (!Array.isArray(routes) || routes.length === 0) return '';
  const urls = routes
    .map((entry) => (entry && entry.routeUrl ? entry.routeUrl : ''))
    .filter(Boolean);
  const unique = [...new Set(urls)];
  if (unique.length === 0) return '';
  const shown = unique.slice(0, 3);
  const suffix = unique.length > shown.length ? ` (+${unique.length - shown.length} more)` : '';
  return ` [page: ${shown.join(', ')}${suffix}]`;
}

function isWrongPublicPath(imagePath) {
  return typeof imagePath === 'string' && imagePath.includes('/public/');
}

function pushInvalidImageError({ reporter, path, data, fullUrl, reason, registry }) {
  const locationInfo = buildSourceLocation(data.source);
  const routeInfo = buildRoutesLabel(data.routes);
  const hint = path.includes('/public/')
    ? 'Use `/assets/filename` in img src, not `/public/assets/...`. Vite serves the public folder at the site root.'
    : 'Ensure the file exists under `public/assets` of the workspace.';

  const candidates = buildRegistryHints(path, registry || {});
  const candidateText = formatRegistryHints(candidates);

  reporter.pushError({
    type: 'invalid-image',
    text: `Image not found (${reason}): ${path}${routeInfo}${locationInfo}` + candidateText,
    path,
    url: fullUrl,
    routes: data.routes,
    hint,
    candidates,
  });
}

export function mergeImageSources(allImageSrcs, pageInfo, routeInfo) {
  if (!pageInfo || !Array.isArray(pageInfo.imageSrcs) || pageInfo.imageSrcs.length === 0) {
    return;
  }

  pageInfo.imageSrcs.forEach((item) => {
    if (!item || !item.path) return;

    const alt = typeof item.alt === 'string' ? item.alt.trim() : '';

    if (!allImageSrcs.has(item.path)) {
      allImageSrcs.set(item.path, {
        source: item.source || null,
        routes: [{ route: routeInfo.route, routeUrl: routeInfo.url, alt }],
        // Set of distinct non-empty alts seen for this image across all pages.
        // Used by validateImageDuplicateSubjects to detect one registered image
        // being reused for semantically distinct subjects.
        alts: alt ? new Set([alt]) : new Set(),
        isExternal: item.isExternal || false,
        isDecorative: item.isDecorative || false,
      });
      return;
    }

    const existing = allImageSrcs.get(item.path);
    if (existing) {
      if (Array.isArray(existing.routes)) {
        existing.routes.push({ route: routeInfo.route, routeUrl: routeInfo.url, alt });
      }
      if (existing.alts && alt) existing.alts.add(alt);
      if (!existing.source && item.source) existing.source = item.source;
      // Decorative status stays "false" if any occurrence is non-decorative —
      // a single informative use makes the image subject-bearing.
      if (existing.isDecorative && !item.isDecorative) existing.isDecorative = false;
    }
  });
}

export async function validateCollectedImages({ page, baseUrl, allImageSrcs, reporter, registry }) {
  if (!allImageSrcs || allImageSrcs.size === 0) return;

  const noCacheHeaders = { 'Cache-Control': 'no-cache', Pragma: 'no-cache' };
  const entries = Array.from(allImageSrcs.entries());
  const maxConcurrency = Math.min(8, entries.length);
  let index = 0;

  async function validateSingle(path, data) {
    const fullUrl = path.startsWith('http') ? path : `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

    if (isWrongPublicPath(path)) {
      pushInvalidImageError({ reporter, path, data, fullUrl, reason: 'wrong path (use /assets/... not /public/assets/... in Vite)', registry });
      return;
    }

    let resolved = false;
    for (let attempt = 0; attempt < 2 && !resolved; attempt += 1) {
      const isRetry = attempt === 1;
      const requestUrl = isRetry ? `${fullUrl}?t=${Date.now()}` : fullUrl;

      let response;
      try {
        response = await page.request.fetch(requestUrl, {
          method: 'GET',
          headers: noCacheHeaders,
          timeout: 10000,
        });
      } catch {
        if (isRetry) {
          pushInvalidImageError({ reporter, path, data, fullUrl, reason: 'request failed after retry', registry });
          resolved = true;
        }
        continue;
      }

      const status = response.status();
      const contentType = (response.headers()['content-type'] || '').trim().toLowerCase();

      if (status === 200) {
        if (contentType.includes('text/html') && !path.endsWith('.html')) {
          pushInvalidImageError({ reporter, path, data, fullUrl, reason: 'SPA fallback', registry });
          resolved = true;
          break;
        }
        if (!isImageContentType(contentType)) {
          pushInvalidImageError({ reporter, path, data, fullUrl, reason: 'not image content', registry });
          resolved = true;
          break;
        }
        resolved = true;
        break;
      }

      if (status === 404) {
        pushInvalidImageError({ reporter, path, data, fullUrl, reason: '404', registry });
        resolved = true;
        break;
      }

      if (status === 304) {
        if (isRetry) {
          pushInvalidImageError({ reporter, path, data, fullUrl, reason: '304 again', registry });
          resolved = true;
          break;
        }
        continue;
      }
    }
  }

  async function worker() {
    while (true) {
      const current = index;
      index += 1;
      if (current >= entries.length) return;
      const [path, data] = entries[current];
      await validateSingle(path, data);
    }
  }

  await Promise.all(Array.from({ length: maxConcurrency }, () => worker()));
}

/**
 * Validate images against the image registry.
 *
 * - External URLs (http/https) in content images → error (must be local assets).
 * - Local images not in the registry → error (must be verified by image_qa).
 * - Decorative images (role="presentation" or empty alt) are exempt.
 * - If the registry file doesn't exist, skip the check gracefully.
 */
export async function validateImageRegistry({ projectRoot, allImageSrcs, reporter, skipReverseCheck = false }) {
  if (!allImageSrcs || allImageSrcs.size === 0) return;

  // Read the registry from the filesystem (_internal/ is a system-managed directory).
  // Fail-closed: a missing or unreadable registry means *no* image has been
  // verified by image_qa, so every non-decorative local image is unregistered.
  // Treating "file absent" as "skip the check" would let unverified images
  // silently ship — that's the bug this block guards against.
  const registry = await loadImageRegistry(projectRoot);

  for (const [path, data] of allImageSrcs.entries()) {
    if (data.isDecorative) continue;

    const locationInfo = buildSourceLocation(data.source);
    const routeInfo = buildRoutesLabel(data.routes);

    // Reject external URLs — all content images must be local verified assets.
    if (data.isExternal) {
      reporter.pushError({
        type: 'external-image',
        text: `External image URL in content: ${path}${routeInfo}${locationInfo}`,
        path,
        routes: data.routes,
        hint: 'Content images must be downloaded to /public/assets/ and verified with image_qa. Use /assets/filename in src, not external URLs.',
      });
      continue;
    }

    // Skip icons directory (decorative/utility assets).
    if (path.startsWith('/assets/icons/')) continue;

    // Cross-check against registry. Missing registry → registry === {} → every
    // image falls through to the "unregistered" error below (fail-closed).
    if (!registry[path] || registry[path].qa_status !== 'pass') {
      const candidates = buildRegistryHints(path, registry);
      const candidateText = formatRegistryHints(candidates);
      reporter.pushError({
        type: 'unregistered-image',
        text: `Image not in registry (not verified by image_qa): ${path}${routeInfo}${locationInfo}` + candidateText,
        path,
        routes: data.routes,
        hint: 'Reason: this image path is not in _internal/image_registry.json (the registry of image_qa-verified assets). To register it, call the image_qa tool on the file (e.g. image_qa(file_paths=["<path under /public>"], prompts=["describe the image and confirm it shows X"])) — a passing QA run automatically writes the entry into the registry. Alternatively, swap the <img src> to one of the suggested verified paths above, or remove the image if it is not needed.',
        candidates,
      });
    }
  }

  // Reverse check: warn about registered images that are never used on any page.
  // This is a project-scope check (needs the union of all page images);
  // page_check callers pass skipReverseCheck=true to disable.
  if (!skipReverseCheck) {
    const usedPaths = new Set(allImageSrcs.keys());
    const orphaned = Object.keys(registry).filter((key) => !usedPaths.has(key));
    if (orphaned.length > 0) {
      reporter.pushWarning({
        type: 'unused-registry-images',
        text: `${orphaned.length} verified image(s) available but not used on any page: ${orphaned.slice(0, 5).join(', ')}${orphaned.length > 5 ? ` (+${orphaned.length - 5} more)` : ''}`,
        count: orphaned.length,
        paths: orphaned.slice(0, 20),
        hint: 'These images were verified by image_qa and may contain useful content. Check /image_registry.md to see their descriptions — consider whether any should be included in the page.',
      });
    }
  }
}

/**
 * Detect a registered image being reused for semantically distinct subjects.
 *
 * Motivation: `validateImageRegistry` only checks URL ∈ registry; it passes
 * when a coder fills a data literal like
 *   { name: "Avatar", image: "/assets/nezha2_poster.jpg" }
 * because the URL is valid. Multiple non-empty *distinct* alt texts for the
 * same image URL is the canonical signal that one registered image is being
 * used as a placeholder for several different subjects.
 *
 * - Skips decorative and icon-directory images.
 * - Skips external URLs (those already error via validateImageRegistry).
 * - Threshold: ≥2 distinct non-empty alts → error.
 */
export function validateImageDuplicateSubjects({ allImageSrcs, reporter }) {
  if (!allImageSrcs || allImageSrcs.size === 0) return;

  for (const [path, data] of allImageSrcs.entries()) {
    if (data.isDecorative || data.isExternal) continue;
    if (path.startsWith('/assets/icons/')) continue;
    if (!data.alts || data.alts.size < 2) continue;

    const distinctAlts = [...data.alts];
    const locationInfo = buildSourceLocation(data.source);
    const routeInfo = buildRoutesLabel(data.routes);
    const altPreview = distinctAlts.slice(0, 4).map((a) => `"${a}"`).join(', ');
    const more = distinctAlts.length > 4 ? ` (+${distinctAlts.length - 4} more)` : '';

    reporter.pushError({
      type: 'duplicate-image-subjects',
      text: `Registered image reused for ${distinctAlts.length} distinct subjects: ${path} — alts: ${altPreview}${more}${routeInfo}${locationInfo}`,
      path,
      alts: distinctAlts,
      routes: data.routes,
      hint: 'One image file depicts one subject. If multiple list/grid items share the same image URL with different alts/names, one of them is wrong. Run search_images → download → image_qa to acquire the correct image for each subject, or omit the image field when unavailable — never reuse a neighbor\'s image as a placeholder.',
    });
  }
}

export function buildLinkDetails(invalidLinks) {
  return invalidLinks.slice(0, 10).map((link) => {
    let locationInfo = '';
    if (link.source && link.source.fileName) {
      const normalizedPath = link.source.fileName.replace(/\\/g, '/');
      const shortFile = normalizedPath.split('/src/').pop() || link.source.fileName;
      locationInfo = ` [at src/${shortFile}:${link.source.lineNumber}]`;
    }

    return {
      href: link.href,
      path: link.pathForRoute ?? link.normalizedPath,
      text: `${link.text}${locationInfo}`,
    };
  });
}
