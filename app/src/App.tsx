import { useEffect, useMemo, useState } from 'react';
import type { LoadState } from './types';
import { loadEntries } from './data/load';
import { buildIndexes, computeStats } from './data/derive';
import { inaugurationDay, today } from './data/dates';
import { plural } from './data/format';
import { StatePanel } from './components/StatePanel';
import { Ticker } from './components/Ticker';
import { Counters } from './components/Counters';

export function App() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    let live = true;
    loadEntries().then((s) => { if (live) setState(s); });
    return () => { live = false; };
  }, []);

  const items = state.kind === 'ready' ? state.items : null;
  const indexes = useMemo(() => (items ? buildIndexes(items) : null), [items]);
  const isPlaceholder = !!items && items.some((it) => it.placeholder);
  const now = useMemo(() => today(), []);
  const stats = useMemo(
    () => (items ? computeStats(items, { now, inauguration: inaugurationDay() }) : null),
    [items, now],
  );
  const openItem = (id: string, opener: HTMLElement) => {
    // Placeholder until the detail drawer lands (commit 5 of the build).
    void id; void opener;
  };

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

      <main id="main" className="main">
        {state.kind !== 'ready' ? (
          <StatePanel state={state} />
        ) : (
          <>
            {state.skipped.length > 0 && (
              <p className="skip-notice" role="note">
                {plural(state.skipped.length, 'record')} in the file failed validation and{' '}
                {state.skipped.length === 1 ? 'is' : 'are'} not shown:{' '}
                {state.skipped.slice(0, 5).map((s) => `#${s.index}${s.id ? ` (${s.id})` : ''}: ${s.reason}`).join('; ')}
                {state.skipped.length > 5 ? '; and more.' : '.'}
              </p>
            )}
            {stats && <Counters stats={stats} overall={indexes?.byId.size ?? 0} filtered={false} />}
          </>
        )}
      </main>
    </div>
  );
}
