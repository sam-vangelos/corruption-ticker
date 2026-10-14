import { useEffect, useId, useMemo, useState } from 'react';
import type { Item } from '../../types';
import { CATEGORIES } from '../../types';
import { CATEGORY_LABEL, CategoryGlyph } from '../../categories';
import { categorySeries, monthlySeries } from '../../data/derive';
import { monthKey, monthLabel, monthRange, monthShort } from '../../data/dates';
import { formatInt, plural } from '../../data/format';
import { ChartCard } from './ChartCard';
import { MonthChart } from './MonthChart';
import { CategoryBars } from './CategoryBars';

interface ChartsPanelProps {
  /** The filtered slice, qualifying records only (no grade-5 leads, nothing retracted). */
  items: Item[];
  /** Month window: first and last day number to cover. */
  fromDay: number;
  toDay: number;
}

const STORAGE_KEY = 'ct.chartsOpen';

/** Collapsible panel of three charts, each with a table view. Follows the active filters; counts qualifying records only. */
export function ChartsPanel({ items, fromDay, toDay }: ChartsPanelProps) {
  const [open, setOpen] = useState(() => localStorage.getItem(STORAGE_KEY) !== '0');
  const regionId = useId();
  useEffect(() => { localStorage.setItem(STORAGE_KEY, open ? '1' : '0'); }, [open]);

  const months = useMemo(() => monthRange(fromDay, toDay), [fromDay, toDay]);
  const series = useMemo(() => monthlySeries(items, months), [items, months]);
  const cats = useMemo(() => categorySeries(items, CATEGORIES), [items]);

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
        <p className="charts__scope">{plural(items.length, 'qualifying record')}, {span}, by event date. Leads and retracted records are not charted.</p>
      </div>

      {open && (
        <div id={regionId} className="charts__grid">
          {items.length === 0 ? (
            <p className="charts__empty">No qualifying records to chart under these filters.</p>
          ) : (
            <>
              <ChartCard
                title="Qualifying records per month"
                subtitle={span}
                chart={
                  <MonthChart
                    kind="columns"
                    name="Qualifying records per month"
                    months={months}
                    values={series.map((b) => b.count)}
                    format={formatInt}
                    describe={(i) => ({ value: plural(series[i]?.count ?? 0, 'record'), label: monthLabel(months[i] ?? '') })}
                  />
                }
                table={
                  <DataTable
                    caption="Qualifying records per month"
                    head={['Month', 'Records']}
                    rows={series.map((b) => [monthLabel(b.month), formatInt(b.count)])}
                  />
                }
              />

              <ChartCard
                title="Cumulative qualifying records"
                subtitle={priorCount ? `Running total, including ${plural(priorCount, 'record')} dated before ${monthShort(startsAt)}` : 'Running total at the end of each month'}
                chart={
                  <MonthChart
                    kind="line"
                    name="Cumulative qualifying records"
                    months={months}
                    values={series.map((b) => b.cumulative)}
                    format={formatInt}
                    describe={(i) => ({ value: plural(series[i]?.cumulative ?? 0, 'record'), label: `Through ${monthLabel(months[i] ?? '')}`, extra: `${formatInt(series[i]?.count ?? 0)} added that month` })}
                  />
                }
                table={
                  <DataTable
                    caption="Cumulative qualifying records"
                    head={['Month', 'Added', 'Running total']}
                    rows={series.map((b) => [monthLabel(b.month), formatInt(b.count), formatInt(b.cumulative)])}
                  />
                }
              />

              <ChartCard
                title="Qualifying records by category"
                subtitle="Largest first"
                chart={<CategoryBars rows={cats} total={items.length} />}
                table={
                  <DataTable
                    caption="Qualifying records by category"
                    head={['Category', 'Records', 'Share']}
                    rows={cats.map((r) => [
                      <span className="table-cat" key={r.category}><CategoryGlyph category={r.category} />{CATEGORY_LABEL[r.category]}</span>,
                      formatInt(r.count),
                      `${items.length ? Math.round((r.count / items.length) * 100) : 0}%`,
                    ])}
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
