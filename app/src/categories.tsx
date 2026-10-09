import type { Category } from './types';
import { CATEGORIES } from './types';

/**
 * Category identity: a text label, a fixed palette slot (schema order), and a
 * distinct glyph shape, so identity never depends on color alone.
 * Palette validated with the dataviz validator in both modes (see README).
 */
export const CATEGORY_LABEL: Record<Category, string> = {
  'self-enrichment': 'Self-enrichment',
  'foreign-emoluments': 'Foreign emoluments',
  crypto: 'Crypto',
  'pardons-clemency': 'Pardons and clemency',
  'pay-to-play': 'Pay to play',
  'nepotism-cronyism': 'Nepotism and cronyism',
  'contracts-procurement': 'Contracts and procurement',
  'oversight-retaliation': 'Oversight retaliation',
  'abuse-of-office': 'Abuse of office',
  'conflicts-of-interest': 'Conflicts of interest',
  'misuse-of-funds': 'Misuse of funds',
};

export function categorySlot(c: Category): number {
  return CATEGORIES.indexOf(c) + 1;
}

export function categoryColor(c: Category): string {
  return `var(--cat-${categorySlot(c)})`;
}

/** 12x12 shapes, one per slot. Distinct silhouettes at small sizes. */
const SHAPES: Record<number, JSX.Element> = {
  1: <circle cx="6" cy="6" r="5" />,                                            // circle
  2: <rect x="1.5" y="1.5" width="9" height="9" />,                             // square
  3: <polygon points="6,0.8 10.6,3.4 10.6,8.6 6,11.2 1.4,8.6 1.4,3.4" />,     // hexagon
  4: <polygon points="6,1 11.2,10.6 0.8,10.6" />,                               // triangle up
  5: <polygon points="6,0.4 11.6,6 6,11.6 0.4,6" />,                            // diamond
  6: <polygon points="0.8,1.4 11.2,1.4 6,11" />,                                // triangle down
  7: <path d="M4.2 0.8h3.6v3.4h3.4v3.6H7.8v3.4H4.2V7.8H0.8V4.2h3.4z" />,        // plus
  8: <polygon points="6,0.4 7.5,4.3 11.7,4.5 8.4,7.1 9.6,11.2 6,8.8 2.4,11.2 3.6,7.1 0.3,4.5 4.5,4.3" />, // star
  9: <polygon points="6,0.6 11.4,4.6 9.4,11 2.6,11 0.6,4.6" />,                 // pentagon
  10: <path fillRule="evenodd" d="M6 0.8a5.2 5.2 0 1 1 0 10.4A5.2 5.2 0 0 1 6 0.8zm0 3a2.2 2.2 0 1 0 0 4.4a2.2 2.2 0 0 0 0-4.4z" />, // ring
  11: <polygon points="1,1 11,1 6,6 11,11 1,11 6,6" />,                         // hourglass
};

interface GlyphProps {
  category: Category;
  /** When true the glyph is announced by name; otherwise it is decorative. */
  labelled?: boolean;
  className?: string;
}

export function CategoryGlyph({ category, labelled = false, className }: GlyphProps) {
  const slot = categorySlot(category);
  return (
    <svg
      className={`glyph${className ? ` ${className}` : ''}`}
      viewBox="0 0 12 12"
      width="12"
      height="12"
      style={{ fill: categoryColor(category) }}
      role={labelled ? 'img' : undefined}
      aria-label={labelled ? CATEGORY_LABEL[category] : undefined}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
    >
      {labelled && <title>{CATEGORY_LABEL[category]}</title>}
      {SHAPES[slot]}
    </svg>
  );
}
