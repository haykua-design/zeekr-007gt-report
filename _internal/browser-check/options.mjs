function parseBool(raw, defaultValue = false) {
  if (raw == null) return defaultValue;
  const value = String(raw).trim().toLowerCase();
  if (value === '1' || value === 'true' || value === 'yes' || value === 'on') return true;
  if (value === '0' || value === 'false' || value === 'no' || value === 'off') return false;
  return defaultValue;
}

function parsePositiveInt(raw, defaultValue) {
  if (raw == null || raw === '') return defaultValue;
  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return parsed;
}

function normalizePolicy(raw) {
  const value = String(raw || '').trim().toLowerCase();
  return value === 'strict' ? 'strict' : 'balanced';
}

function normalizeDedupeMode(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'global') return 'global';
  return 'route';
}

/**
 * 从环境变量中读取代理配置
 * 支持 HTTP_PROXY, HTTPS_PROXY, http_proxy, https_proxy
 */
export function getProxyFromEnv(env = process.env) {
  const proxy = env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy;

  if (!proxy) {
    return null;
  }

  try {
    const url = new URL(proxy);
    const proxyConfig = {
      server: `${url.protocol}//${url.host}`,
    };

    if (url.username || url.password) {
      proxyConfig.username = url.username || '';
      proxyConfig.password = url.password || '';
    }

    const noProxy = env.NO_PROXY || env.no_proxy || '';
    const bypassHosts = ['localhost', '127.0.0.1', '::1', '*.localhost', '*.127.0.0.1'];
    if (noProxy) {
      const noProxyHosts = noProxy
        .split(',')
        .map((host) => host.trim())
        .filter((host) => host);
      bypassHosts.push(...noProxyHosts);
    }

    proxyConfig.bypass = [...new Set(bypassHosts)].join(',');
    return proxyConfig;
  } catch (error) {
    console.warn(`[Proxy] Failed to parse proxy URL from environment: ${error.message}`);
    return null;
  }
}

