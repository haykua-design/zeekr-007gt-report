import { twMerge } from 'tailwind-merge';
import type { Block } from './types';

interface Props {
  content: Block;
  as?: 'inline' | 'paragraph' | 'serif-display' | 'caption';
  className?: string;
}

// Renders a parsed report block. The page chooses the visual treatment via `as`;
// the actual text/html comes verbatim from the .md source — never re-typed.
//
// The data-report-block attribute is what scripts/check-content-coverage.mjs
// uses to verify every source block is referenced. Do not remove it.
export function ProseBlock({ content, as = 'paragraph', className = '' }: Props) {
  if (!content) {
    throw new Error(
      "ProseBlock received undefined content. Use byId(report, 'section::block') " +
      "and verify the id exists in report.allBlockIds. If this is optional UI, " +
      "guard at the call site before rendering ProseBlock.",
    );
  }

  // content.fqId is always supplied by byId(). Pages that destructure
  // report.sections[...].blocks[n] directly (unsupported path) will render
  // without the debug attribute — that's fine, the coverage check reads
  // SOURCE for byId() calls, not DOM attributes.
  const baseAttrs = {
    'data-report-block': content.fqId,
  };

  if (content.type === 'image') {
    // Image blocks are NEVER rendered via the bridge — coders retype every
    // image with <ZoomableImage> so it gets the lightbox / caption / a11y
    // chrome. Throwing here turns the wrong path into a loud failure.
    const viteSrc = content.src.replace(/^\/public\//, '/');
    throw new Error(
      `ProseBlock cannot render image blocks (${content.fqId}). ` +
      `Retype with <ZoomableImage src="${viteSrc}" alt={...} /> in the page; ` +
      `image src in JSX uses Vite URL-form (/assets/...), while the .md keeps ` +
      `filesystem-form (/public/assets/...). See coder skill ` +
      `"static-visuals/image_integration".`,
    );
  }

  if (content.type === 'table') {
    return (
      <div {...baseAttrs} className={className}>
        <table>
          <thead>
            <tr>{content.header.map((h, i) => <th key={i}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {content.rows.map((row, ri) => (
              <tr key={ri}>{row.map((c, ci) => <td key={ci}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (content.type === 'heading') {
    const Tag = (`h${Math.min(content.level, 6)}` as 'h1');
    const html = content.html ?? content.text;
    return <Tag {...baseAttrs} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
  }

  if (content.type === 'raw') {
    return <div {...baseAttrs} className={className}>{content.text}</div>;
  }

  // paragraph or list-item
  const variantClass =
    as === 'inline' ? 'inline'
    : as === 'serif-display' ? 'font-serif text-2xl leading-relaxed'
    : as === 'caption' ? 'text-sm opacity-70'
    : 'leading-relaxed';

  const html = content.html ?? content.text;
  return (
    <p
      {...baseAttrs}
      className={twMerge(variantClass, className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
