import { useState } from 'react';
import type { Item } from '../../types';
import { COUNTING_RULES, GRADES, RUBRIC, citation, datasetVersion } from '../../method';
import { Page } from './Page';

interface MethodPageProps {
  /** The loaded dataset, or null while it loads or if it failed (the version then says so). */
  items: Item[] | null;
}

const LONG_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * /method. Everything on this page is rendered from src/method.ts, the same
 * constants the counting code reads, so the published rules and the
 * arithmetic cannot drift apart.
 */
export function MethodPage({ items }: MethodPageProps) {
  const version = items ? datasetVersion(items) : null;
  const cite = version ? citation(version, `${window.location.origin}/method`, LONG_DATE.format(new Date())) : null;
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');

  const copy = async () => {
    if (!cite) return;
    try {
      await navigator.clipboard.writeText(cite);
      setCopied('done');
    } catch {
      setCopied('failed');
    }
  };

  return (
    <Page
      title="How we count"
      lead={<p>The rules behind the headline. Every count on the front page follows from the definitions below, and the code that counts reads the same definitions this page prints.</p>}
    >
      <section className="page__section" aria-labelledby="grades">
        <h2 id="grades" tabIndex={-1}>Evidence grades</h2>
        <p>Each record carries one grade for the strength of the evidence behind its central claim. The grade sets the verb the record may use.</p>
        <div className="table-wrap table-wrap--page" tabIndex={0} role="region" aria-label="Evidence grades table">
          <table className="data-table method-grades">
            <caption className="visually-hidden">Evidence grades</caption>
            <thead>
              <tr>
                <th scope="col">Grade</th>
                <th scope="col">Meaning</th>
                <th scope="col">Verb</th>
                <th scope="col">Counts in metrics</th>
              </tr>
            </thead>
            <tbody>
              {GRADES.map((g) => (
                <tr key={g.grade}>
                  <th scope="row"><span className="grade-cell">{g.grade}</span></th>
                  <td>{g.meaning}</td>
                  <td>{g.verb}</td>
                  <td>{g.countsText}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="page__section" aria-labelledby="counting">
        <h2 id="counting" tabIndex={-1}>Counting rules</h2>
        <dl className="rules">
          {COUNTING_RULES.map((r) => (
            <div key={r.id} id={`rule-${r.id}`}>
              <dt>{r.title}</dt>
              <dd>{r.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="page__section" aria-labelledby="rubric">
        <h2 id="rubric" tabIndex={-1}>Inclusion rubric</h2>
        <p>A record is included when both the prong and the evidence hold.</p>
        <dl className="rules">
          {RUBRIC.map((r) => (
            <div key={r.id} id={`rubric-${r.id}`}>
              <dt>{r.title}</dt>
              <dd>
                {r.text}
                {r.items && <ul className="rules__list">{r.items.map((x) => <li key={x}>{x}</li>)}</ul>}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="page__section" aria-labelledby="cite">
        <h2 id="cite" tabIndex={-1}>Recommended citation</h2>
        {cite && version ? (
          <>
            <p>Dataset version <code className="version">{version}</code>. The version names the schema and the last time anything in the dataset was published or edited, so a footnote can point at a fixed state of the record.</p>
            <blockquote className="citation"><p>{cite}</p></blockquote>
            <p className="citation__actions">
              <button type="button" className="button" onClick={copy}>Copy citation</button>
              <span role="status" className="citation__status">
                {copied === 'done' ? 'Copied.' : copied === 'failed' ? 'Copying failed; select the text above instead.' : ''}
              </span>
            </p>
          </>
        ) : (
          <p className="drawer__muted">The citation needs the dataset, which has not loaded.</p>
        )}
      </section>
    </Page>
  );
}
