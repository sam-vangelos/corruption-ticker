import type { ActualOrEstimated, Amount, AmountType, SourceKind } from './types';
import { formatUsd, formatUsdCompact } from './data/format';

/** What kind of money a figure is (schema v2 amount_type). Figures of different types never add up. */
export const AMOUNT_TYPE_LABEL: Record<AmountType, string> = {
  'private-benefit': 'private benefit received',
  'public-funds': 'public funds disbursed',
  'face-value': 'contract or asset face value',
  exposure: 'estimated or potential exposure',
};

export const ACTUAL_LABEL: Record<ActualOrEstimated, string> = {
  actual: 'actual',
  estimated: 'estimated',
};

export const SOURCE_KIND_LABEL: Record<SourceKind, string> = {
  news: 'news report',
  investigation: 'investigation',
  'court-filing': 'court filing',
  'official-report': 'official report',
  disclosure: 'disclosure',
  congressional: 'congressional record',
};

/** "$12.5M private benefit received (estimated)" */
export function amountShort(a: Amount): string {
  return `${formatUsdCompact(a.usd)} ${AMOUNT_TYPE_LABEL[a.amount_type]} (${ACTUAL_LABEL[a.actual_or_estimated]})`;
}

/** "$12,500,000 private benefit received (estimated)" */
export function amountLong(a: Amount): string {
  return `${formatUsd(a.usd)} ${AMOUNT_TYPE_LABEL[a.amount_type]} (${ACTUAL_LABEL[a.actual_or_estimated]})`;
}
