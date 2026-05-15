// Per-entry fix recipes for runtime overflow + low-contrast errors.
//
// page-audit.mjs collects the *symptom* (bleed px, ratio, fg/bg colors). The
// existing reporter prints a generic 4-bullet "things to try" list. That's
// useful only on the first occurrence; after that the agent has to read the
// CSS itself to figure out which bullet applies. These helpers turn the
// already-collected diagnostic CSS / colors into a concrete one-line fix
// recipe per entry, mirroring the byId / image-registry "this is what to do
// next" pattern.
//
// The helpers are pure functions (no DOM, no Chromium) so they can be unit
// tested. page-audit.mjs is responsible for populating cssDiag / colors;
// these helpers only interpret what's there.

const NUMERIC_PX = /^([\d.]+)px$/;

function pxValue(v) {
  if (!v || typeof v !== 'string') return null;
  const m = v.match(NUMERIC_PX);
  return m ? parseFloat(m[1]) : null;
}

/**
 * Diagnose the most-likely cause of a single text-overflow entry and return a
 * short imperative fix recipe ("Add `min-w-0` to the flex child", etc.).
 *
 * Returns null when the diagnostic data is too thin to commit to a guess —
 * the generic 4-bullet hint then carries the load.
 */
export function inferOverflowFix(entry) {
  if (!entry || !entry.cssDiag) return null;
  const d = entry.cssDiag;
  const axis = entry.axis || 'x';
  const maxTokenLen = entry.maxTokenLen || 0;

  // y-axis: usually a height cap or line-clamp.
  if (axis === 'y') {
    if (d.webkitLineClamp && d.webkitLineClamp !== 'none' && d.webkitLineClamp !== '0') {
      return `host has \`-webkit-line-clamp: ${d.webkitLineClamp}\` — increase the clamp count or remove the line-clamp utility so the text can wrap.`;
    }
    const mh = pxValue(d.maxHeight);
    if (mh && mh > 0 && mh < 9999) {
      return `host has \`max-height: ${d.maxHeight}\` — replace with \`min-h-…\` so the slot grows with content.`;
    }
    return 'host clips on the y-axis — replace fixed height with `min-h-…` and let the slot grow.';
  }

  // x-axis: most common; pick the strongest signal.
  // 1. White-space:nowrap on shortish text → the obvious smoking gun.
  if (d.whiteSpace === 'nowrap' && maxTokenLen < 24) {
    return 'host has `white-space: nowrap` — drop `whitespace-nowrap` (or set `whitespace-normal`) so the text wraps.';
  }

  // 2. Long unbreakable token (URL / hash / id) without break-words.
  const wrapsLong =
    d.overflowWrap === 'anywhere' ||
    d.overflowWrap === 'break-word' ||
    d.wordBreak === 'break-all' ||
    d.wordBreak === 'break-word';
  if (maxTokenLen >= 24 && !wrapsLong) {
    return `text contains a ${maxTokenLen}-char unbreakable token — add \`break-words\` (\`overflow-wrap: anywhere\`) on the host.`;
  }

  // 3. Flex/grid child without min-width:0.
  // Default min-width:auto on a flex item prevents shrinking below content size.
  if (
    (d.parentDisplay === 'flex' || d.parentDisplay === 'inline-flex' ||
      d.parentDisplay === 'grid' || d.parentDisplay === 'inline-grid') &&
    (d.minWidth === 'auto' || d.minWidth === '' || d.minWidth == null)
  ) {
    return 'host is a flex/grid child with `min-width: auto` — add `min-w-0` so it can shrink below its content size.';
  }

  // 4. Hard max-width that's tighter than the content.
  const mw = pxValue(d.maxWidth);
  if (mw && mw > 0 && mw < 9999) {
    return `host has \`max-width: ${d.maxWidth}\` — widen it or remove the cap; bridge content size is unknown at design time.`;
  }

  // 5. Padding eating the content area inside a fixed-width host.
  const padX = (pxValue(d.paddingLeft) || 0) + (pxValue(d.paddingRight) || 0);
  const cw = entry.clientWidth || 0;
  if (cw > 0 && padX / cw > 0.5) {
    return `padding (${Math.round(padX)}px) is over half of the host width (${cw}px) — reduce horizontal padding.`;
  }

  return null;
}

// --- Contrast --------------------------------------------------------------

function parseRgb(s) {
  if (typeof s !== 'string') return null;
  const m = s.match(/rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/i);
  return m ? { r: +m[1], g: +m[2], b: +m[3] } : null;
}

function relLum({ r, g, b }) {
  const channel = (c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a, b) {
  const la = relLum(a);
  const lb = relLum(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Suggest the simpler of #000 / #fff as the fg color for the entry's bg, with
 * the resulting ratio. If the picked color still doesn't reach `target`, say
 * so explicitly — that means the *bg* needs to move, not the fg.
 */
export function inferContrastFix(entry, target = 4.5) {
  if (!entry) return null;
  const fg = parseRgb(entry.fg);
  const bg = parseRgb(entry.bg);
  if (!fg || !bg) return null;

  const black = { r: 0, g: 0, b: 0 };
  const white = { r: 255, g: 255, b: 255 };
  const rB = contrastRatio(black, bg);
  const rW = contrastRatio(white, bg);
  const pick = rB >= rW ? { name: '#000000', ratio: rB } : { name: '#ffffff', ratio: rW };
  const round = (n) => Math.round(n * 100) / 100;

  if (pick.ratio >= target) {
    return (
      `current fg ${entry.fg} on bg ${entry.bg} → ratio ${round(entry.ratio || 0)}; ` +
      `switching fg to ${pick.name} on the same bg gives ratio ${round(pick.ratio)} (≥ ${target}).`
    );
  }
  return (
    `current fg ${entry.fg} on bg ${entry.bg} → ratio ${round(entry.ratio || 0)}; ` +
    `even pure ${pick.name} on this bg only reaches ${round(pick.ratio)} — the bg is the problem, ` +
    `swap the bg for a darker / lighter token.`
  );
}
