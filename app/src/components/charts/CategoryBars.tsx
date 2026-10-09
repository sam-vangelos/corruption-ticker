import { useRef } from 'react';
import type { Category } from '../../types';
import { CATEGORY_LABEL, categoryColor, glyphShape } from '../../categories';
import { barPath, linear, niceTicks, textWidth } from './scale';
import { useRem, useWidth } from './hooks';
import { useActive } from './useActive';
import { ChartTooltip } from './Tooltip';
import { formatInt } from '../../data/format';

interface CategoryBarsProps {
  rows: Array<{ category: Category; count: number }>;
  total: number;
}

/**
 * Horizontal bars, sorted largest first. Nominal categories: one ink for every
 * bar (no value ramp); identity rides the label and glyph beside each bar.
 * Value at each bar's tip. Rows are hit targets; arrow keys step through them.
 */
export function CategoryBars({ rows, total }: CategoryBarsProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useWidth(wrapRef);
  const rem = useRem();
  const n = rows.length;
  const { active, setActive, focused, plotProps } = useActive(n, 'vertical');

  const font = 0.8125 * rem;
  const max = Math.max(0, ...rows.map((r) => r.count));
  const ticks = niceTicks(max, 4);
  const top = ticks[ticks.length - 1] ?? 1;
  const longest = Math.max(...rows.map((r) => textWidth(CATEGORY_LABEL[r.category], font)));
  const stacked = width < 30 * rem; // narrow: label sits above its bar
  const labelCol = stacked ? 0 : longest + 1.75 * rem;
  const m = { top: 0.25 * rem, right: 2.5 * rem, bottom: 1.75 * rem, left: labelCol };
  const barH = Math.min(24, 0.875 * rem);
  const rowH = stacked ? 2.75 * rem : 1.875 * rem;
  const plotH = rowH * n;
  const height = m.top + plotH + m.bottom;
  const plotW = Math.max(10, width - m.left - m.right);
  const x = linear(0, top, m.left, m.left + plotW);
  const rowTop = (i: number) => m.top + rowH * i;
  const barY = (i: number) => rowTop(i) + rowH - barH - (stacked ? 0.35 * rem : (rowH - barH) / 2);

  const describe = (i: number) => {
    const r = rows[i];
    if (!r) return { value: '', label: '' };
    const pct = total ? Math.round((r.count / total) * 100) : 0;
    return { value: `${formatInt(r.count)} ${r.count === 1 ? 'item' : 'items'}`, label: CATEGORY_LABEL[r.category], extra: `${pct}% of the items shown` };
  };
  const liveText = focused && active !== null ? (() => { const d = describe(active); return `${d.label}: ${d.value}. ${d.extra}`; })() : '';

  return (
    <div className="plot" ref={wrapRef}>
      {width > 0 && (
        <div
          className="plot__focus"
          role="group"
          aria-label="Items by category. Use the up and down arrow keys to read each category."
          {...plotProps}
        >
          <svg className="plot__svg" width={width} height={height} aria-hidden="true" focusable="false">
            {ticks.map((t) => (
              <g key={t}>
                <line className={t === 0 ? 'axis-base' : 'grid'} x1={x(t)} x2={x(t)} y1={m.top} y2={m.top + plotH} />
                <text className="tick" x={x(t)} y={m.top + plotH + 1.1 * rem} textAnchor="middle">{formatInt(t)}</text>
              </g>
            ))}
            {rows.map((r, i) => {
              const by = barY(i);
              const labelY = stacked ? rowTop(i) + 0.95 * rem : by + barH / 2;
              const labelX = stacked ? m.left : 1.25 * rem;
              return (
                <g key={r.category} data-active={active === i || undefined}>
                  <svg
                    x={stacked ? m.left : 0}
                    y={labelY - 0.40625 * rem}
                    width={0.8125 * rem}
                    height={0.8125 * rem}
                    viewBox="0 0 12 12"
                    overflow="visible"
                    style={{ fill: categoryColor(r.category) }}
                  >
                    {glyphShape(r.category)}
                  </svg>
                  <text className="row-label" x={labelX + (stacked ? 1.25 * rem : 0)} y={labelY} dy="0.32em">
                    {CATEGORY_LABEL[r.category]}
                  </text>
                  <path className="mark" data-active={active === i || undefined} d={barPath(m.left, by, x(r.count) - m.left, barH)} />
                  <text className="direct-label" x={x(r.count) + 0.4 * rem} y={by + barH / 2} dy="0.32em">
                    {formatInt(r.count)}
                  </text>
                  <rect className="hit" x={0} y={rowTop(i)} width={width} height={rowH} onPointerEnter={() => setActive(i)} />
                </g>
              );
            })}
          </svg>
          {active !== null && (
            <ChartTooltip x={x(rows[active]?.count ?? 0)} y={barY(active) + barH / 2} width={width}>
              {(() => { const d = describe(active); return (<><span className="chart-tip__value">{d.value}</span><span className="chart-tip__label">{d.label}</span><span className="chart-tip__extra">{d.extra}</span></>); })()}
            </ChartTooltip>
          )}
        </div>
      )}
      <p className="visually-hidden" aria-live="polite">{liveText}</p>
    </div>
  );
}
