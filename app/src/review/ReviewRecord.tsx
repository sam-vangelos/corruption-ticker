import type { ReactNode } from 'react';
import type { RecordState } from './api';
import { CATEGORY_LABEL } from '../categories';
import { EVIDENTIARY_LABEL, PROCEDURAL_LABEL, RESPONSE_LABEL } from '../status';
import { AMOUNT_TYPE_LABEL, SOURCE_KIND_LABEL } from '../amounts';
import { GRADES, gradeLabel } from '../method';
import { formatUsd } from '../data/format';
import type { AmountType, Category, EvidenceGrade, EvidentiaryStatus, ProceduralStatus, SourceKind, SubjectResponse } from '../types';

// A record in the queue may be invalid or half-filled, so every field is read
// defensively and shown as written when it is not a known value.
const str = (v: unknown) => (typeof v === 'string' ? v : v === null || v === undefined ? '' : JSON.stringify(v));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const label = <K extends string>(map: Record<K, string>, v: unknown) => (typeof v === 'string' && v in map ? map[v as K] : str(v) || '(missing)');

/** The summary with the grade's verb phrase marked where it first appears. */
function Summary({ text, grade }: { text: string; grade: unknown }) {
  const verb = GRADES.find((g) => g.grade === grade)?.verb;
  const at = verb ? text.toLowerCase().indexOf(verb) : -1;
  if (!verb || at < 0) return <p className="rq-summary">{text || <em>(no summary)</em>}</p>;
  return (
    <p className="rq-summary">
      {text.slice(0, at)}
      <mark className="rq-verb" title={`The grade ${String(grade)} verb`}>{text.slice(at, at + verb.length)}</mark>
      {text.slice(at + verb.length)}
    </p>
  );
}

function Field({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="rq-field">
      <dt>{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** One record, in the order the editor reads it. Render only. */
export function ReviewRecord({ state }: { state: RecordState }) {
  const r = state.record;
  const grade = r.evidence_grade;
  const gradeOk = typeof grade === 'number' && grade >= 1 && grade <= 5;
  const roles = obj(r.actor_roles);
  const problems = [...state.errors, ...(state.lint ? [state.lint] : [])];
  return (
    <article className="rq-record" aria-labelledby="rq-title">
      {problems.length > 0 && (
        <section className="rq-problems" role="alert" aria-label="Validation and lint">
          <h2 className="rq-problems__h">Cannot be approved until fixed by an edit</h2>
          <ul>
            {state.errors.map((e) => <li key={`v-${e}`}><strong>Validation:</strong> {e}</li>)}
            {state.lint && <li><strong>Language lint:</strong> {state.lint}</li>}
          </ul>
        </section>
      )}
      {state.rejected && (
        <p className="rq-rejected" role="note">
          Rejected {new Date(state.rejected.at).toLocaleString()}: {state.rejected.reason}
        </p>
      )}

      <p className="rq-meta">
        <code>{state.id}</code> · {str(r.date) || '(no date)'}{r.date_precision === 'month' ? ' (month)' : ''} · {label(CATEGORY_LABEL as Record<Category, string>, r.category)}
        {r.root_id ? <> · development of <code>{str(r.root_id)}</code></> : null}
        {r.placeholder === true ? ' · placeholder' : null}
      </p>
      <h1 className="rq-title" id="rq-title" tabIndex={-1}>{str(r.title) || '(no title)'}</h1>

      <Summary text={str(r.summary)} grade={grade} />

      <dl className="rq-fields">
        <Field k="Evidence grade">
          {gradeOk ? gradeLabel(grade as EvidenceGrade) : `(invalid: ${str(grade)})`}
          <p className="rq-note">{str(r.evidence_note) || '(no evidence note)'}</p>
        </Field>
        <Field k="Rubric">
          {r.rubric_prong === 'private-gain' ? 'Private gain' : r.rubric_prong === 'abuse-of-office' ? 'Abuse of office' : `(invalid: ${str(r.rubric_prong)})`}
          <p className="rq-note">{str(r.rubric_evidence) || '(no rubric evidence)'}</p>
        </Field>
        <Field k="Actors">
          {arr(r.actors).length === 0 ? '(none)' : (
            <ul className="rq-list">
              {arr(r.actors).map((a, i) => (
                <li key={`${str(a)}-${i}`}>{str(a)} <span className="rq-dim">{str(roles[str(a)]) || '(no role)'}</span></li>
              ))}
            </ul>
          )}
        </Field>
        <Field k="Sources">
          {arr(r.sources).length === 0 ? <span className="rq-bad">(none)</span> : (
            <ol className="rq-sources">
              {arr(r.sources).map((raw, i) => {
                const s = obj(raw);
                const archived = typeof s.archive_url === 'string' && s.archive_url.trim() !== '';
                return (
                  <li key={i} data-source-url={str(s.url)}>
                    <strong>{str(s.outlet) || '(no outlet)'}</strong>{' '}
                    <span className="rq-dim">{label(SOURCE_KIND_LABEL as Record<SourceKind, string>, s.kind)}{s.date ? `, ${str(s.date)}` : ''}</span>
                    <br />
                    {str(s.title) || '(no headline)'}
                    <br />
                    <a href={str(s.url)} target="_blank" rel="noopener noreferrer">{str(s.url) || '(no url)'}</a>
                    {' · '}
                    {archived
                      ? <a href={str(s.archive_url)} target="_blank" rel="noopener noreferrer">archived copy</a>
                      : <span className="rq-bad">no archive_url</span>}
                  </li>
                );
              })}
            </ol>
          )}
        </Field>
        <Field k="Amounts">
          {arr(r.amounts).length === 0 ? '(none)' : (
            <ul className="rq-list">
              {arr(r.amounts).map((raw, i) => {
                const a = obj(raw);
                return (
                  <li key={i}>
                    {typeof a.usd === 'number' ? formatUsd(a.usd) : `(invalid usd: ${str(a.usd)})`}{' '}
                    {label(AMOUNT_TYPE_LABEL as Record<AmountType, string>, a.amount_type)} ({str(a.actual_or_estimated) || 'actual or estimated?'})
                    {a.overlap_group ? <span className="rq-dim"> · overlap group {str(a.overlap_group)}</span> : null}
                    <p className="rq-note">{str(a.basis) || '(no basis)'}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </Field>
        <Field k="Status">
          Evidence: {label(EVIDENTIARY_LABEL as Record<EvidentiaryStatus, string>, r.evidentiary_status)} ·
          Procedure: {label(PROCEDURAL_LABEL as Record<ProceduralStatus, string>, r.procedural_status)} ·
          Response: {r.subject_response === null ? RESPONSE_LABEL.none : label(RESPONSE_LABEL as Record<SubjectResponse, string>, r.subject_response)}
          {r.status_note ? <p className="rq-note">{str(r.status_note)}</p> : null}
        </Field>
      </dl>
    </article>
  );
}
