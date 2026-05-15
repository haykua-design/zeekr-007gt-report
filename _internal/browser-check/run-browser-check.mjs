import { chromium } from 'playwright';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { installUnhandledRejectionBridge, registerPageCollectors } from './collectors.mjs';
import { buildRuntimeConfig } from './options.mjs';
import { collectPageInfo } from './page-audit.mjs';
import { createReporter } from './reporter.mjs';
import {
  buildRouteTargets,
  collectDiscoveredTargets,
  createKnownRouteSet,
  createVisitQueue,
  detectHashRouter,
  readAppRoutes,
  routeInfoFromTarget,
} from './route-discovery.mjs';
import { canonicalVisitKey, normalizeRoutePath, routeFromAbsoluteUrl } from './url-utils.mjs';
import { buildLinkDetails, loadImageRegistry, mergeImageSources, validateCollectedImages, validateImageDuplicateSubjects, validateImageRegistry } from './validators.mjs';
import { validateTextFidelity } from './text-fidelity.mjs';
import { inferContrastFix, inferOverflowFix } from './audit-recipes.mjs';

const NETWORK_IDLE_TIMEOUT_MS = 12000;
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(MODULE_DIR, '..', '..');

function pageContextFallback(page, previewUrl) {
  const url = page && typeof page.url === 'function' ? page.url() : '';
  const currentUrl = url || previewUrl;
  return {
    route: routeFromAbsoluteUrl(currentUrl),
    url: currentUrl,
    pageId: 'page_unknown',
    contextType: 'unknown',
    sourceUrl: currentUrl,
  };
}

