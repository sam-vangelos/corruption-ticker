import { useEffect, useState } from 'react';
import { CATEGORIES } from '../../types';
import { CATEGORY_LABEL, CategoryGlyph } from '../../categories';
import { FEEDS_MANIFEST, type FeedsManifest } from '../../feeds';
import { plural } from '../../data/format';
import { Page } from './Page';

type ManifestState = { kind: 'loading' } | { kind: 'unavailable' } | { kind: 'ready'; manifest: FeedsManifest };

/** A manifest is usable only when it has the shape the build writes. */
function isManifest(v: unknown): v is FeedsManifest {
  const m = v as FeedsManifest | null;
  return !!m && typeof m === 'object' && typeof m.main?.path === 'string' && Array.isArray(m.offices) && Array.isArray(m.categories)
    && m.categories.every((c) => (CATEGORIES as readonly string[]).includes(c.category));
}

/**
 * /subscribe: the Atom feeds the build wrote, read from dist/feeds/index.json.
 * The list is fixed at build time, so it always matches the feed files and
 * never depends on the reader's clock.
 */
export function SubscribePage() {
  const [state, setState] = useState<ManifestState>({ kind: 'loading' });
  useEffect(() => {
    let live = true;
    fetch(FEEDS_MANIFEST, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((v: unknown) => { if (live) setState(isManifest(v) ? { kind: 'ready', manifest: v } : { kind: 'unavailable' }); })
      .catch(() => { if (live) setState({ kind: 'unavailable' }); });
    return () => { live = false; };
  }, []);
  const abs = (p: string) => `${window.location.origin}${p}`;
  const limit = state.kind === 'ready' ? state.manifest.limit : 50;
  return (
    <Page
      title="Subscribe"
      lead={<p>Atom feeds of the qualifying records, newest first, {limit} records each; leads and retracted records are not in them. Paste a feed address into any feed reader. Each entry links to the record's permanent page and states its evidence grade and its three statuses.</p>}
    >
      {state.kind === 'loading' && <p aria-live="polite">Loading the list of feeds.</p>}
      {state.kind === 'unavailable' && (
        <p role="status">The list of feeds is written by the build and could not be read here. In development, run a build first.</p>
      )}
      {state.kind === 'ready' && (
        <>
          <section className="page__section" aria-labelledby="feed-all">
            <h2 id="feed-all">Everything</h2>
            <p>
              <a href={state.manifest.main.path}>Every new qualifying record</a>{' '}
              <span className="drawer__muted">{plural(state.manifest.main.count, 'record')}</span>
              <code className="feed-url">{abs(state.manifest.main.path)}</code>
            </p>
          </section>
          <section className="page__section" aria-labelledby="feed-office">
            <h2 id="feed-office">By office</h2>
            <ul className="feeds">
              {state.manifest.offices.map((o) => (
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
              {state.manifest.categories.map((c) => (
                <li key={c.slug}>
                  <span className="feeds__cat"><CategoryGlyph category={c.category} /><a href={c.path}>{CATEGORY_LABEL[c.category]}</a></span>{' '}
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
