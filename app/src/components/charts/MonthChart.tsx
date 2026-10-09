import { useMemo, useRef, type ReactNode } from 'react';
import { MONTH_NAMES } from '../../data/dates';
import { columnPath, linear, niceTicks, textWidth } from './scale';
import { useRem, useWidth } from './hooks';
import { useActive } from './useActive';
import { ChartTooltip } from './Tooltip';

const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));
const STRIDES = [1, 2, 3, 4, 6, 12, 24];

interface MonthChartProps {
  kind: 'columns' | 'line';
  months: string[];
  values: number[];
  /** Axis tick + direct label format. */
  format: (n: number) => string;
  /** Tooltip / live-region body for index i. */
  describe: (i: number) => { value: string; label: string; extra?: string };
  /** Accessible name for the focusable plot. */
  name: string;
}

/**
 * Month-banded chart: columns (bars grow from one baseline) or a line with a
 * 10% area wash and an end dot. Single series, neutral ink, hairline grid.
 * Columns: each column's band is its hit target. Line: a crosshair snaps to
 * the nearest month. Arrow keys give the same readout while focused.
 */
export function MonthChart({ kind, months, values, format, describe, name }: MonthChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useWidth(wrapRef);
  const rem = useRem();
  const n = months.length;
  const { active, setActive, focused, plotProps } = useActive(n);

  const max = Math.max(0, ...values);
  const ticks = useMemo(() => niceTicks(max, 4), [max]);
  const top = ticks[ticks.length - 1] ?? 1;

  const font = 0.75 * rem;
  const yLabelW = Math.max(...ticks.map((t) => textWidth(format(t), font)));
  const lastLabel = kind === 'line' && n ? format(values[n - 1] ?? 0) : '';
  const m = {
    top: 1.5 * rem,
    right: kind === 'line' ? Math.max(1 * rem, textWidth(lastLabel, font) + 0.9 * rem) : 0.75 * rem,
    bottom: 2.6 * rem,
    left: yLabelW + 0.75 * rem,
  };
  const plotH = 10 * rem;
  const height = m.top + plotH + m.bottom;
  const plotW = Math.max(10, width - m.left - m.right);
  const step = n ? plotW / n : plotW;
  const barW = Math.max(2, Math.min(24, step * 0.5, step - 2));
  const y = linear(0, top, m.top + plotH, m.top);
  const baseline = m.top + plotH;
  const cx = (i: number) => m.left + step * i + step / 2;

  // Quarter-aligned x labels at a stride that fits.
  const labelW = 3.4 * rem;
  const need = Math.max(1, Math.ceil((n * labelW) / Math.max(plotW, 1)));
  const stride = STRIDES.find((s) => s >= need) ?? 24;
  const xLabels: Array<{ i: number; mon: string; year: string | null }> = [];
  let shownFirst = false;
  months.forEach((key, i) => {
    const [ys, ms] = key.split('-');
    const abs = Number(ys) * 12 + Number(ms) - 1;
    if (abs % stride !== 0) return;
    const showYear = !shownFirst || Number(ms) === 1;
    shownFirst = true;
    xLabels.push({ i, mon: MONTH_SHORT[Number(ms) - 1] ?? '', year: showYear ? (ys ?? '') : null });
  });

  // Selective direct labels: the peak column, or the line's end value.
  const peak = values.reduce((best, v, i) => (v >= (values[best] ?? -1) && v > 0 ? i : best), -1);

  const linePath = kind === 'line' && n
    ? values.map((v, i) => `${i ? 'L' : 'M'}${cx(i)},${y(v)}`).join('')
    : '';
  const areaPath = linePath ? `${linePath}L${cx(n - 1)},${baseline}L${cx(0)},${baseline}Z` : '';

  const onPointerMove = (e: React.PointerEvent<SVGRectElement>) => {
    if (kind !== 'line') return;
    const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - box.left - m.left;
    setActive(Math.max(0, Math.min(n - 1, Math.round((px - step / 2) / step))));
  };

  const activeInfo: ReactNode = active !== null ? (() => {
    const d = describe(active);
    return (
      <>
        <span className="chart-tip__value">{d.value}</span>
        <span className="chart-tip__label">{d.label}</span>
        {d.extra && <span className="chart-tip__extra">{d.extra}</span>}
      </>
    );
  })() : null;
  const liveText = focused && active !== null ? (() => { const d = describe(active); return `${d.label}: ${d.value}${d.extra ? `. ${d.extra}` : ''}`; })() : '';

  return (
    <div className="plot" ref={wrapRef}>
      {width > 0 && (
        <div
          className="plot__focus"
          role="group"
          aria-label={`${name}. Use the left and right arrow keys to read each month.`}
          {...plotProps}
        >
          <svg className="plot__svg" width={width} height={height} aria-hidden="true" focusable="false">
            {/* grid + y ticks */}
            {ticks.map((t) => (
              <g key={t}>
                <line className={t === 0 ? 'axis-base' : 'grid'} x1={m.left} x2={m.left + plotW} y1={y(t)} y2={y(t)} />
                <text className="tick" x={m.left - 0.5 * rem} y={y(t)} dy="0.32em" textAnchor="end">{format(t)}</text>
              </g>
            ))}
            {/* x labels */}
            {xLabels.map((l) => (
              <text key={l.i} className="tick" x={cx(l.i)} y={baseline + 1.1 * rem} textAnchor="middle">
                <tspan x={cx(l.i)}>{l.mon}</tspan>
                {l.year && <tspan x={cx(l.i)} dy="1.15em" className="tick--year">{l.year}</tspan>}
              </text>
            ))}

            {kind === 'columns' && values.map((v, i) => (
              <path
                key={months[i]}
                className="mark"
                data-active={active === i || undefined}
                d={columnPath(cx(i) - barW / 2, y(v), barW, baseline)}
              />
            ))}
            {kind === 'columns' && peak >= 0 && (
              <text className="direct-label" x={cx(peak)} y={y(values[peak] ?? 0) - 0.4 * rem} textAnchor="middle">
                {format(values[peak] ?? 0)}
              </text>
            )}

            {kind === 'line' && (
              <>
                <path className="area" d={areaPath} />
                <path className="line" d={linePath} />
                <circle className="dot" cx={cx(n - 1)} cy={y(values[n - 1] ?? 0)} r={4} />
                <text className="direct-label" x={cx(n - 1) + 0.6 * rem} y={y(values[n - 1] ?? 0)} dy="0.32em">
                  {lastLabel}
                </text>
              </>
            )}

            {kind === 'line' && active !== null && (
              <>
                <line className="crosshair" x1={cx(active)} x2={cx(active)} y1={m.top} y2={baseline} />
                <circle className="dot" cx={cx(active)} cy={y(values[active] ?? 0)} r={4} />
              </>
            )}

            {/* hit targets */}
            {kind === 'columns'
              ? values.map((_, i) => (
                  <rect
                    key={`hit-${months[i]}`}
                    className="hit"
                    x={m.left + step * i}
                    y={m.top}
                    width={step}
                    height={plotH}
                    onPointerEnter={() => setActive(i)}
                  />
                ))
              : (
                <rect className="hit" x={m.left} y={m.top} width={plotW} height={plotH} onPointerMove={onPointerMove} onPointerEnter={onPointerMove} />
              )}
          </svg>
          {active !== null && (
            <ChartTooltip
              x={cx(active)}
              y={kind === 'line' ? y(values[active] ?? 0) : Math.min(y(values[active] ?? 0), baseline - 1.5 * rem)}
              width={width}
            >
              {activeInfo}
            </ChartTooltip>
          )}
        </div>
      )}
      <p className="visually-hidden" aria-live="polite">{liveText}</p>
    </div>
  );
}
