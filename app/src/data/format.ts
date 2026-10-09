const intFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const oneDp = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export function formatInt(n: number): string {
  return intFmt.format(n);
}

const twoDp = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

/** One decimal; two below 1 so a small nonzero rate never reads as 0.0. */
export function formatRate(n: number): string {
  if (n > 0 && n < 0.005) return '<0.01';
  if (n > 0 && n < 1) return twoDp.format(n);
  return oneDp.format(n);
}

/** Auto-compact dollars: $950, $12.9K, $4.2M, $1.3B. */
export function formatUsdCompact(n: number): string {
  const abs = Math.abs(n);
  const units: Array<[number, string]> = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  for (const [size, suffix] of units) {
    if (abs >= size) {
      const v = n / size;
      const s = v >= 100 ? intFmt.format(v) : oneDp.format(v).replace(/\.0$/, '');
      return `$${s}${suffix}`;
    }
  }
  return `$${intFmt.format(n)}`;
}

/** Full dollars: $4,200,000 */
export function formatUsd(n: number): string {
  return `$${intFmt.format(n)}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${formatInt(n)} ${n === 1 ? one : many}`;
}