export function buildRuntimeConfig(previewUrl, env = process.env) {
  const previewHost = new URL(previewUrl).hostname;
  const isLocalhostPreview = previewHost === 'localhost' || previewHost === '127.0.0.1' || previewHost === '::1';

  const config = {
    policy: normalizePolicy(env.DDT_BROWSER_ERROR_POLICY),
    dedupeMode: normalizeDedupeMode(env.DDT_ERROR_DEDUPE_MODE),
    maxPages: parsePositiveInt(env.DDT_MAX_PAGES, 200),
    routeTimeout: parsePositiveInt(env.DDT_ROUTE_TIMEOUT, 30000),
    postNavigationDelayMs: parsePositiveInt(env.DDT_POST_NAVIGATION_DELAY_MS, 3000),
    enableLinkCheck: String(env.DDT_CHECK_LINKS || '').toLowerCase() !== 'false',
    enableImageCheck: String(env.DDT_CHECK_IMAGES || '').toLowerCase() !== 'false',
    enableImageRegistryCheck: String(env.DDT_CHECK_IMAGE_REGISTRY || '').toLowerCase() !== 'false',
    enablePlaceholderCheck: String(env.DDT_CHECK_PLACEHOLDERS || '').toLowerCase() !== 'false',
    enableContrastCheck: String(env.DDT_CHECK_CONTRAST || '').toLowerCase() !== 'false',
    // Text overflow: catches elements whose rendered content paints outside
    // their box (scrollWidth > clientWidth or scrollHeight > clientHeight)
    // while computed overflow is `visible` — the failure mode where bridge-
    // imported text overruns its slot and overlaps neighbouring content.
    // Containers that opt into clipping (`overflow: auto/hidden/scroll`) are
    // intentional and pass.
    enableOverflowCheck: String(env.DDT_CHECK_OVERFLOW || '').toLowerCase() !== 'false',
    // Sub-pixel rounding tolerance. 1px is enough to absorb fractional layout
    // without masking real bleed. Raise via env if a specific font/zoom combo
    // produces noisy false positives.
    overflowTolerancePx: Number.parseFloat(env.DDT_OVERFLOW_TOLERANCE_PX || '1') || 1,
    // Text fidelity: fraction of distinct source report tokens that appear in
    // the rendered DOM across all visited pages. Guards against silent text
    // loss via CSS (display:none, line-clamp, closed accordions) or fragment-
    // only <Extract> references. Static check-content-coverage already
    // guarantees every block is *referenced*; this check verifies the text
    // actually *renders*. Threshold is token-set coverage, not raw word count.
    enableTextFidelityCheck: String(env.DDT_CHECK_TEXT_FIDELITY || '').toLowerCase() !== 'false',
    // Per-page bar: each visited route's rendered/expected ratio must clear
    // this. Set lower than a global average would be — a single short page
    // (e.g. a deck-style summary route) is more likely to dip than the whole
    // site, and we don't want short-but-faithful pages to fail.
    textFidelityThreshold: Number.parseFloat(env.DDT_TEXT_FIDELITY_THRESHOLD || '0.63') || 0.63,
    // Minimum contrast ratio for visible text. WCAG AA is 4.5 (body) / 3.0
    // (large). 3.0 is the AA-large floor — anything below is unreadable for
    // small body text regardless of size. Raising from the older 2.5 default
    // because the runtime check now folds `opacity` into the foreground alpha,
    // so dim-on-dark cases that previously slipped through (white@60% on
    // slate-900) are now correctly measured and need a real threshold.
    contrastMinRatio: Number.parseFloat(env.DDT_CONTRAST_MIN_RATIO || '3.0') || 3.0,
    enableContextCoverage: parseBool(env.DDT_ENABLE_CONTEXT_COVERAGE, true),
    // Only disable proxy when explicitly requested via DDT_DISABLE_PROXY.
    // Do NOT auto-disable based on isLocalhostPreview: the preview server is
    // localhost, but the page itself loads external resources (maps, CDN, etc.)
    // that need to go through the corporate proxy. getProxyFromEnv already adds
    // localhost/127.0.0.1/::1 to the bypass list, so the preview URL itself
    // is always reached directly even when a proxy is configured.
    disableProxy: parseBool(env.DDT_DISABLE_PROXY, false),
    // When the corporate proxy performs SSL inspection it replaces TLS certs
    // with ones signed by a private CA that Chromium does not trust by default,
    // causing ERR_CERT_AUTHORITY_INVALID for external resources (map tiles, CDN).
    // Set DDT_IGNORE_HTTPS_ERRORS=true in environments where SSL inspection is
    // in use and the CA cert cannot be added to Chromium's trust store.
    ignoreHTTPSErrors: parseBool(env.DDT_IGNORE_HTTPS_ERRORS, false),
    isLocalhostPreview,
  };

  const proxyConfig = config.disableProxy ? null : getProxyFromEnv(env);
  const launchOptions = {};

  if (proxyConfig) {
    const bypassList = proxyConfig.bypass ? proxyConfig.bypass.split(',').map((host) => host.trim()) : [];
    const requiredBypass = ['localhost', '127.0.0.1', '::1'];
    const missingBypass = requiredBypass.filter((host) => {
      return !bypassList.some((entry) => {
        const trimmed = entry.trim();
        return trimmed === host || trimmed === `*.${host}` || host === `*.${trimmed}`;
      });
    });

    if (missingBypass.length > 0) {
      proxyConfig.bypass = [...new Set([...bypassList, ...requiredBypass])].join(',');
    }

    launchOptions.proxy = proxyConfig;
  }

  if (isLocalhostPreview) {
    launchOptions.args = launchOptions.args || [];
    const bypassArg = '--proxy-bypass-list=localhost,127.0.0.1,::1';
    if (!launchOptions.args.includes(bypassArg)) {
      launchOptions.args.push(bypassArg);
    }
  }

  return {
    ...config,
    launchOptions,
  };
}
