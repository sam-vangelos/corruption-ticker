import { useEffect, useId, useMemo, useState } from 'react';
import type { Item } from '../../types';
import { CATEGORIES } from '../../types';
import { CATEGORY_LABEL, CategoryGlyph } from '../../categories';
import { categorySeries, monthlySeries } from '../../data/derive';
import { monthKey, monthLabel, monthRange, monthShort } from '../../data/dates';
import { formatInt, formatUsd, formatUsdCompact, plural } from '../../data/format';
import { ChartCard } from './ChartCard';
import { MonthChart } from './MonthChart';
import { CategoryBars } from './CategoryBars';

interface ChartsPanelProps {
  /** The filtered slice. */
  items: Item[];
  /** Month window: first and last day number to cover. */
  fromDay: number;
  toDay: number;
}

const STORAGE_KEY = 'ct.chartsOpen';

/** Collapsible panel of four charts, each with a table view. Follows the active filters. */
export function ChartsPanel({ items, fromDay, toDay }: ChartsPanelProps) {
  const [open, setOpen] = useState(() => localStorage.getItem(STORAGE_KEY) !== '0');
  const regionId = useId();
  useEffect(() => { localStorage.setItem(STORAGE_KEY, open ? '1' : '0'); }, [open]);

  const months = useMemo(() => monthRange(fromDay, toDay), [fromDay, toDay]);
  const series = useMemo(() => monthlySeries(items, months), [items, months]);
  const cats = useMemo(() => categorySeries(items, CATEGORIES), [items]);
  const withDollar = useMemo(() => items.filter((it) => it.hasDollar).length, [items]);

  const span = months.length ? `${monthShort(months[0] ?? '')} to ${monthShort(months[months.length - 1] ?? '')}` : '';
  const startsAt = monthKey(fromDay);
  const priorCount = items.filter((it) => it.month < startsAt).length;

  return (
    <section className="charts" aria-labelledby={`${regionId}-h`}>
      <div className="charts__bar">
        <h2 id={`${regionId}-h`} className="charts__heading">
          <button type="button" className="charts__toggle" aria-expanded={open} aria-controls={regionId} onClick={() => setOpen((v) => !v)}>
            <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" focusable="false" className="charts__caret">
              <path d="M3 1.5L6.5 5 3 8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            Charts
          </button>
        </h2>
        <p className="charts__scope">{plural(items.length, 'item')}, {span}</p>
      </div>

      {open && (
        <div id={regionId} className="charts__grid">
          {items.length === 0 ? (
            <p className="charts__empty">No items to chart under these filters.</p>
          ) : (
            <>
              <ChartCard
                title="Items per month"
                subtitle={span}
                chart={
                  <MonthChart
                    kind="columns"
                    name="Items per month"
                    months={months}
                    values={series.map((b) => b.count)}
                    format={formatInt}
                    describe={(i) => ({ value: plural(series[i]?.count ?? 0, 'item'), label: monthLabel(months[i] ?? '') })}
                  />
                }
                table={
                  <DataTable
                    caption="Items per month"
                    head={['Month', 'Items']}
                    rows={series.map((b) => [monthLabel(b.month), formatInt(b.count)])}
                  />
                }
              />

              <ChartCard
                title="Cumulative items"
                subtitle={priorCount ? `Running total, including ${plural(priorCount, 'item')} dated before ${monthShort(startsAt)}` : 'Running total at the end of each month'}
                chart={
                  <MonthChart
                    kind="line"
                    name="Cumulative items"
                    months={months}
                    values={series.map((b) => b.cumulative)}
                    format={formatInt}
                    describe={(i) => ({ value: plural(series[i]?.cumulative ?? 0, 'item'), label: `Through ${monthLabel(months[i] ?? '')}`, extra: `${formatInt(series[i]?.count ?? 0)} added that month` })}
                  />
                }
                table={
                  <DataTable
                    caption="Cumulative items"
                    head={['Month', 'Added', 'Running total']}
                    rows={series.map((b) => [monthLabel(b.month), formatInt(b.count), formatInt(b.cumulative)])}
                  />
                }
              />

              <ChartCard
                title="Items by category"
                subtitle="Largest first"
                chart={<CategoryBars rows={cats} total={items.length} />}
                table={
                  <DataTable
                    caption="Items by category"
                    head={['Category', 'Items', 'Share']}
                    rows={cats.map((r) => [
                      <span className="table-cat" key={r.category}><CategoryGlyph category={r.category} />{CATEGORY_LABEL[r.category]}</span>,
                      formatInt(r.count),
                      `${items.length ? Math.round((r.count / items.length) * 100) : 0}%`,
                    ])}
                  />
                }
              />

              <ChartCard
                title="Cumulative reported dollars"
                subtitle={`From ${formatInt(withDollar)} of ${plural(items.length, 'item')} that carry a figure; as reported, not adjudicated`}
                chart={
                  <MonthChart
                    kind="line"
                    name="Cumulative reported dollars"
                    months={months}
                    values={series.map((b) => b.cumDollars)}
                    format={formatUsdCompact}
                    describe={(i) => ({ value: formatUsdCompact(series[i]?.cumDollars ?? 0), label: `Through ${monthLabel(months[i] ?? '')}`, extra: `${formatUsdCompact(series[i]?.dollars ?? 0)} added that month` })}
                  />
                }
                table={
                  <DataTable
                    caption="Cumulative reported dollars"
                    head={['Month', 'Added', 'Running total']}
                    rows={series.map((b) => [monthLabel(b.month), formatUsd(b.dollars), formatUsd(b.cumDollars)])}
                  />
                }
              />
            </>
          )}
        </div>
      )}
    </section>
  );
}

function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label={`${caption} table`}>
      <table className="data-table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>{head.map((h, i) => <th key={h} scope="col" className={i ? 'num' : undefined}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (ci === 0
                ? <th key={ci} scope="row">{c}</th>
                : <td key={ci} className="num">{c}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
