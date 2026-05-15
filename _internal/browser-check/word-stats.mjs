// Word/char tokenizer shared between the report-bridge codegen (.gen.ts stats)
// and the runtime text-fidelity check.
//
// "Words" here means natural human words, NOT LLM tokens:
//   - each CJK character (Ideographs, Hiragana, Katakana, Hangul) = 1 word
//   - each Latin / digit run = 1 word (word-boundary tokenisation)
//   - whitespace and punctuation are dropped
// Mirrors `ddl_client/src/tools/common/word_count.py` so progress hooks,
// fidelity check, and .gen.ts stats all agree on what "1 word" means.
//
// `maxWordLen` is the longest unbreakable run of word-chars (Latin/digit runs
// or single CJK chars). Predicts grid-blowout from URLs/identifiers — the
// number that matters for layout regardless of total word count.

const PLACEHOLDER_RE = /\[(?:DDLive-TODO|DDT-PLACEHOLDER):[^\]]*\]/gi;

export function stripPlaceholders(text) {
  if (!text) return '';
  return String(text).replace(PLACEHOLDER_RE, ' ');
}

const LATIN_WORD_RE = /[A-Za-z0-9_]+(?:['\u2019\-][A-Za-z0-9_]+)*/g;
const CJK_SCAN_RE = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g;

export function countWords(text) {
  if (!text) return 0;
  const cleaned = stripPlaceholders(text);
  if (!cleaned) return 0;
  let count = 0;
  let last = 0;
  CJK_SCAN_RE.lastIndex = 0;
  let m;
  while ((m = CJK_SCAN_RE.exec(cleaned)) !== null) {
    if (m.index > last) {
      count += (cleaned.slice(last, m.index).match(LATIN_WORD_RE) || []).length;
    }
    count += 1;
    last = m.index + m[0].length;
  }
  if (last < cleaned.length) {
    count += (cleaned.slice(last).match(LATIN_WORD_RE) || []).length;
  }
  return count;
}

// Total visible characters after stripping placeholders. Whitespace is kept
// because cumulative spacing affects how much room the text needs to render.
export function countChars(text) {
  if (!text) return 0;
  return stripPlaceholders(text).length;
}

// Longest unbreakable run. CJK chars are individually breakable so they count
// as length 1; Latin/digit runs are unbreakable in normal CSS unless
// `break-words` / `overflow-wrap: anywhere` is applied.
export function maxWordLen(text) {
  if (!text) return 0;
  const cleaned = stripPlaceholders(text);
  if (!cleaned) return 0;
  let max = 0;
  const matches = cleaned.match(LATIN_WORD_RE);
  if (matches) {
    for (const m of matches) {
      if (m.length > max) max = m.length;
    }
  }
  if (CJK_SCAN_RE.test(cleaned) && max < 1) max = 1;
  return max;
}

// Combined stats for a single text payload. Block-level callers concatenate
// any sub-strings (e.g. table cells) before calling.
export function computeBlockStats(text) {
  return {
    chars: countChars(text),
    words: countWords(text),
    maxWordLen: maxWordLen(text),
  };
}
