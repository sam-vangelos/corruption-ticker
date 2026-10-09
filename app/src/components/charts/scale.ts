/** Round a maximum up to a clean axis top and return evenly spaced ticks from 0. */
export function niceTicks(max: number, approx = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / approx;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  // Integer data never needs fractional ticks.
  const s = max >= 1 && step < 1 ? 1 : step;
  const top = Math.ceil(max / s) * s;
  const ticks: number[] = [];
  for (let v = 0; v <= top + s / 2; v += s) ticks.push(Number(v.toPrecision(12)));
  return ticks;
}

export const linear = (d0: number, d1: number, r0: number, r1: number) => (v: number) =>
  d1 === d0 ? r0 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

/** Column path: square at the baseline, 4px rounded at the data end. */
export function columnPath(x: number, y: number, w: number, baseline: number, radius = 4): string {
  const h = baseline - y;
  if (h <= 0) return '';
  const r = Math.min(radius, w / 2, h);
  return `M${x},${baseline}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${baseline}Z`;
}

/** Horizontal bar path: square at the baseline (left), rounded at the data end (right). */
export function barPath(x0: number, y: number, len: number, h: number, radius = 4): string {
  if (len <= 0) return '';
  const r = Math.min(radius, h / 2, len);
  const x1 = x0 + len;
  return `M${x0},${y}H${x1 - r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 - r},${y + h}H${x0}Z`;
}

/** Approximate rendered width of a label in the system sans, for layout budgeting. */
export const textWidth = (s: string, px: number) => s.length * px * 0.56;
