import type { BlockWithLead } from './types';

type Pick = 'leadNumber' | 'leadEntity' | 'firstSentence' | 'plainText';

interface Props {
  from: BlockWithLead;
  pick: Pick;
  className?: string;
  fallback?: string;
}

// Promotes a fragment of a block (e.g., the lead $-figure) into a display-sized
// element without losing the rest of the block — the same block is still rendered
// elsewhere by a sibling <ProseBlock>. The coverage check treats Extract as a
// secondary reference (does NOT count as the canonical placement).
export function Extract({ from, pick, className = '', fallback = '' }: Props) {
  let value: string = '';
  if (pick === 'leadNumber') value = from.leadNumber || fallback;
  else if (pick === 'leadEntity') value = from.leadEntity || fallback;
  else if (pick === 'firstSentence') {
    const m = from.text.match(/^[^。.!?！？]+[。.!?！？]?/);
    value = m ? m[0] : from.text.slice(0, 80);
  }
  else if (pick === 'plainText') value = from.text;

  return (
    <span
      data-report-extract={`${from.fqId}:${pick}`}
      className={className}
    >
      {value}
    </span>
  );
}
