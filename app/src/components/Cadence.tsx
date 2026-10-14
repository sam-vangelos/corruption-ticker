import type { CadenceDay } from '../data/metrics';
import { dayToIso } from '../data/dates';
import { formatInt, plural } from '../data/format';

interface CadenceProps {
  days: CadenceDay[];
  onOpen: (id: string, opener: HTMLElement) => void;
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

function parts(day: number) {
  const d = new Date(day * 86_400_000);
  return { wd: d.getUTCDay(), date: d.getUTCDate(), month: d.getUTCMonth() };
}

/**
 * Seven columns, one per calendar day (viewer's zone), today last. Each mark
 * is one qualifying record added to the record that day by
 * `first_published_at`; the event's own date plays no part. Every mark is a
 * link to its record page, so the strip is keyboard-reachable and opens the
 * same drawer as a card. No animation, so nothing to reduce.
 */
export function Cadence({ days, onOpen }: CadenceProps) {
  const total = days.reduce((s, d) => s + d.items.length, 0);
  const last = days.length - 1;
  return (
    <figure className="cadence" aria-labelledby="cadence-h">
      <figcaption className="cadence__head">
        <h2 id="cadence-h" className="cadence__title">Records added to the record, last seven days</h2>
        <p className="cadence__note">
          {plural(total, 'qualifying record')} added, by the day each was first published here. Event dates are
          separate: a record added today can describe conduct from 2025.
        </p>
      </figcaption>
      <ol className="cadence__days">
        {days.map((col, i) => {
          const p = parts(col.day);
          const showMonth = i === 0 || p.date === 1;
          const spoken = `${i === last ? 'Today, ' : ''}${WEEKDAY_LONG[p.wd]} ${p.date} ${MONTH_LONG[p.month]}`;
          return (
            <li key={col.day} className="cadence__day" data-today={i === last || undefined}>
              <p className="cadence__count" aria-hidden="true">{formatInt(col.items.length)}</p>
              <ul className="cadence__marks" aria-label={`${spoken}: ${plural(col.items.length, 'record')} added`}>
                {col.items.map((it) => (
                  <li key={it.id}>
                    <a
                      className="cadence__mark"
                      href={`/r/${encodeURIComponent(it.id)}/`}
                      title={it.title}
                      onClick={(e) => {
                        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                        e.preventDefault();
                        onOpen(it.id, e.currentTarget);
                      }}
                    >
                      <span className="visually-hidden">{it.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="cadence__label" aria-hidden="true">
                <time dateTime={dayToIso(col.day)}>
                  <span className="cadence__wd">{i === last ? 'Today' : WEEKDAY[p.wd]}</span>
                  <span className="cadence__date">{showMonth ? `${p.date} ${MONTH[p.month]}` : p.date}</span>
                </time>
              </p>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
