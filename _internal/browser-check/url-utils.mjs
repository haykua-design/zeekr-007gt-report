export function parseStackLocation(stack) {
  if (!stack || typeof stack !== 'string') {
    return null;
  }

  const lines = stack.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('at ')) continue;

    const urlMatch = trimmed.match(/(https?:\/\/[^\s)]+):(\d+):(\d+)/);
    if (!urlMatch) continue;

    const [, url, lineNum, columnNum] = urlMatch;
    return {
      source: url,
      line: Number(lineNum),
      column: Number(columnNum),
    };
  }

  return null;
}

export function normalizeRoutePath(rawPath) {
  const text = String(rawPath || '').trim();
  if (!text) return '/';

  if (text.startsWith('#')) {
    const hashPath = text.slice(1).split('?')[0].split('#')[0].trim();
    const normalizedHashPath = hashPath.startsWith('/') ? hashPath : `/${hashPath}`;
    return `#${normalizedHashPath.replace(/\/+$/, '') || '/'}`;
  }

  const base = text.split('?')[0].split('#')[0].trim();
  const withLeadingSlash = base.startsWith('/') ? base : `/${base}`;
  return withLeadingSlash.replace(/\/+$/, '') || '/';
}

export function routeFromAbsoluteUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.hash && url.hash.startsWith('#/')) {
      const hashPath = normalizeRoutePath(url.hash);
      return hashPath;
    }
    return normalizeRoutePath(url.pathname || '/');
  } catch {
    return normalizeRoutePath(rawUrl || '/');
  }
}

export function canonicalVisitKey(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const basePath = normalizeRoutePath(url.pathname || '/');
    if (url.hash && url.hash.startsWith('#/')) {
      const hashPath = normalizeRoutePath(url.hash);
      return `${url.origin}${basePath}${hashPath}`;
    }
    return `${url.origin}${basePath}`;
  } catch {
    return normalizeRoutePath(rawUrl || '/');
  }
}

export function resolveRouteTargetUrl(baseUrl, routePath, isHashRouter = false) {
  const normalizedRoute = String(routePath || '').trim();
  if (!normalizedRoute) return baseUrl;

  if (isHashRouter || normalizedRoute.startsWith('#')) {
    const routeHash = normalizeRoutePath(normalizedRoute.startsWith('#') ? normalizedRoute : `#${normalizedRoute}`);
    return `${baseUrl}${routeHash}`;
  }

  const normalizedPath = normalizeRoutePath(normalizedRoute);
  return `${baseUrl}${normalizedPath}`;
}

export function shouldSkipLinkHref(href) {
  const text = String(href || '').trim();
  if (!text) return true;
  if (text.startsWith('mailto:') || text.startsWith('tel:') || text.startsWith('javascript:')) return true;
  if (text === '#') return true;
  if (text.startsWith('#') && text.indexOf('/', 1) === -1) return true;
  return false;
}

export function toAbsoluteUrl(currentUrl, href) {
  if (shouldSkipLinkHref(href)) return null;
  try {
    if (href.startsWith('#/')) {
      const current = new URL(currentUrl);
      const base = `${current.origin}${current.pathname}`;
      return `${base}${href}`;
    }
    return new URL(href, currentUrl).toString();
  } catch {
    return null;
  }
}

export function isSameOrigin(urlA, urlB) {
  try {
    const a = new URL(urlA);
    const b = new URL(urlB);
    return a.origin === b.origin;
  } catch {
    return false;
  }
}
