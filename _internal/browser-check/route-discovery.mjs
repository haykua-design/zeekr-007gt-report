import {
  canonicalVisitKey,
  isSameOrigin,
  normalizeRoutePath,
  resolveRouteTargetUrl,
  routeFromAbsoluteUrl,
  shouldSkipLinkHref,
  toAbsoluteUrl,
} from './url-utils.mjs';

export async function readAppRoutes(page) {
  return page.evaluate(() => {
    const list = (globalThis && globalThis.__APP_ROUTES__) || ['/'];
    if (Array.isArray(list) && list.length > 0) return list;
    return ['/'];
  });
}

export function detectHashRouter(routes) {
  const firstRoute = Array.isArray(routes) && routes.length > 0 ? routes[0] : '/';
  return typeof firstRoute === 'string' && firstRoute.startsWith('#');
}

export function createKnownRouteSet(routes = []) {
  const known = new Set(['/']);
  routes.forEach((route) => {
    const text = String(route || '').trim();
    if (!text) return;
    const normalized = normalizeRoutePath(text);
    if (normalized.startsWith('#')) {
      known.add(normalized.slice(1));
      return;
    }
    known.add(normalized);
  });
  return known;
}

export function buildRouteTargets({ baseUrl, routes, isHashRouter }) {
  const targets = [];
  if (!Array.isArray(routes)) return targets;

  routes.forEach((route) => {
    const routePath = typeof route === 'string' ? route : '/';
    const targetUrl = resolveRouteTargetUrl(baseUrl, routePath, isHashRouter);
    targets.push({ route: routePath, targetUrl });
  });

  return targets;
}

export function createVisitQueue({ maxPages }) {
  const pending = [];
  const queued = new Set();
  const visited = new Set();
  let droppedByLimit = 0;
  const droppedSamples = [];

  function enqueue(targetUrl) {
    const key = canonicalVisitKey(targetUrl);
    if (!key) return { added: false, reason: 'invalid' };
    if (queued.has(key) || visited.has(key)) return { added: false, reason: 'duplicate' };
    if (pending.length + visited.size >= maxPages) {
      droppedByLimit += 1;
      if (droppedSamples.length < 20) {
        droppedSamples.push(targetUrl);
      }
      return { added: false, reason: 'max-pages' };
    }
    queued.add(key);
    pending.push({ targetUrl, key });
    return { added: true, reason: 'added' };
  }

  function next() {
    if (pending.length === 0) return null;
    const entry = pending.shift();
    queued.delete(entry.key);
    visited.add(entry.key);
    return entry;
  }

  function hasNext() {
    return pending.length > 0;
  }

  return {
    enqueue,
    next,
    hasNext,
    pending,
    visited,
    getTruncationState: () => ({
      droppedByLimit,
      droppedSamples: [...droppedSamples],
    }),
  };
}

export function collectDiscoveredTargets({ links, currentUrl, previewUrl }) {
  if (!Array.isArray(links) || links.length === 0) return [];

  const discovered = [];
  links.forEach((link) => {
    const href = String(link && link.href ? link.href : '').trim();
    if (!href || shouldSkipLinkHref(href)) return;

    const absoluteUrl = toAbsoluteUrl(currentUrl, href);
    if (!absoluteUrl) return;
    if (!isSameOrigin(absoluteUrl, previewUrl)) return;

    discovered.push(absoluteUrl);
  });

  return discovered;
}

export function routeInfoFromTarget(targetUrl) {
  return {
    route: routeFromAbsoluteUrl(targetUrl),
    url: targetUrl,
  };
}
