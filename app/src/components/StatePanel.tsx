import type { LoadState } from '../types';
import { DATA_URL } from '../data/load';

/** Honest loading / missing / invalid / empty states. Says what happened and what to do. */
export function StatePanel({ state }: { state: Exclude<LoadState, { kind: 'ready' }> }) {
  if (state.kind === 'loading') {
    return (
      <section className="state-panel" aria-live="polite" aria-busy="true">
        <p className="state-panel__lead">Loading the dataset from <code>{DATA_URL}</code>.</p>
      </section>
    );
  }
  const heading =
    state.kind === 'missing' ? 'No dataset found'
    : state.kind === 'invalid' ? 'The dataset could not be read'
    : 'The dataset is empty';
  const detail =
    state.kind === 'missing' || state.kind === 'invalid' ? state.detail
    : 'The file exists but contains no entries.';
  return (
    <section className="state-panel" role="status" aria-live="polite">
      <h2 className="state-panel__heading">{heading}</h2>
      <p className="state-panel__lead">
        The app reads <code>{DATA_URL}</code> at startup. {detail}
      </p>
      <p>
        To fix it, place a JSON array of entries that follows <code>docs/schema.md</code> at{' '}
        <code>app/public/data/entries.json</code> and reload. Nothing is shown until then, so no
        count, chart, or ticker on this page is ever invented.
      </p>
    </section>
  );
}
