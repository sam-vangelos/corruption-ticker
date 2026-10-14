import { useMemo } from 'react';
import type { Item } from '../types';
import { groupByMonth } from '../data/derive';
import { monthLabel } from '../data/dates';
import { plural } from '../data/format';
import { Card } from './Card';

interface StreamProps {
  items: Item[];
  onOpen: (id: string, opener: HTMLElement) => void;
  onActor: (actor: string) => void;
  onClear: () => void;
  filtered: boolean;
}

/**
 * Every record (leads and retractions included, labelled) under month
 * headers of the event date, newest first. Not virtualized: cards use
 * `content-visibility: auto`, so the browser skips layout and paint for
 * off-screen cards, which keeps 1,000+ cards smooth without windowing.
 */
export function Stream({ items, onOpen, onActor, onClear, filtered }: StreamProps) {
  const groups = useMemo(() => groupByMonth(items), [items]);

  if (items.length === 0) {
    return (
      <section className="stream stream--empty" aria-label="Records">
        <p>No records match these filters.</p>
        {filtered && (
          <button type="button" className="button" onClick={onClear}>Clear all filters</button>
        )}
      </section>
    );
  }

  return (
    <section className="stream" aria-label="Records, newest event first">
      {groups.map((g) => (
        <section key={g.month} className="month" aria-labelledby={`month-${g.month}`}>
          <h2 className="month__head" id={`month-${g.month}`}>
            <span>{monthLabel(g.month)}</span>
            <span className="month__count">{plural(g.items.length, 'record')}</span>
          </h2>
          <div className="month__cards">
            {g.items.map((it) => (
              <Card key={it.id} item={it} onOpen={onOpen} onActor={onActor} />
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}
