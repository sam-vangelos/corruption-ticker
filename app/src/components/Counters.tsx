import { useId, useState } from 'react';
import type { Stats } from '../data/derive';
import { formatDate } from '../data/dates';
import { formatInt, formatRate, formatUsd, formatUsdCompact } from '../data/format';

interface CountersProps {
  stats: Stats;
  /** Size of the unfiltered dataset, for the "of N" context. */
  overall: number;
  filtered: boolean;
}

/** Five stat tiles. Values follow the active filters (days-since excepted). */
export function Counters({ stats, overall, filtered }: CountersProps) {
  const tipId = useId();
  const [tipOpen, setTipOpen] = useState(false);
  const windowWeeks = (stats.windowTo - stats.windowFrom + 1) / 7;

  return (
    <section className="counters" aria-labelledby="counters-h">
      <h2 id="counters-h" className="visually-hidden">{filtered ? 'Counts for the filtered items' : 'Counts for all items'}</h2>
      <div className="tile">
        <p className="tile__label">Days since 20 January 2025</p>
        <p className="tile__value">{formatInt(stats.daysSince)}</p>
        <p className="tile__note">As of {formatDate(stats.now)}</p>
      </div>

      <div className="tile">
        <p className="tile__label">Items</p>
        <p className="tile__value">{formatInt(stats.total)}</p>
        <p className="tile__note">{filtered ? `Of ${formatInt(overall)} in the dataset` : 'In the dataset'}</p>
      </div>

      <div className="tile">
        <p className="tile__label">Items per week</p>
        <p className="tile__value">{formatRate(stats.perWeek)}</p>
        <p className="tile__note">
          Over {formatRate(windowWeeks)} weeks from {formatDate(stats.windowFrom)}
        </p>
      </div>

      <div
        className="tile tile--tip"
        tabIndex={0}
        aria-describedby={tipId}
        onMouseEnter={() => setTipOpen(true)}
        onMouseLeave={() => setTipOpen(false)}
        onFocus={() => setTipOpen(true)}
        onBlur={() => setTipOpen(false)}
        onKeyDown={(e) => { if (e.key === 'Escape') setTipOpen(false); }}
      >
        <p className="tile__label">Reported dollars</p>
        <p className="tile__value" title={formatUsd(stats.dollars)}>
          {formatUsdCompact(stats.dollars)}
        </p>
        <p className="tile__note">
          From {formatInt(stats.withDollar)} of {formatInt(stats.total)} items
        </p>
        <p id={tipId} role="tooltip" className="tooltip tile__tip" data-open={tipOpen || undefined}>
          {formatInt(stats.withDollar)} of {formatInt(stats.total)} {stats.total === 1 ? 'item carries' : 'items carry'} a
          dollar figure, totalling {formatUsd(stats.dollars)}. Figures are summed as reported by the
          sources, not adjudicated, and separate items may describe overlapping money.
        </p>
      </div>

      <div className="tile">
        <p className="tile__label">Items in the last 30 days</p>
        <p className="tile__value">{formatInt(stats.last30)}</p>
        <p className="tile__note">Dated after {formatDate(stats.now - 30)}</p>
      </div>
    </section>
  );
}
