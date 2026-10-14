import type { Item } from '../../types';
import { CATEGORY_LABEL, CategoryGlyph } from '../../categories';
import { FEED_LIMIT, MAIN_FEED, feedIndex } from '../../feeds';
import { plural } from '../../data/format';
import { qualifyingOnly } from '../../data/metrics';
import { Page } from './Page';

/** /subscribe: the Atom feeds the build writes, one for everything and one per office and category. */
export function SubscribePage({ items }: { items: Item[] | null }) {
  // Feeds and their counts cover qualifying records only, as the feeds themselves do.
  const index = items ? feedIndex(qualifyingOnly(items)) : null;
  const abs = (p: string) => `${window.location.origin}${p}`;
  return (
    <Page
      title="Subscribe"
      lead={<p>Atom feeds of the qualifying records, newest first, {FEED_LIMIT} records each; leads and retracted records are not in them. Paste a feed address into any feed reader. Each entry links to the record's permanent page and states its evidence grade and its three statuses.</p>}
    >
      <section className="page__section" aria-labelledby="feed-all">
        <h2 id="feed-all">Everything</h2>
        <p><a href={MAIN_FEED}>Every new qualifying record</a> <code className="feed-url">{abs(MAIN_FEED)}</code></p>
      </section>
      {!index ? (
        <p aria-live="polite">The per-office and per-category feeds are listed once the dataset loads.</p>
      ) : (
        <>
          <section className="page__section" aria-labelledby="feed-office">
            <h2 id="feed-office">By office</h2>
            <ul className="feeds">
              {index.offices.map((o) => (
                <li key={o.slug}>
                  <a href={o.path}>{o.label}</a> <span className="drawer__muted">{plural(o.count, 'record')}</span>
                  <code className="feed-url">{abs(o.path)}</code>
                </li>
              ))}
            </ul>
          </section>
          <section className="page__section" aria-labelledby="feed-category">
            <h2 id="feed-category">By category</h2>
            <ul className="feeds">
              {index.categories.map((c) => (
                <li key={c.slug}>
                  <span className="feeds__cat"><CategoryGlyph category={c.key} /><a href={c.path}>{CATEGORY_LABEL[c.key]}</a></span>{' '}
                  <span className="drawer__muted">{plural(c.count, 'record')}</span>
                  <code className="feed-url">{abs(c.path)}</code>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      <p className="drawer__muted">There is no email list yet; the feeds are the way to follow the record for now.</p>
    </Page>
  );
}
