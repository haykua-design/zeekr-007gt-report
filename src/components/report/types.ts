// Block schema produced by scripts/build-report-bridge.mjs.
// Page components import these types when destructuring report.sections[id].blocks.

// Layout hints produced at codegen time. "Words" = natural human words
// (CJK char = 1, Latin run = 1), NOT LLM tokens. `maxWordLen` is the longest
// unbreakable Latin/digit run — the predictor for grid-blowout (a single
// 60-char URL/identifier breaks 3-col grids without `break-words`).
//
// Use at design time to pick a layout that fits the content:
//   - words < 30   → callout / pull-quote / lead-line <Extract> / small card
//   - 30 ≤ w < 150 → standard card or one-column section
//   - words ≥ 150  → full-width column or multi-row section (no fixed height)
//   - maxWordLen > 24 → container needs break-words / overflow-x-auto
export interface BlockStats {
  chars: number;
  words: number;
  maxWordLen: number;
}

// `html` is omitted by the codegen when it would be byte-identical to `text`
// (the common case for CJK prose without inline markdown). Consumers must
// fall back to `text` when `html` is absent.
export interface ParagraphBlock {
  type: 'paragraph';
  id: string;
  fqId?: string;
  text: string;
  html?: string;
  leadNumber: string | null;
  leadEntity: string | null;
  stats: BlockStats;
}

export interface ListItemBlock {
  type: 'list-item';
  id: string;
  fqId?: string;
  text: string;
  html?: string;
  leadNumber: string | null;
  leadEntity: string | null;
  stats: BlockStats;
}

export interface HeadingBlock {
  type: 'heading';
  id: string;
  fqId?: string;
  level: number;
  text: string;
  html?: string;
}

export interface TableBlock {
  type: 'table';
  id: string;
  fqId?: string;
  header: string[];
  rows: string[][];
  stats: BlockStats;
}

export interface ImageBlock {
  type: 'image';
  id: string;
  fqId?: string;
  alt: string;
  src: string;
}

export interface RawBlock {
  type: 'raw';
  id: string;
  fqId?: string;
  text: string;
}

export type Block =
  | ParagraphBlock
  | ListItemBlock
  | HeadingBlock
  | TableBlock
  | ImageBlock
  | RawBlock;

// Section's own id is the dict key in `Report.sections` — not duplicated here.
export interface Section {
  level: number;
  heading: string;
  blocks: Block[];
}

export interface Report {
  name: string;
  frontmatter: Record<string, string>;
  sections: Record<string, Section>;
  allBlockIds: string[];
}

export type BlockWithLead = ParagraphBlock | ListItemBlock;
