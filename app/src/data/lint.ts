import type { EvidenceGrade } from '../types';
import { gradeDef } from '../method';

/**
 * The summary lint (docs/schema.md § Admission controls). Deterministic and
 * conservative: approval covers the rest.
 *
 * 1. The summary opens with its grade's verb phrase, exactly as in
 *    src/method.ts ("Documented:", "Alleged (corroborated):"), or contains that
 *    phrase within its first eight words.
 * 2. Below grade 1, it contains no unattributed guilt phrase. A phrase counts
 *    as attributed only when one of "reported", "alleged", "documented" or
 *    "according" appears within the six words before it.
 */
export const GUILT_PHRASES = ['committed', 'is guilty', 'is a criminal', 'bribed', 'stole', 'defrauded', 'embezzled', 'laundered'] as const;
const ATTRIBUTION = new Set(['reported', 'alleged', 'documented', 'according']);

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const norm = (w: string) => w.toLowerCase().replace(/[^a-z'-]/g, '');

/** Why a summary breaks the lint, or null. */
export function summaryProblem(summary: string, grade: EvidenceGrade): string | null {
  const verb = gradeDef(grade).verb;
  const opener = `${verb.charAt(0).toUpperCase()}${verb.slice(1)}:`;
  const head = words(summary).slice(0, 8).join(' ').toLowerCase();
  const escaped = verb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const verbNear = new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`).test(head);
  if (!summary.trimStart().startsWith(opener) && !verbNear) {
    return `summary must open with "${opener}" or use "${verb}" within its first eight words (grade ${grade})`;
  }
  if (grade === 1) return null;
  const toks = words(summary).map(norm);
  for (const phrase of GUILT_PHRASES) {
    const p = phrase.split(' ');
    for (let i = 0; i + p.length <= toks.length; i++) {
      if (!p.every((w, k) => toks[i + k] === w)) continue;
      const before = toks.slice(Math.max(0, i - 6), i);
      if (!before.some((w) => ATTRIBUTION.has(w))) {
        return `summary asserts "${phrase}" without attribution; below grade 1 a guilt phrase needs "reported", "alleged", "documented" or "according" within the six words before it`;
      }
    }
  }
  return null;
}
