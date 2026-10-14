import type { Item, LoadState } from '../../types';
import { gradeLabel } from '../../method';
import { followLink, recordPath } from '../../router';
import { MAIN_FEED } from '../../feeds';
import { Page } from './Page';

interface RecentPageProps {
  state: LoadState;
  nowMs: number;
}

const HOUR = 3_600_000;
const STAMP = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

interface Activity {
  item: Item;
  /** The latest addition or change inside the window. */
  at: number;
  what: 'Added' | 'Changed' | 'Added, then changed';
}

/** A record's latest activity no later than now: its addition, its last change, or both. */
function activity(it: Item, nowMs: number): Activity {
  const added = it.publishedMs <= nowMs ? it.publishedMs : null;
  const changed = it.modifiedMs !== null && it.modifiedMs <= nowMs && it.modifiedMs > it.publishedMs ? it.modifiedMs : null;
  if (changed !== null && added !== null && nowMs - added < 24 * HOUR) return { item: it, at: changed, what: 'Added, then changed' };
  if (changed !== null) return { item: it, at: changed, what: 'Changed' };
  return { item: it, at: added ?? -Infinity, what: 'Added' };
}

function Rows({ rows }: { rows: Activity[] }) {
  return (
    <ol className="recent">
      {rows.map(({ item, at, what }) => (
        <li key={item.id} className="recent__row">
          <p className="recent__meta">
            <span className="recent__what">{what}</span>{' '}
            <time dateTime={new Date(at).toISOString()}>{STAMP.format(at)}</time>
          </p>
          <a className="recent__title" href={recordPath(item.id)} onClick={(e) => followLink(e)}>{item.title}</a>
          <p className="recent__grade">
            {gradeLabel(item.evidence_grade)}
            {item.evidence_grade === 5 && <strong className="lead-tag">Lead, not counted</strong>}
            {item.evidentiary_status === 'retracted' && <strong className="lead-tag">Retracted, not counted</strong>}
          </p>
        </li>
      ))}
    </ol>
  );
}

/**
 * /recent: records added or changed in the last 24 hours, then the rest of
 * the last 7 days, by first_published_at and last_modified_at. Quiet days
 * stay quiet: an empty window says so plainly.
 */
export function RecentPage({ state, nowMs }: RecentPageProps) {
  if (state.kind !== 'ready') {
    return <Page title="Recent changes"><p aria-live="polite">{state.kind === 'loading' ? 'Loading the dataset.' : 'The dataset could not be loaded, so there is nothing to list.'}</p></Page>;
  }
  const all = state.items.map((it) => activity(it, nowMs)).sort((a, b) => b.at - a.at || a.item.id.localeCompare(b.item.id));
  const day = all.filter((a) => nowMs - a.at < 24 * HOUR);
  const week = all.filter((a) => nowMs - a.at >= 24 * HOUR && nowMs - a.at < 7 * 24 * HOUR);
  return (
    <Page
      title="Recent changes"
      lead={<p>What was added to the record or changed in it, newest first, with the time of each. Times are in your time zone. The same list arrives by <a href={MAIN_FEED}>Atom feed</a>.</p>}
    >
      <section className="page__section" aria-labelledby="last-24">
        <h2 id="last-24">Last 24 hours</h2>
        {day.length ? <Rows rows={day} /> : <p>Nothing added in the last 24 hours.</p>}
      </section>
      <section className="page__section" aria-labelledby="last-7">
        <h2 id="last-7">Earlier in the last 7 days</h2>
        {week.length ? <Rows rows={week} /> : <p>Nothing else added in the last 7 days.</p>}
      </section>
    </Page>
  );
}
