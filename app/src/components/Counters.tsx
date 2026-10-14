import type { Stats } from '../data/metrics';
import { formatDate } from '../data/dates';
import { formatInt } from '../data/format';

interface CountersProps {
  stats: Stats;
  filtered: boolean;
}

/**
 * Four counters. Values follow the active filters (days-since excepted) and
 * count qualifying records only: grade 1 to 4, not retracted. There is no
 * dollar total: figures of different kinds do not add up to one number.
 */
export function Counters({ stats, filtered }: CountersProps) {
  const scope = filtered ? 'Qualifying records in this filtered view' : 'Qualifying records';
  return (
    <section className="counters" aria-labelledby="counters-h">
      <h2 id="counters-h" className="visually-hidden">{filtered ? 'Counts for the filtered records' : 'Counts for all records'}</h2>
      <div className="tile">
        <p className="tile__label">Days since 20 January 2025</p>
        <p className="tile__value">{formatInt(stats.daysSince)}</p>
        <p className="tile__note">As of {formatDate(stats.now)}</p>
      </div>

      <div className="tile">
        <p className="tile__label">Records with a stated amount</p>
        <p className="tile__value">{formatInt(stats.withAmount)}</p>
        <p className="tile__note">Of {formatInt(stats.total)}. {scope}; amounts are not summed</p>
      </div>

      <div className="tile">
        <p className="tile__label">Records added in the last 30 days</p>
        <p className="tile__value">{formatInt(stats.added30)}</p>
        <p className="tile__note">By the date each was added to the record</p>
      </div>

      <div className="tile">
        <p className="tile__label">Records in investigation or litigation</p>
        <p className="tile__value">{formatInt(stats.inProcess)}</p>
        <p className="tile__note">By current procedural status</p>
      </div>
    </section>
  );
}