export async function runBrowserCheck(previewUrl, { env = process.env, singleRoute = null } = {}) {
  const config = buildRuntimeConfig(previewUrl, env);
  const reporter = createReporter({ dedupeMode: config.dedupeMode, projectRoot: PROJECT_ROOT });
  const startTime = Date.now();

  // Page-scoped mode: visit one route only, skip route discovery + cross-page
  // aggregation (reverse registry, duplicate-subjects, coverage-truncation,
  // cross-page invalid-link). Per-page audits (placeholder, contrast, overflow,
  // text-fidelity, image fetch, forward registry lookup) still run.
  const normalizedSingleRoute = singleRoute ? normalizeRoutePath(String(singleRoute)) : null;
  const isSingleRouteMode = Boolean(normalizedSingleRoute);

  const baseUrl = previewUrl.replace(/#.*$/, '').replace(/\/$/, '');
  const allImageSrcs = new Map();
  const visibleTextSamples = [];
  const pageSamples = [];

  const pageState = new WeakMap();
  const attachedPages = new WeakSet();
  let pageSeq = 0;
  const ignoredByPolicy = {
    count: 0,
    samples: [],
  };
  const routeSeedSummary = {
    appRoutes: 0,
    fileRoutes: 0,
    mergedRoutes: 0,
  };

  // Prefer the task-level shared browser (see docs/rfcs/browser-pool) to
  // avoid paying Chromium launch cost on every browser check. Fall back to a
  // fresh launch so this script stays runnable standalone.
  const wsEndpoint = process.env.PLAYWRIGHT_WS_ENDPOINT;
  const browser = wsEndpoint
    ? await chromium.connect(wsEndpoint)
    : await chromium.launch(config.launchOptions);
  const contextOptions = {};
  if (config.ignoreHTTPSErrors) {
    contextOptions.ignoreHTTPSErrors = true;
  }
  const context = await browser.newContext(contextOptions);

  const getPageContext = (page) => {
    if (!page || !pageState.has(page)) {
      return pageContextFallback(page, previewUrl);
    }
    return pageState.get(page);
  };

  const setPageContext = (page, patch) => {
    const current = getPageContext(page);
    const next = {
      ...current,
      ...patch,
    };
    if (next.url && !next.route) {
      next.route = routeFromAbsoluteUrl(next.url);
    }
    if (!next.sourceUrl) {
      next.sourceUrl = next.url;
    }
    pageState.set(page, next);
  };

  const setPageUrl = (page, nextUrl) => {
    if (!page) return;
    setPageContext(page, {
      url: nextUrl,
      sourceUrl: nextUrl,
      route: routeFromAbsoluteUrl(nextUrl),
    });
  };

  const recordIgnoredIssue = (payload) => {
    ignoredByPolicy.count += 1;
    if (ignoredByPolicy.samples.length < 20) {
      ignoredByPolicy.samples.push(payload);
    }
  };

  const registerPage = (page, contextType = 'page') => {
    if (!page) return;
    if (attachedPages.has(page)) {
      if (contextType === 'primary') {
        setPageContext(page, { contextType: 'primary' });
      }
      return;
    }
    attachedPages.add(page);

    pageSeq += 1;
    const initialUrl = (typeof page.url === 'function' ? page.url() : '') || previewUrl;
    setPageContext(page, {
      pageId: `page_${pageSeq}`,
      contextType,
      url: initialUrl,
      route: routeFromAbsoluteUrl(initialUrl),
      sourceUrl: initialUrl,
    });

    reporter.stats.contextsObserved += 1;

    registerPageCollectors(page, {
      reporter,
      getPageContext,
      setPageUrl,
      registerPage: config.enableContextCoverage ? registerPage : () => {},
      onPopup: () => {
        if (config.enableContextCoverage) {
          reporter.stats.popupsObserved += 1;
        }
      },
      onWorker: () => {
        if (config.enableContextCoverage) {
          reporter.stats.workersObserved += 1;
        }
      },
      policy: config.policy,
      onIgnoredIssue: recordIgnoredIssue,
    });
  };

  await installUnhandledRejectionBridge(context, {
    reporter,
    getPageContext,
  });

  if (config.enableContextCoverage) {
    context.on('page', (page) => {
      registerPage(page, 'context-page');
    });
  }

  const page = await context.newPage();
  registerPage(page, 'primary');

  const queue = createVisitQueue({ maxPages: config.maxPages });
  const discoveredKeys = new Set();

  const enqueueTarget = (targetUrl) => {
    const key = canonicalVisitKey(targetUrl);
    if (!key || discoveredKeys.has(key)) return false;

    const enqueued = queue.enqueue(targetUrl);
    if (!enqueued.added) return false;

    discoveredKeys.add(key);
    reporter.stats.pagesDiscovered = discoveredKeys.size;
    return true;
  };

  let routes = ['/'];
  let knownRouteSet = createKnownRouteSet(['/']);

  try {
    setPageContext(page, {
      route: 'initial',
      url: previewUrl,
      sourceUrl: previewUrl,
    });

    try {
      await page.goto(previewUrl, { waitUntil: 'load', timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_TIMEOUT_MS }).catch(() => {
        // ignore network idle timeout
      });
    } catch (error) {
      const errorMessage = String(error && error.message ? error.message : error);
      let diagnosticInfo = '';

      if (previewUrl.includes('127.0.0.1') || previewUrl.includes('localhost')) {
        if (errorMessage.includes('ERR_CONNECTION_REFUSED')) {
          diagnosticInfo = ' (Ensure the dev server is running at this URL, e.g. run start_dev first.)';
        } else if (
          errorMessage.includes('ERR_PROXY') ||
          errorMessage.includes('ERR_CONNECTION') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('504')
        ) {
          diagnosticInfo =
            ' (Possible proxy issue - localhost requests should bypass proxy. Check NO_PROXY includes localhost and 127.0.0.1.)';
        }
      }

      reporter.pushError({
        type: 'navigation-error',
        text: `Failed to load page: ${errorMessage}${diagnosticInfo}`,
        url: previewUrl,
        route: 'initial',
        routeUrl: previewUrl,
      });
    }

    await page.waitForTimeout(config.postNavigationDelayMs);

    if (isSingleRouteMode) {
      // Page-scoped: only the requested route is in scope. Treat it as the
      // sole known route so per-page link validation doesn't false-positive on
      // hrefs to sibling pages the copy doesn't own.
      routes = [normalizedSingleRoute];
      routeSeedSummary.appRoutes = 0;
      routeSeedSummary.fileRoutes = 0;
      routeSeedSummary.mergedRoutes = 1;
      knownRouteSet = createKnownRouteSet(routes);
      const target = `${baseUrl}${normalizedSingleRoute === '/' ? '/' : normalizedSingleRoute}`;
      enqueueTarget(target);
    } else {
      try {
        routes = await readAppRoutes(page);
      } catch {
        routes = ['/'];
      }
      routeSeedSummary.appRoutes = Array.isArray(routes) ? routes.length : 0;

      const mergedRoutes = [];
      const seenRoutes = new Set();
      (Array.isArray(routes) ? routes : []).forEach((rawRoute) => {
        const routeText = String(rawRoute || '').trim();
        if (!routeText) return;
        const normalizedRoute = normalizeRoutePath(routeText);
        if (seenRoutes.has(normalizedRoute)) return;
        seenRoutes.add(normalizedRoute);
        mergedRoutes.push(normalizedRoute);
      });
      if (mergedRoutes.length === 0) {
        mergedRoutes.push('/');
      }
      routes = mergedRoutes;
      routeSeedSummary.fileRoutes = 0;
      routeSeedSummary.mergedRoutes = routes.length;

      const isHashRouter = detectHashRouter(routes);
      knownRouteSet = createKnownRouteSet(routes);

      enqueueTarget(previewUrl);
      const seedTargets = buildRouteTargets({
        baseUrl,
        routes,
        isHashRouter,
      });
      seedTargets.forEach((entry) => enqueueTarget(entry.targetUrl));
    }

    while (queue.hasNext()) {
      const next = queue.next();
      if (!next) break;

      const targetUrl = next.targetUrl;
      const routeInfo = routeInfoFromTarget(targetUrl);

      setPageContext(page, {
        route: routeInfo.route,
        url: targetUrl,
        sourceUrl: targetUrl,
      });

      reporter.stats.pagesVisited += 1;
      reporter.stats.routesChecked += 1;

      try {
        await page.goto(targetUrl, {
          waitUntil: 'load',
          timeout: config.routeTimeout,
        });

        await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_TIMEOUT_MS }).catch(() => {
          // ignore network idle timeout
        });

        await page.waitForTimeout(config.postNavigationDelayMs);
      } catch (error) {
        reporter.pushError({
          type: 'navigation-error',
          text: `Failed to load route ${routeInfo.route}: ${String(error && error.message ? error.message : error)}`,
          route: routeInfo.route,
          routeUrl: routeInfo.url,
          pageId: getPageContext(page).pageId,
          contextType: getPageContext(page).contextType,
          sourceUrl: getPageContext(page).sourceUrl,
        });
        continue;
      }

      const pageInfo = await collectPageInfo(page, {
        enablePlaceholderCheck: config.enablePlaceholderCheck,
        enableLinkCheck: config.enableLinkCheck,
        enableImageCheck: config.enableImageCheck,
        enableContrastCheck: config.enableContrastCheck,
        contrastMinRatio: config.contrastMinRatio,
        enableTextFidelityCheck: config.enableTextFidelityCheck,
        enableOverflowCheck: config.enableOverflowCheck,
        overflowTolerancePx: config.overflowTolerancePx,
      });

      if (config.enableTextFidelityCheck && pageInfo.visibleText) {
        visibleTextSamples.push(pageInfo.visibleText);
        pageSamples.push({ route: routeInfo.route, visibleText: pageInfo.visibleText });
      }

      if (pageInfo.hasViteError) {
        const overlayText = pageInfo.viteErrorContent || '';
        reporter.pushError({
          type: 'runtime-error',
          text: overlayText
            ? `Vite error overlay on route ${routeInfo.route}:\n${overlayText}`
            : `Detected Vite Error Overlay or ReferenceError on route ${routeInfo.route}. The page content might be broken.`,
          viteErrorContent: overlayText || undefined,
          route: routeInfo.route,
          routeUrl: routeInfo.url,
          pageId: getPageContext(page).pageId,
          contextType: getPageContext(page).contextType,
          sourceUrl: getPageContext(page).sourceUrl,
        });
      }

      if (config.enablePlaceholderCheck && pageInfo.placeholders.length > 0) {
        const message = `Found ${pageInfo.placeholders.length} TODO/placeholder marker(s) on route ${routeInfo.route}. Replace with real functionality and remove [DDLive-TODO: ...] (legacy: [DDT-PLACEHOLDER: ...]) before build.`;

        reporter.pushWarning({
          type: 'dom-placeholder',
          route: routeInfo.route,
          routeUrl: routeInfo.url,
          count: pageInfo.placeholders.length,
          matches: pageInfo.placeholders.slice(0, 10),
          message,
          text: message,
        });

        reporter.pushError({
          type: 'placeholder-left',
          text: message,
          route: routeInfo.route,
          routeUrl: routeInfo.url,
          count: pageInfo.placeholders.length,
          matches: pageInfo.placeholders.slice(0, 10),
        });
      }

      if (pageInfo.rawFormulas && pageInfo.rawFormulas.length > 0) {
        const message = `Found ${pageInfo.rawFormulas.length} raw LaTeX formula(s) on route ${routeInfo.route} (e.g. $...$ or $$...$$). Wrap in <DdlFormula> or <DdlFormulaBlock> for proper rendering.`;

        reporter.pushWarning({
          type: 'raw-formula',
          text: message,
          route: routeInfo.route,
          routeUrl: routeInfo.url,
          count: pageInfo.rawFormulas.length,
          matches: pageInfo.rawFormulas.slice(0, 10),
        });
      }

      if (pageInfo.invalidFormulas && pageInfo.invalidFormulas.length > 0) {
        reporter.pushError({
          type: 'invalid-formula-script',
          text: `Found ${pageInfo.invalidFormulas.length} formula(s) with non-Latin characters on route ${routeInfo.route}. Use English variable names and move natural language outside the formula.`,
          route: routeInfo.route,
          routeUrl: routeInfo.url,
          count: pageInfo.invalidFormulas.length,
          matches: pageInfo.invalidFormulas.slice(0, 10),
        });
      }

      if (pageInfo.formulaErrors && pageInfo.formulaErrors.length > 0) {
        reporter.pushError({
          type: 'katex-formula-error',
          text: `Found ${pageInfo.formulaErrors.length} formula(s) that KaTeX failed to render on route ${routeInfo.route}. Fix the LaTeX so the formula renders correctly.`,
          route: routeInfo.route,
          routeUrl: routeInfo.url,
          count: pageInfo.formulaErrors.length,
          matches: pageInfo.formulaErrors.slice(0, 10),
        });
      }

      if (config.enableOverflowCheck && pageInfo.overflows && pageInfo.overflows.length > 0) {
        // Tag each match with a per-entry inferred fix; surface a compact
        // preview in the error text so the agent doesn't have to dig.
        const tagged = pageInfo.overflows.map((m) => ({ ...m, fix: inferOverflowFix(m) }));
        const previewLines = tagged.slice(0, 5).map((m) => {
          const where = m.source
            ? `${m.source.fileName.split('/src/').pop()}:${m.source.lineNumber}`
            : m.domPath || m.tag;
          const why = m.fix || 'no specific signal — see generic fixes below.';
          return `  • ${where} (${m.axis}-axis, ${m.ratioPct}% bleed): ${why}`;
        });
        reporter.pushError({
          type: 'text-overflow',
          text:
            `Found ${pageInfo.overflows.length} text node(s) on route ${routeInfo.route} that paint ` +
            `≥10% outside their nearest clipping container — text overlaps neighbouring content.\n` +
            `Per-entry fix (top ${Math.min(5, tagged.length)}):\n` +
            previewLines.join('\n') +
            `\nGeneric fallbacks: (a) \`min-w-0\` on flex/grid children, ` +
            `(b) \`break-words\` / \`overflow-wrap: anywhere\` for long tokens, ` +
            `(c) \`overflow-x-auto\` on tables, ` +
            `(d) replace fixed heights with \`min-h\`. ` +
            `Bridge content size is unknown at design time — prefer flexible containers over fixed dimensions.\n` +
            `Env: DDT_CHECK_OVERFLOW=false to disable, DDT_OVERFLOW_TOLERANCE_PX=<n> to raise the px floor.`,
          route: routeInfo.route,
          routeUrl: routeInfo.url,
          count: pageInfo.overflows.length,
          matches: tagged,
        });
      }

      if (config.enableOverflowCheck && pageInfo.overflowWarnings && pageInfo.overflowWarnings.length > 0) {
        reporter.pushWarning({
          type: 'text-overflow-soft',
          text:
            `Found ${pageInfo.overflowWarnings.length} text node(s) on route ${routeInfo.route} that paint ` +
            `slightly outside their container (<10%). Tolerated; consider tightening if visible.`,
          route: routeInfo.route,
          routeUrl: routeInfo.url,
          count: pageInfo.overflowWarnings.length,
          matches: pageInfo.overflowWarnings.slice(0, 10),
        });
      }

      if (config.enableContrastCheck && pageInfo.lowContrastTexts && pageInfo.lowContrastTexts.length > 0) {
        const tagged = pageInfo.lowContrastTexts
          .slice(0, 10)
          .map((m) => ({ ...m, fix: inferContrastFix(m, config.contrastMinRatio) }));
        const previewLines = tagged.slice(0, 5).map((m) => {
          const where = m.source
            ? `${m.source.fileName.split('/src/').pop()}:${m.source.lineNumber}`
            : m.domPath || 'unknown';
          return `  • ${where}: ${m.fix || `fg ${m.fg} on bg ${m.bg} → ratio ${m.ratio}`}`;
        });
        // Fail the build on low-contrast text pairs. Per the
        // color-system-simplification RFC (docs/rfcs/color-system-simplification),
        // the runtime DOM contrast check is the *single* safety net after the
        // static contrast lint was removed — it must enforce, not just signal.
        // Per-element opt-out for intentional subtle-text designs (faint
        // watermarks, decorative chrome) is the `data-contrast-skip` HTML
        // attribute, honored on the element or any ancestor.
        reporter.pushError({
          type: 'low-contrast-text',
          text:
            `Found ${pageInfo.lowContrastTexts.length} text color/background pair(s) on route ${routeInfo.route} ` +
            `with contrast ratio below ${config.contrastMinRatio}.\n` +
            `Per-entry fix (top ${Math.min(5, tagged.length)}):\n` +
            previewLines.join('\n'),
          route: routeInfo.route,
          routeUrl: routeInfo.url,
          count: pageInfo.lowContrastTexts.length,
          matches: tagged,
          hint: 'Pair every painted background with a `text-X-foreground` partner so foreground and background are co-located. For an intentional subtle-text design, add `data-contrast-skip` on the element or any ancestor. WCAG AA body text is 4.5; this check only flags ratios below the configured minimum (default 3.0).',
        });
      }

      if (config.enableLinkCheck && pageInfo.links.length > 0) {
        reporter.stats.linksFound += pageInfo.links.length;

        // Skip cross-page link-target validity in single-route mode: the
        // route table is project-scope. A copy can't validate sibling routes
        // that may not exist yet at page_check time.
        if (!isSingleRouteMode) {
          const invalidLinks = pageInfo.links.filter((link) => {
            const path = link.pathForRoute === '/'
              ? '/'
              : (link.pathForRoute || link.normalizedPath || '/').replace(/\/+$/, '') || '/';
            return !knownRouteSet.has(path);
          });

          if (invalidLinks.length > 0) {
            reporter.pushError({
              type: 'invalid-link',
              text: `Found ${invalidLinks.length} invalid internal link(s) on route ${routeInfo.route} pointing to non-existent routes`,
              route: routeInfo.route,
              routeUrl: routeInfo.url,
              count: invalidLinks.length,
              invalidLinks: buildLinkDetails(invalidLinks),
              hint: 'Check route definitions in App.tsx (or routes config) and ensure all links point to valid routes. If many invalid links repeat across pages, the navigation bar/header menu might contain stale or incorrect hrefs.',
            });
          }

          const discoveredTargets = collectDiscoveredTargets({
            links: pageInfo.links,
            currentUrl: routeInfo.url,
            previewUrl,
          });

          discoveredTargets.forEach((target) => {
            enqueueTarget(target);
          });
        }
      }

      if (config.enableImageCheck) {
        mergeImageSources(allImageSrcs, pageInfo, routeInfo);
      }
    }

    if (!isSingleRouteMode) {
      const truncation = queue.getTruncationState();
      if (truncation.droppedByLimit > 0) {
        reporter.pushError({
          type: 'coverage-truncated',
          text: `Browser coverage truncated: dropped ${truncation.droppedByLimit} route target(s) because maxPages=${config.maxPages}. Increase DDT_MAX_PAGES for this run.`,
          droppedCount: truncation.droppedByLimit,
          droppedSamples: truncation.droppedSamples,
        });
      }
    }

    if (config.policy === 'balanced' && ignoredByPolicy.count > 0) {
      reporter.pushWarning({
        type: 'balanced-policy-ignored',
        text: `Balanced policy ignored ${ignoredByPolicy.count} network issue(s). Run in strict mode to surface all raw network failures.`,
        count: ignoredByPolicy.count,
        samples: ignoredByPolicy.samples,
      });
    }

    if (config.enableTextFidelityCheck) {
      validateTextFidelity({
        visibleTextSamples,
        pageSamples,
        threshold: config.textFidelityThreshold,
        reporter,
      });
    }

    if (config.enableImageCheck) {
      // Load registry once and share with both validators so 404 / wrong-path
      // errors can suggest registered substitutes (path + description + first QA).
      const imageRegistry = await loadImageRegistry(PROJECT_ROOT);
      await validateCollectedImages({
        page,
        baseUrl,
        allImageSrcs,
        reporter,
        registry: imageRegistry,
      });

      // validateImageRegistry has two halves: forward lookup (each used image
      // is registered) is page-local; reverse lookup (registered images that
      // are unused) is project-scope. Same for duplicate-subjects which needs
      // the union of all pages. Skip both in single-route mode.
      if (config.enableImageRegistryCheck) {
        await validateImageRegistry({
          projectRoot: PROJECT_ROOT,
          allImageSrcs,
          reporter,
          skipReverseCheck: isSingleRouteMode,
        });
        if (!isSingleRouteMode) {
          validateImageDuplicateSubjects({ allImageSrcs, reporter });
        }
      }
    }
  } catch (error) {
    reporter.pushError({
      type: 'navigation-error',
      text: String(error && error.message ? error.message : error),
    });
  } finally {
    await context.close();
    await browser.close();
  }

  reporter.stats.duration = Date.now() - startTime;

  const result = reporter.toResult({
    diagnostics: {
      policy: config.policy,
      maxPages: config.maxPages,
      timeout: config.routeTimeout,
      postNavigationDelayMs: config.postNavigationDelayMs,
      contextCoverageEnabled: config.enableContextCoverage,
      dedupeMode: config.dedupeMode,
      routeSeedSummary,
      ignoredByPolicy: {
        count: ignoredByPolicy.count,
        samples: ignoredByPolicy.samples,
      },
      coverageTruncation: queue.getTruncationState(),
    },
  });

  return {
    result,
    exitCode: result.errors.length === 0 ? 0 : 1,
  };
}
