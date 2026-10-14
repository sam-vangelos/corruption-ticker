import type { CorrectionsState, Item } from '../../types';
import { correctionDate, fieldLabel, valueLabel } from '../../corrections';
import { followLink } from '../../router';
import { Page } from './Page';

interface CorrectionsPageProps {
  corrections: CorrectionsState;
  byId: Map<string, Item> | null;
  /** Href for a record link (the record page once it exists). */
  recordHref: (id: string) => string;
}

/** /corrections: every post-publication change, newest first (schema v2 editorial rules). */
export function CorrectionsPage({ corrections, byId, recordHref }: CorrectionsPageProps) {
  return (
    <Page
      title="Corrections"
      lead={<p>Every change made to a record after it was published, newest first: the field, what it said, what it says now, and why.</p>}
    >
      {corrections.kind === 'loading' && <p aria-live="polite">Loading the corrections log.</p>}
      {corrections.kind === 'unavailable' && (
        <p className="state-panel" role="status">The corrections log could not be read. {corrections.detail}</p>
      )}
      {corrections.kind === 'ready' && (
        <>
          {corrections.corrections.some((c) => c.placeholder) && (
            <p className="drawer__placeholder" role="note">Placeholder corrections. Every entry below is fake and exists only to test the layout.</p>
          )}
          {corrections.corrections.length === 0 ? (
            <p>No record has been corrected.</p>
          ) : (
            <ol className="corrections">
              {corrections.corrections.map((c, i) => {
                const it = byId?.get(c.record_id) ?? null;
                return (
                  <li key={`${c.record_id}-${c.field}-${c.date}-${i}`} className="correction">
                    <p className="correction__meta">
                      <time dateTime={c.date}>{correctionDate(c)}</time>
                    </p>
                    <h2 className="correction__title">
                      {it
                        ? <a href={recordHref(c.record_id)} onClick={(e) => followLink(e)}>{it.title}</a>
                        : <span>{c.record_id} <span className="drawer__muted">(not in this dataset)</span></span>}
                    </h2>
                    <dl className="correction__facts">
                      <div><dt>Field</dt><dd>{fieldLabel(c.field)}</dd></div>
                      <div><dt>Was</dt><dd>{valueLabel(c.old_value)}</dd></div>
                      <div><dt>Now</dt><dd>{valueLabel(c.new_value)}</dd></div>
                      <div><dt>Reason</dt><dd>{c.reason}</dd></div>
                    </dl>
                  </li>
                );
              })}
            </ol>
          )}
          {corrections.skipped > 0 && (
            <p className="skip-notice" role="note">{corrections.skipped} malformed {corrections.skipped === 1 ? 'entry' : 'entries'} in the log could not be shown.</p>
          )}
        </>
      )}
    </Page>
  );
}
