import type { Block, Report } from './types';

// Resolves a fully-qualified block id (`<sectionId>::<blockId>`) into a Block,
// and emits the `data-block-ref` marker that the coverage check looks for.
//
// Usage in a page:
//   <ProseBlock content={byId(report, 'tier-1::p-2')} />
//
// The returned object includes a `fqId` so <ProseBlock> can stamp
// `data-report-block` on the rendered DOM. The coverage script reads the
// SOURCE for `byId(...)` calls — so canonical placement is verified at
// build time, not at render time.
export function byId(report: Report, fqId: string): Block {
  const [sid, bid] = fqId.split('::');
  const sec = report.sections[sid];
  if (!sec) {
    const available = Object.keys(report.sections);
    const guess = nearest(sid, available);
    const hint = guess ? ` Did you mean "${guess}::${bid}"?` : '';
    throw new Error(
      `byId: section "${sid}" not found in report "${report.name}".${hint} ` +
      `Available sections: [${available.join(', ')}]`,
    );
  }
  const block = sec.blocks.find(b => b.id === bid);
  if (!block) {
    const available = sec.blocks.map(b => b.id);
    const guess = nearest(bid, available);
    const hint = guess ? ` Did you mean "${sid}::${guess}"?` : '';
    throw new Error(
      `byId: block "${bid}" not found in section "${sid}" of report "${report.name}".${hint} ` +
      `Available blocks: [${available.join(', ')}]`,
    );
  }
  return { ...block, fqId };
}

// Cheap Levenshtein for "did you mean" hints. Only called on the failure path,
// against the small set of section/block ids in a single report — no need to
// optimise. Returns the closest candidate within edit distance ≤ 3, else null.
function nearest(target: string, candidates: string[]): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = editDistance(target, c);
    if (d < bestD) { bestD = d; best = c; }
  }
  return bestD <= 3 ? best : null;
}

function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = new Array(n + 1);
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
