import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Category, LoadState, Status } from './types';
import { loadEntries } from './data/load';
import { buildIndexes, computeStats, optionsFrom } from './data/derive';
import { inaugurationDay, parseDay, today } from './data/dates';
import { plural } from './data/format';
import { applyFilters, EMPTY_FILTERS, isFiltering, useUrlFilters } from './state/filters';
import { StatePanel } from './components/StatePanel';
import { Ticker } from './components/Ticker';
import { Counters } from './components/Counters';
import { FilterBar } from './components/FilterBar';
import { Stream } from './components/Stream';
import { ChartsPanel } from './components/charts/ChartsPanel';

export function App() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [filters, setFilters] = useUrlFilters();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    loadEntries().then((s) => { if (live) setState(s); });
    return () => { live = false; };
  }, []);

  const items = state.kind === 'ready' ? state.items : null;
  const now = useMemo(() => today(), []);

  // Indexes over the full dataset, computed once per load.
  const indexes = useMemo(() => (items ? buildIndexes(items) : null), [items]);
  const actorOptions = useMemo(() => (indexes ? optionsFrom(indexes.byActor) : []), [indexes]);
  const entityOptions = useMemo(() => (indexes ? optionsFrom(indexes.byEntity) : []), [indexes]);
  const categoryCounts = useMemo(() => {
    const m = new Map<Category, number>();
    indexes?.byCategory.forEach((list, k) => m.set(k, list.length));
    return m;
  }, [indexes]);
  const statusCounts = useMemo(() => {
    const m = new Map<Status, number>();
    items?.forEach((it) => m.set(it.status, (m.get(it.status) ?? 0) + 1));
    return m;
  }, [items]);

  // The active slice: counters, charts and the stream follow it; the ticker does not.
  const filtering = isFiltering(filters);
  const filtered = useMemo(() => (items ? applyFilters(items, filters) : []), [items, filters]);
  const stats = useMemo(
    () => (items
      ? computeStats(filtered, {
          now,
          inauguration: inaugurationDay(),
          from: filters.from ? parseDay(filters.from) : null,
          to: filters.to ? parseDay(filters.to) : null,
        })
      : null),
    [items, filtered, filters.from, filters.to, now],
  );

  const isPlaceholder = !!items && items.some((it) => it.placeholder);

  // Chart window: 20 Jan 2025 (or the earliest item, if older) through today
  // (or the latest item, if newer); a from/to filter narrows it.
  const chartWindow = useMemo(() => {
    const oldest = items && items.length ? (items[items.length - 1] as { day: number }).day : inaugurationDay();
    const newest = items && items.length ? (items[0] as { day: number }).day : now;
    const from = filters.from ? (parseDay(filters.from) ?? inaugurationDay()) : Math.min(inaugurationDay(), oldest);
    const to = filters.to ? (parseDay(filters.to) ?? now) : Math.max(now, newest);
    return { from, to: Math.max(from, to) };
  }, [items, filters.from, filters.to, now]);

  const openItem = useCallback((id: string, opener: HTMLElement) => {
    // Placeholder until the detail drawer lands (commit 5 of the build).
    void id; void opener;
  }, []);
  const addActor = useCallback((actor: string) => {
    setFilters((f) => (f.actors.includes(actor) ? f : { ...f, actors: [...f.actors, actor] }));
  }, [setFilters]);
  const clearFilters = useCallback(() => setFilters(EMPTY_FILTERS), [setFilters]);

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to the item list</a>
      {items && <Ticker items={items} onOpen={openItem} />}
      <header className="masthead">
        <div className="masthead__title">
          <h1>Corruption Ticker</h1>
          <p className="masthead__sub">
            Reported uses of public office for private gain since 20 January 2025, each traced to its sources.
          </p>
        </div>
      </header>

      {isPlaceholder && (
        <div className="frame">
          <p className="placeholder-notice" role="note">
            <strong>Placeholder data.</strong> Every entry on this page is fake and exists only to test the
            layout. None of it describes a real event, person, or organization.
          </p>
        </div>
      )}

      {state.kind !== 'ready' ? (
        <main id="main" className="main">
          <StatePanel state={state} />
        </main>
      ) : (
        <>
          <div className="frame">
            {state.skipped.length > 0 && (
              <p className="skip-notice" role="note">
                {plural(state.skipped.length, 'record')} in the file failed validation and{' '}
                {state.skipped.length === 1 ? 'is' : 'are'} not shown:{' '}
                {state.skipped.slice(0, 5).map((s) => `#${s.index}${s.id ? ` (${s.id})` : ''}: ${s.reason}`).join('; ')}
                {state.skipped.length > 5 ? '; and more.' : '.'}
              </p>
            )}
            <FilterBar
              ref={searchRef}
              filters={filters}
              onChange={setFilters}
              actorOptions={actorOptions}
              entityOptions={entityOptions}
              categoryCounts={categoryCounts}
              statusCounts={statusCounts}
              shown={filtered.length}
              total={state.items.length}
            />
            {stats && <Counters stats={stats} overall={state.items.length} filtered={filtering} />}
          </div>
          <div className="frame">
            <ChartsPanel items={filtered} fromDay={chartWindow.from} toDay={chartWindow.to} />
          </div>
          <main id="main" className="main" tabIndex={-1}>
            <Stream items={filtered} onOpen={openItem} onActor={addActor} onClear={clearFilters} filtered={filtering} />
          </main>
        </>
      )}
    </div>
  );
}
