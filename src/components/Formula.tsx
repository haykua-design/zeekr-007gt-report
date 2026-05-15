import katex from 'katex';
import 'katex/dist/katex.min.css';
import { ReactNode } from 'react';

export interface DdlFormulaProps {
  /** LaTeX string, with or without $ / $$ delimiters. If omitted, children (string) is used. */
  content?: string;
  className?: string;
  /** Alternative to content: pass LaTeX string as children, e.g. <DdlFormula>{String.raw`$x^2$`}</DdlFormula> */
  children?: ReactNode;
}

interface FormulaImplProps extends DdlFormulaProps {
  /** If true, render as block (display mode); default false = inline */
  block?: boolean;
}

/**
 * Strip optional $ or $$ from content so KaTeX receives raw LaTeX.
 */
function stripDelimiters(s: string): string {
  const trimmed = s.trim();
  if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 4) {
    return trimmed.slice(2, -2).trim();
  }
  if (trimmed.startsWith('$') && trimmed.endsWith('$') && trimmed.length > 2) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

// Unicode ranges that trigger unicodeTextInMathMode in KaTeX: CJK, Hiragana, Katakana, Hangul, Thai, fullwidth/CJK punctuation
const TEXT_RANGE =
  /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u0e00-\u0e7f\u3000-\u303f\uff00-\uffef]/;
const TEXT_RUN =
  /([\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u0e00-\u0e7f\u3000-\u303f\uff00-\uffef]+)/g;

/**
 * Auto-wrap bare Unicode text runs in \text{…} so KaTeX doesn't choke on them.
 * Runs already inside \text{…} or \mathrm{…} are left alone.
 */
function wrapBareCJK(latex: string): string {
  if (!TEXT_RANGE.test(latex)) return latex;
  return latex.replace(TEXT_RUN, (match, _cjk, offset: number) => {
    const before = latex.slice(0, offset);
    if (/\\(?:text|mathrm|mbox)\{[^}]*$/.test(before)) return match;
    return `\\text{${match}}`;
  });
}

/**
 * Renders LaTeX with KaTeX. Can be nested inside any element; font size and style inherit from parent.
 * Use inline (default) for text flow, or block for displayed equations.
 */
function FormulaImpl({ content, block = false, className, children }: FormulaImplProps) {
  const source = content ?? (typeof children === 'string' ? children : '');
  const raw = wrapBareCJK(stripDelimiters(source));
  let html: string;
  try {
    html = katex.renderToString(raw, {
      displayMode: block,
      throwOnError: false,
    });
  } catch {
    html = raw ? `<span class="formula-error">${escapeHtml(raw)}</span>` : '';
  }
  const baseClass = block ? 'formula formula-block' : 'formula formula-inline';
  const combinedClass = className ? `${baseClass} ${className}` : baseClass;
  if (block) {
    return <div className={combinedClass} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return <span className={combinedClass} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Inline LaTeX (use in text flow). Prefer over generic "Formula" for clarity. */
export function DdlFormula(props: DdlFormulaProps) {
  return <FormulaImpl {...props} block={false} />;
}

/** Block LaTeX (displayed equations). Prefer over <DdlFormula block> for clarity. */
export function DdlFormulaBlock(props: DdlFormulaProps) {
  return <FormulaImpl {...props} block={true} />;
}

/** @deprecated Use DdlFormula for inline, DdlFormulaBlock for block. */
export function Formula(props: DdlFormulaProps & { block?: boolean }) {
  return <FormulaImpl {...props} block={props.block ?? false} />;
}

/** @deprecated Use DdlFormulaBlock. */
export const FormulaBlock = DdlFormulaBlock;

/** Used only when KaTeX throws: escape content so it can be safely shown as plain text (no XSS). */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
