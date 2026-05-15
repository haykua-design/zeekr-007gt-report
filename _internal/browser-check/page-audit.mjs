function collectPageInfoInBrowser({ enablePlaceholderCheck, enableLinkCheck, enableImageCheck, enableContrastCheck, contrastMinRatio, enableTextFidelityCheck, enableOverflowCheck, overflowTolerancePx }) {
  const getReactSource = (element) => {
    if (!element) return null;
    try {
      const fiberKey = Object.keys(element).find((key) => {
        return (
          key.startsWith('__reactFiber') ||
          key.startsWith('__reactInternalInstance') ||
          key.startsWith('__reactProps')
        );
      });

      if (!fiberKey) return null;

      let fiber = element[fiberKey];
      let depth = 0;
      const maxDepth = 30;

      while (fiber && depth < maxDepth) {
        depth += 1;
        const debugSource = fiber._debugSource || fiber._source || fiber.source || fiber.__source;
        if (debugSource && debugSource.fileName) {
          return {
            fileName: debugSource.fileName,
            lineNumber: debugSource.lineNumber || debugSource.line || 0,
          };
        }
        fiber = fiber.return || fiber._debugOwner;
      }
    } catch {
      // ignore
    }
    return null;
  };

  const getDomPath = (element) => {
    if (!element) return '';
    const parts = [];
    let current = element;
    let depth = 0;
    while (current && current !== document.body && depth < 5) {
      let selector = current.tagName.toLowerCase();
      if (current.id) {
        selector += `#${current.id}`;
      } else if (current.className && typeof current.className === 'string') {
        const classes = current.className
          .split(' ')
          .filter((name) => name && !name.includes('group-hover') && !name.includes('hover:'))
          .slice(0, 2);
        if (classes.length > 0) selector += `.${classes.join('.')}`;
      }
      parts.unshift(selector);
      current = current.parentElement;
      depth += 1;
    }
    return parts.join(' > ');
  };

  const overlayEl =
    document.querySelector('vite-error-overlay') ||
    document.querySelector('.vite-error-overlay') ||
    document.querySelector('[data-vite-error-overlay]') ||
    document.querySelector('.vite-error-overlay-host');

  const hasViteError = !!overlayEl || !!document.body.innerText.includes('ReferenceError');
  let viteErrorContent = '';
  if (overlayEl) {
    const root = overlayEl.shadowRoot || overlayEl;
    viteErrorContent = (root.innerText || root.textContent || '').trim();
    if (viteErrorContent.length > 8000) {
      viteErrorContent = `${viteErrorContent.slice(0, 8000)}\n... (truncated)`;
    }
  } else if (hasViteError) {
    const bodyText = document.body.innerText || '';
    const refErrIdx = bodyText.indexOf('ReferenceError');
    if (refErrIdx >= 0) {
      viteErrorContent = bodyText.slice(Math.max(0, refErrIdx - 200), refErrIdx + 2000).trim();
      if (viteErrorContent.length > 8000) {
        viteErrorContent = `${viteErrorContent.slice(0, 8000)}\n... (truncated)`;
      }
    }
  }

  const rawFormulas = [];
  const invalidFormulas = [];
  const formulaErrors = [];

  try {
    const maxRawFormulas = 10;
    const blockRegex = /\$\$[\s\S]*?\$\$/g;
    const inlineRegex = /\$[^$]+\$/g;

    const textWalker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || parent.tagName === 'NOSCRIPT')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      },
      false,
    );

    let textNode;
    while ((textNode = textWalker.nextNode())) {
      if (rawFormulas.length >= maxRawFormulas) break;
      const fullText = textNode.textContent || '';
      if (!fullText.includes('$')) continue;

      const matches = [];

      blockRegex.lastIndex = 0;
      let blockMatch;
      while ((blockMatch = blockRegex.exec(fullText)) !== null) {
        matches.push({ type: 'block', text: blockMatch[0] });
        if (matches.length >= maxRawFormulas) break;
      }

      const textWithoutBlock = fullText.replace(blockRegex, ' ');
      inlineRegex.lastIndex = 0;
      let inlineMatch;
      while ((inlineMatch = inlineRegex.exec(textWithoutBlock)) !== null) {
        matches.push({ type: 'inline', text: inlineMatch[0] });
        if (matches.length >= maxRawFormulas) break;
      }

      if (matches.length === 0) continue;

      const parentEl = textNode.parentElement || textNode;
      const source = getReactSource(parentEl);
      const domPath = !source ? getDomPath(parentEl) : '';
      let htmlSnippet = '';
      try {
        if (parentEl && parentEl.outerHTML) {
          const rawHtml = parentEl.outerHTML;
          htmlSnippet = rawHtml.length > 400 ? `${rawHtml.slice(0, 400)}... (truncated)` : rawHtml;
        }
      } catch {
        // ignore
      }

      matches.forEach((match) => {
        if (rawFormulas.length >= maxRawFormulas) return;
        rawFormulas.push({
          type: match.type,
          text: match.text.slice(0, match.type === 'block' ? 120 : 80),
          source,
          domPath,
          htmlSnippet,
        });
      });
    }

    const hasDisallowedScript = (text) => {
      if (!text) return false;
      const patterns = [
        /[\u4e00-\u9fff]/,
        /[\u3040-\u309f]/,
        /[\u30a0-\u30ff]/,
        /[\uac00-\ud7af]/,
        /[\u0600-\u06ff]/,
      ];
      return patterns.some((re) => re.test(text));
    };

    const formulaNodes = Array.from(document.querySelectorAll('.formula'));
    formulaNodes.forEach((el) => {
      const text = (el.innerText || '').trim();
      if (!text) return;
      if (!hasDisallowedScript(text)) return;
      invalidFormulas.push({
        textSnippet: text.slice(0, 80),
        domPath: getDomPath(el),
        reason: 'contains non-Latin script in formula',
      });
    });

    const errorNodes = Array.from(document.querySelectorAll('.formula-error'));
    errorNodes.forEach((el) => {
      const text = (el.innerText || '').trim();
      if (!text) return;
      formulaErrors.push({
        textSnippet: text.slice(0, 80),
        domPath: getDomPath(el),
      });
    });
  } catch {
    // ignore
  }

  const result = {
    placeholders: [],
    links: [],
    imageSrcs: [],
    hasViteError,
    viteErrorContent: hasViteError ? viteErrorContent : undefined,
    rawFormulas,
    invalidFormulas,
    formulaErrors,
    lowContrastTexts: [],
    overflows: [],
    overflowWarnings: [],
    visibleText: '',
  };

  if (enableTextFidelityCheck) {
    // `innerText` must be read from the live DOM — it relies on layout/CSS,
    // so a detached clone would fall back to raw textContent and report text
    // that's hidden via display:none. Prefer <main> so nav/footer boilerplate
    // that repeats on every route doesn't inflate the token set.
    try {
      const root = document.querySelector('main') || document.body;
      result.visibleText = (root.innerText || '').slice(0, 500_000);
    } catch {
      // ignore
    }
  }

  if (enablePlaceholderCheck) {
    const patterns = [
      /\[(?:DDLive-TODO|DDT-PLACEHOLDER):.*?\]/i,
      /<!--\s*\[(?:DDLive-TODO|DDT-PLACEHOLDER):.*?\]\s*-->/i,
      /\{\/\*\s*\[(?:DDLive-TODO|DDT-PLACEHOLDER):.*?\]\s*\*\/\}/i,
    ];

    const seenTexts = new Set();

    const commentWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT, null, false);

    let commentNode;
    while ((commentNode = commentWalker.nextNode())) {
      const commentText = commentNode.textContent || '';
      for (const pattern of patterns) {
        if (!pattern.test(commentText) || seenTexts.has(commentText)) continue;
        seenTexts.add(commentText);
        result.placeholders.push({
          text: commentText.substring(0, 200),
          pattern: pattern.source,
          type: 'html-comment',
        });
        break;
      }
    }

    const textWalker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || parent.tagName === 'NOSCRIPT')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      },
      false,
    );

    let node;
    while ((node = textWalker.nextNode())) {
      const text = (node.textContent || '').trim();
      if (!text || text.length < 10) continue;

      for (const pattern of patterns) {
        if (!pattern.test(text) || seenTexts.has(text)) continue;
        seenTexts.add(text);
        result.placeholders.push({
          text: text.substring(0, 200),
          pattern: pattern.source,
          type: 'text-node',
        });
        break;
      }
    }
  }

  if (enableLinkCheck) {
    const anchorLinks = Array.from(document.querySelectorAll('a[href]'));
    const base = typeof window !== 'undefined' && window.location ? window.location.href : 'http://localhost/';

    anchorLinks.forEach((link) => {
      const href = (link.getAttribute('href') || '').trim();
      if (!href) return;
      if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (href.startsWith('javascript:') || href === '#') return;
      if (href.startsWith('#') && href.indexOf('/', 1) === -1) return;

      let pathForRoute;
      if (href.startsWith('#')) {
        const pathPart = href.substring(1).split('?')[0].split('#')[0].trim() || '/';
        pathForRoute = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
      } else {
        try {
          const url = new URL(href, base);
          pathForRoute = url.pathname || '/';
        } catch {
          pathForRoute = (href.split('?')[0].split('#')[0] || '/').trim() || '/';
          if (!pathForRoute.startsWith('/')) pathForRoute = `/${pathForRoute}`;
        }
      }

      pathForRoute = pathForRoute.replace(/\/+$/, '') || '/';
      const source = getReactSource(link);
      const domPath = !source ? getDomPath(link) : '';

      result.links.push({
        href,
        normalizedPath: pathForRoute,
        pathForRoute,
        text: (link.textContent || '').trim().substring(0, 50),
        source,
        domPath,
      });
    });
  }

  if (enableImageCheck) {
    const base = typeof window !== 'undefined' && window.location ? window.location.href : 'http://localhost/';
    const seen = new Map();

    Array.from(document.querySelectorAll('img[src]')).forEach((img) => {
      const src = (img.getAttribute('src') || '').trim();
      if (!src) return;
      if (src.startsWith('data:') || src.startsWith('blob:')) return;

      // Decorative images (role="presentation" or empty alt) are exempt from registry checks.
      const isDecorative =
        img.getAttribute('role') === 'presentation' ||
        (img.hasAttribute('alt') && img.getAttribute('alt') === '');

      // Raw alt text is collected so the validator can detect the same registered
      // image being reused for semantically distinct subjects (e.g. one poster
      // URL assigned to two different film rows).
      const alt = img.hasAttribute('alt') ? (img.getAttribute('alt') || '').trim() : '';

      // External URLs (http/https) are collected so the validator can reject them.
      const isExternal = src.startsWith('http://') || src.startsWith('https://');
      if (!isExternal && !src.startsWith('/') && !src.startsWith('./') && !src.startsWith('../')) return;

      let path;
      if (isExternal) {
        path = src;
      } else {
        try {
          const url = new URL(src, base);
          path = url.pathname || '/';
        } catch {
          path = src.split('?')[0].split('#')[0] || '/';
          if (!path.startsWith('/')) path = `/${path}`;
        }
      }

      // Dedup by (path, alt): distinct alt for the same path is a new occurrence
      // worth surfacing to the duplicate-subjects validator. Identical (path,alt)
      // is a legitimate repeat (e.g. the same logo) — collapse it.
      const dedupKey = `${path}\n${alt}`;
      if (!seen.has(dedupKey)) {
        const source = getReactSource(img);
        seen.set(dedupKey, { source, isExternal, isDecorative });
        result.imageSrcs.push({ path, alt, source, isExternal, isDecorative });
        return;
      }

      const existingData = seen.get(dedupKey);
      if (!existingData || existingData.source) return;
      const source = getReactSource(img);
      if (!source) return;

      seen.set(dedupKey, { source, isExternal, isDecorative });
      const item = result.imageSrcs.find((entry) => entry.path === path && entry.alt === alt);
      if (item) item.source = source;
    });
  }

  if (enableContrastCheck) {
    // Parse "rgb(r, g, b)" / "rgba(r, g, b, a)" → {r,g,b,a} in [0,1] for alpha.
    // Returns null when the string is unrecognized (e.g. a named color we don't
    // care to handle — getComputedStyle normalizes to rgb/rgba in practice).
    const parseRgb = (str) => {
      if (!str) return null;
      const m = String(str).match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i);
      if (!m) return null;
      return {
        r: Math.max(0, Math.min(255, parseFloat(m[1]))),
        g: Math.max(0, Math.min(255, parseFloat(m[2]))),
        b: Math.max(0, Math.min(255, parseFloat(m[3]))),
        a: m[4] == null ? 1 : Math.max(0, Math.min(1, parseFloat(m[4]))),
      };
    };

    // Composite a (possibly translucent) color over an opaque backdrop.
    const composite = (fg, bg) => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1,
    });

    // WCAG relative luminance.
    const luminance = ({ r, g, b }) => {
      const chan = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
    };

    const contrastRatio = (a, b) => {
      const la = luminance(a);
      const lb = luminance(b);
      const hi = Math.max(la, lb);
      const lo = Math.min(la, lb);
      return (hi + 0.05) / (lo + 0.05);
    };

    // Does `container` contain an absolutely/fixed-positioned image overlay?
    // Common pattern: `<section><div class="absolute inset-0"><img .../></div>...`
    // If yes, the visible background is painted by that overlay and cannot be
    // resolved from CSS `background-color` alone — the caller should skip.
    const hasAbsoluteImageOverlay = (container) => {
      if (!container || !container.children) return false;
      for (const child of container.children) {
        const cs = window.getComputedStyle(child);
        if (cs.position !== 'absolute' && cs.position !== 'fixed') continue;
        if (child.tagName === 'IMG') return true;
        if (cs.backgroundImage && cs.backgroundImage !== 'none') return true;
        if (child.querySelector && child.querySelector('img')) return true;
      }
      return false;
    };

    // Walk up the ancestor chain collecting background-color layers (innermost
    // first), stopping when we reach an opaque one. Then composite bottom-up
    // so translucent layers (e.g. `bg-white/5` cards on a `bg-slate-950` section)
    // resolve to the true painted color.
    //
    // Parse rgb()/rgba() colors out of a CSS gradient string and return their
    // average. Used when an ancestor uses `linear-gradient(...)` / `radial-
    // gradient(...)` as its background — we can't sample the painted pixel
    // from CSS, but the stops bound the possible bg colors, so the average
    // is a reasonable single-color approximation. Returns null if no parseable
    // rgb stops were found (e.g. CSS variables, hex literals — getComputedStyle
    // does normalize most named/hex colors to rgb(), so this is rare).
    const averageGradientColor = (gradientStr) => {
      if (!gradientStr) return null;
      const colors = [];
      const re = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/gi;
      let m;
      while ((m = re.exec(gradientStr)) !== null) {
        const a = m[4] == null ? 1 : parseFloat(m[4]);
        if (a < 0.01) continue;
        colors.push({
          r: parseFloat(m[1]),
          g: parseFloat(m[2]),
          b: parseFloat(m[3]),
        });
      }
      if (colors.length === 0) return null;
      const avg = colors.reduce(
        (acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b }),
        { r: 0, g: 0, b: 0 },
      );
      return {
        r: avg.r / colors.length,
        g: avg.g / colors.length,
        b: avg.b / colors.length,
        a: 1,
      };
    };

    // Image-bearing ancestors don't bail out unconditionally — they're treated
    // as opaque backgrounds whose color we approximate (gradient: average of
    // rgb stops; raster image overlay: fall back to mid-grey, which is the
    // worst-case-readable assumption). Returning null here meant every page
    // with a top-level gradient silently skipped the contrast check entirely.
    const resolveBackground = (el) => {
      const layers = [];
      let cur = el;
      let foundOpaque = false;
      while (cur && cur !== document.documentElement) {
        const cs = window.getComputedStyle(cur);
        const hasImage = cs.backgroundImage && cs.backgroundImage !== 'none';
        const hasOverlay = hasAbsoluteImageOverlay(cur);
        const bg = parseRgb(cs.backgroundColor);
        if (bg && bg.a > 0.01) {
          layers.push(bg);
          if (bg.a >= 0.99) {
            foundOpaque = true;
            break;
          }
        }
        if (hasImage || hasOverlay) {
          // Try to read gradient stops first; fall back to mid-grey.
          const grad = hasImage ? averageGradientColor(cs.backgroundImage) : null;
          layers.push(grad || { r: 128, g: 128, b: 128, a: 1 });
          foundOpaque = true;
          break;
        }
        cur = cur.parentElement;
      }
      if (layers.length === 0) return null;
      const base = foundOpaque ? layers.pop() : { r: 255, g: 255, b: 255, a: 1 };
      let result = base;
      for (let i = layers.length - 1; i >= 0; i -= 1) {
        result = composite(layers[i], result);
      }
      return result;
    };

    // Multiply `opacity` along the ancestor chain. CSS `opacity` is invisible
    // to `getComputedStyle().color` — a `text-white opacity-60` element reports
    // pure white, but renders as a 60% white wash over the painted bg. Without
    // this, dim-text-on-dark-bg (and vice versa) is undetectable.
    const ancestorOpacity = (el) => {
      let cur = el;
      let alpha = 1;
      while (cur && cur !== document.documentElement) {
        const cs = window.getComputedStyle(cur);
        const o = parseFloat(cs.opacity);
        if (Number.isFinite(o)) alpha *= Math.max(0, Math.min(1, o));
        cur = cur.parentElement;
      }
      return alpha;
    };

    const isSkippableAncestor = (el) => {
      let cur = el;
      while (cur && cur !== document.body) {
        const tag = cur.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'SVG' || tag === 'CANVAS') return true;
        // Explicit per-element opt-out: the coder is acknowledging an
        // intentional subtle-text design (faint watermark, decorative
        // chrome, branded chip with paired colors) and asking this runtime
        // check to skip it. Honored on the element OR any ancestor so
        // wrapping a whole subtree is one attribute, not many. Use
        // sparingly — every skip is a guarantee that you've eyeballed the
        // pair and it's intentional.
        if (cur.hasAttribute && cur.hasAttribute('data-contrast-skip')) return true;
        const cs = window.getComputedStyle(cur);
        if (cs.display === 'none' || cs.visibility === 'hidden') return true;
        if (parseFloat(cs.opacity || '1') < 0.2) return true;
        cur = cur.parentElement;
      }
      return false;
    };

    // Dedupe by distinct (fg,bg,fontSize) triples. No global node cap — the
    // number of *distinct* color pairs on a page is small even when text nodes
    // are large, and capping per-page silently dropped real violations from
    // dense pages. Belt-and-suspenders: still cap at 100 distinct pairs to
    // bound the report payload if something goes very wrong.
    const seenPairs = new Map();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    const maxDistinctPairs = 100;

    let node;
    while ((node = walker.nextNode())) {
      if (seenPairs.size >= maxDistinctPairs) break;
      const text = (node.textContent || '').trim();
      if (text.length < 4) continue;
      const parent = node.parentElement;
      if (!parent || isSkippableAncestor(parent)) continue;

      const cs = window.getComputedStyle(parent);
      const fgRaw = parseRgb(cs.color);
      if (!fgRaw) continue;
      const bg = resolveBackground(parent);
      if (!bg) continue; // unresolvable bg — skip

      // Fold ancestor `opacity` into the foreground alpha. `getComputedStyle`
      // on `color` returns the unfaded rgb; the visible color is that rgb
      // composited over the painted bg with effective alpha = color.a * Π(opacity_i).
      const opacityAlpha = ancestorOpacity(parent);
      const fg = { ...fgRaw, a: fgRaw.a * opacityAlpha };
      const composited = fg.a >= 0.99 ? fg : composite(fg, bg);
      const ratio = contrastRatio(composited, bg);
      if (ratio >= contrastMinRatio) continue;

      const fontSize = parseFloat(cs.fontSize) || 16;
      const key = `${Math.round(composited.r)},${Math.round(composited.g)},${Math.round(composited.b)}|${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)}|${Math.round(fontSize)}`;
      if (seenPairs.has(key)) continue;

      seenPairs.set(key, true);
      const source = getReactSource(parent);
      const domPath = !source ? getDomPath(parent) : '';
      result.lowContrastTexts.push({
        textSample: text.slice(0, 80),
        fg: `rgb(${Math.round(composited.r)}, ${Math.round(composited.g)}, ${Math.round(composited.b)})`,
        bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
        ratio: Math.round(ratio * 100) / 100,
        fontSize: Math.round(fontSize),
        source,
        domPath,
      });
    }
  }

  if (enableOverflowCheck) {
    // Detect text content that paints outside its container ("text bleed").
    //
    // Contract: a bleed is a text node that paints **partially outside a
    // hard-clipping ancestor** (`overflow: hidden | clip`). Auto/scroll
    // containers, a11y-hidden subtrees, and invisible chrome are intentional
    // designs, not bugs — we exclude each by name with a documented reason.
    // We accept silent under-coverage in exchange for zero false-positive
    // noise: a lint that fires noisily on non-bugs trains coders to ignore it,
    // including when it eventually flags a real bug.
    //
    // Approach: walk text nodes inside <main>. For each text node, measure its
    // own painted box via Range.getBoundingClientRect() and compare against
    // the *nearest hard-clipping ancestor's* content-box right/bottom edges.
    // This ignores absolute/fixed decorative children (which legitimately
    // overhang their parents — e.g. captions with negative offsets) without
    // needing a separate skip list, because we never look at element
    // scrollWidth.
    //
    // Severity (ratio = bleed / clientDimension):
    //   - bleed <= absTol px         → ignored (sub-pixel rounding)
    //   - ratio < softRatio (0.10)   → warning (visible but tolerable)
    //   - ratio >= softRatio         → error (real overlap)
    //
    // Skip (each principled, not a heuristic):
    //   - elements with no width / height
    //   - text inside `overflow: auto|scroll` ancestors → user can scroll, the
    //     "overflow" is the design (carousels, code blocks, wide tables)
    //   - text inside a11y-clipped subtrees (`.katex-mathml`, `.sr-only`,
    //     `[aria-hidden="true"]`) → invisible to sighted users by design
    //   - text inside invisible ancestors (`display:none`, `visibility:hidden`,
    //     `opacity < 0.05`) → not painted to user
    //   - text whose rect is **fully outside** the clipping host → already
    //     scrolled past / off-canvas, not "bleeding into" anything
    try {
      const main = document.querySelector('main');
      if (main) {
        const absTol = typeof overflowTolerancePx === 'number' ? overflowTolerancePx : 1;
        const softRatio = 0.10; // <10% bleed → warning, ≥10% → error
        const maxReports = 10;
        const seen = new Set();

        // Walk up from a text node's parent to find the in-flow box that
        // **hard-clips** overflow. `auto`/`scroll` are intentionally excluded:
        // they offer the user a scroll affordance, so exceeding them is the
        // design contract, not a bleed bug.
        const findClippingHost = (start, axis) => {
          let cur = start;
          while (cur && cur !== main && cur !== document.body) {
            const cs = window.getComputedStyle(cur);
            const ov = axis === 'x' ? cs.overflowX : cs.overflowY;
            if (ov === 'hidden' || ov === 'clip') {
              return cur;
            }
            cur = cur.parentElement;
          }
          return main;
        };

        const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while ((node = walker.nextNode())) {
          if (result.overflows.length + result.overflowWarnings.length >= maxReports) break;
          const text = (node.textContent || '').trim();
          if (text.length < 2) continue;

          const parent = node.parentElement;
          if (!parent) continue;
          // Skip text inside accessibility-only subtrees that are clipped to a
          // 1×1 box for screen readers. Their layout-real rect is huge but the
          // clipping host is 1px, so the bleed ratio is meaningless (KaTeX's
          // .katex-mathml is the canonical case — every formula would otherwise
          // report ~8000% bleed against its 1×1 mathml host).
          if (parent.closest('.katex-mathml, .sr-only, [aria-hidden="true"]')) continue;
          // Walk ancestors: skip if effectively invisible (display:none,
          // visibility:hidden, or opacity collapsed to ~0). Opacity-0 hover
          // hints are common (e.g. ZoomableImage's "点击放大" overlay) and
          // their painted rect is layout-real but the user never sees them.
          let invisible = false;
          for (let cur = parent; cur && cur !== document.body; cur = cur.parentElement) {
            const ccs = window.getComputedStyle(cur);
            if (ccs.display === 'none' || ccs.visibility === 'hidden') { invisible = true; break; }
            if (parseFloat(ccs.opacity || '1') < 0.05) { invisible = true; break; }
          }
          if (invisible) continue;

          let range;
          try {
            range = document.createRange();
            range.selectNodeContents(node);
          } catch {
            continue;
          }
          const tRect = range.getBoundingClientRect();
          range.detach && range.detach();
          if (!tRect || tRect.width <= 0 || tRect.height <= 0) continue;

          // The host is the nearest ancestor that would actually clip on this
          // axis. If the text fits within its rect (plus tol), no bleed.
          const xHost = findClippingHost(parent, 'x');
          const yHost = findClippingHost(parent, 'y');
          const xRect = xHost.getBoundingClientRect();
          const yRect = yHost.getBoundingClientRect();

          // Fully-outside guard: text whose rect lies entirely past the host
          // edge is scrolled-past content (carousel slide 2+, off-canvas
          // drawer, virtualised list row), not "bleeding into" the host. The
          // host walk above already filters out auto/scroll cases, but a hard-
          // hidden carousel (`overflow:hidden flex` for animated transitions)
          // can still legitimately keep slides off-stage.
          const fullyOutsideX = tRect.right <= xRect.left || tRect.left >= xRect.right;
          const fullyOutsideY = tRect.bottom <= yRect.top || tRect.top >= yRect.bottom;
          if (fullyOutsideX || fullyOutsideY) continue;

          const xBleedPx = Math.max(tRect.right - xRect.right, xRect.left - tRect.left);
          const yBleedPx = Math.max(tRect.bottom - yRect.bottom, yRect.top - tRect.top);

          const xCw = xHost.clientWidth || 1;
          const yCh = yHost.clientHeight || 1;
          const xRatio = xBleedPx / xCw;
          const yRatio = yBleedPx / yCh;

          const xBleed = xBleedPx > absTol;
          const yBleed = yBleedPx > absTol;
          if (!xBleed && !yBleed) continue;

          const axis = xBleed && yBleed ? 'both' : xBleed ? 'x' : 'y';
          const hostEl = axis === 'y' ? yHost : xHost;
          const domPath = getDomPath(hostEl);
          const key = `${domPath}|${axis}`;
          if (seen.has(key)) continue;
          seen.add(key);

          let maxTokenLen = 0;
          for (const tok of text.split(/\s+/)) {
            if (tok.length > maxTokenLen) maxTokenLen = tok.length;
          }

          const ratio = Math.max(xBleed ? xRatio : 0, yBleed ? yRatio : 0);
          const source = getReactSource(hostEl);
          // Snapshot the few computed-style signals used by audit-recipes.mjs
          // to infer a fix recipe. Keeping it small: every field below is one
          // input to one branch of inferOverflowFix.
          const hostCs = window.getComputedStyle(hostEl);
          const parentEl = hostEl.parentElement;
          const parentCs = parentEl ? window.getComputedStyle(parentEl) : null;
          const cssDiag = {
            whiteSpace: hostCs.whiteSpace,
            overflowWrap: hostCs.overflowWrap,
            wordBreak: hostCs.wordBreak,
            maxWidth: hostCs.maxWidth,
            maxHeight: hostCs.maxHeight,
            webkitLineClamp: hostCs.webkitLineClamp || hostCs.getPropertyValue('-webkit-line-clamp'),
            minWidth: hostCs.minWidth,
            paddingLeft: hostCs.paddingLeft,
            paddingRight: hostCs.paddingRight,
            parentDisplay: parentCs ? parentCs.display : null,
          };
          const entry = {
            axis,
            bleedPx: Math.round(Math.max(xBleed ? xBleedPx : 0, yBleed ? yBleedPx : 0)),
            clientWidth: xHost.clientWidth,
            clientHeight: yHost.clientHeight,
            ratioPct: Math.round(ratio * 1000) / 10, // one decimal
            tag: hostEl.tagName.toLowerCase(),
            blockRef: hostEl.getAttribute && hostEl.getAttribute('data-block-ref') || null,
            textSample: text.slice(0, 80),
            maxTokenLen,
            source,
            domPath: source ? '' : domPath,
            cssDiag,
          };

          if (ratio >= softRatio) {
            result.overflows.push(entry);
          } else {
            result.overflowWarnings.push(entry);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return result;
}

export async function collectPageInfo(page, options) {
  return page.evaluate(collectPageInfoInBrowser, {
    enablePlaceholderCheck: Boolean(options.enablePlaceholderCheck),
    enableLinkCheck: Boolean(options.enableLinkCheck),
    enableImageCheck: Boolean(options.enableImageCheck),
    enableContrastCheck: Boolean(options.enableContrastCheck),
    contrastMinRatio: typeof options.contrastMinRatio === 'number' ? options.contrastMinRatio : 2.5,
    enableTextFidelityCheck: Boolean(options.enableTextFidelityCheck),
    enableOverflowCheck: Boolean(options.enableOverflowCheck),
    overflowTolerancePx: typeof options.overflowTolerancePx === 'number' ? options.overflowTolerancePx : 1,
  });
}
