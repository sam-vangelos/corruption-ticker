import { useState } from 'react';
import {
  ACTOR_ROLES, ACTUAL_OR_ESTIMATED, AMOUNT_TYPES, CATEGORIES, EVIDENCE_GRADES, EVIDENTIARY_STATUSES,
  PROCEDURAL_STATUSES, RUBRIC_PRONGS, SOURCE_KINDS, SUBJECT_RESPONSES,
} from '../types';
import { CATEGORY_LABEL } from '../categories';
import { EVIDENTIARY_LABEL, PROCEDURAL_LABEL, RESPONSE_LABEL } from '../status';
import { AMOUNT_TYPE_LABEL, SOURCE_KIND_LABEL } from '../amounts';
import { gradeLabel } from '../method';
import type { RecordState } from './api';

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : {});

interface ActorRow { name: string; role: string }
interface SourceRow { outlet: string; title: string; url: string; archive_url: string; date: string; author: string; kind: string }
interface AmountRow { usd: string; amount_type: string; actual_or_estimated: string; basis: string; overlap_group: string }

interface Form {
  title: string; summary: string; date: string; date_precision: string; category: string;
  rubric_prong: string; rubric_evidence: string; evidence_grade: string; evidence_note: string;
  evidentiary_status: string; procedural_status: string; subject_response: string; status_note: string;
  actors: ActorRow[]; entities: string[]; offices: string[]; sources: SourceRow[]; amounts: AmountRow[];
}

function toForm(r: Raw): Form {
  const roles = obj(r.actor_roles);
  return {
    title: str(r.title), summary: str(r.summary), date: str(r.date), date_precision: str(r.date_precision) || 'day',
    category: str(r.category), rubric_prong: str(r.rubric_prong), rubric_evidence: str(r.rubric_evidence),
    evidence_grade: str(r.evidence_grade), evidence_note: str(r.evidence_note),
    evidentiary_status: str(r.evidentiary_status), procedural_status: str(r.procedural_status),
    subject_response: r.subject_response === null || r.subject_response === undefined ? '' : str(r.subject_response),
    status_note: str(r.status_note),
    actors: arr(r.actors).map((a) => ({ name: str(a), role: str(roles[str(a)]) })),
    entities: arr(r.entities).map(str),
    offices: arr(r.offices).map(str),
    sources: arr(r.sources).map((s) => {
      const o = obj(s);
      return { outlet: str(o.outlet), title: str(o.title), url: str(o.url), archive_url: str(o.archive_url), date: str(o.date), author: str(o.author), kind: str(o.kind) };
    }),
    amounts: arr(r.amounts).map((a) => {
      const o = obj(a);
      return { usd: str(o.usd), amount_type: str(o.amount_type), actual_or_estimated: str(o.actual_or_estimated), basis: str(o.basis), overlap_group: str(o.overlap_group) };
    }),
  };
}

/** The patch the form describes, in schema shapes. Values are sent as typed; the server validates. */
export function toPatch(f: Form): Raw {
  const grade = Number(f.evidence_grade);
  const actors = f.actors.map((a) => a.name);
  return {
    title: f.title,
    summary: f.summary,
    date: f.date,
    date_precision: f.date_precision,
    category: f.category,
    rubric_prong: f.rubric_prong,
    rubric_evidence: f.rubric_evidence,
    evidence_grade: f.evidence_grade !== '' && Number.isInteger(grade) ? grade : f.evidence_grade,
    evidence_note: f.evidence_note,
    evidentiary_status: f.evidentiary_status,
    procedural_status: f.procedural_status,
    subject_response: f.subject_response === '' ? null : f.subject_response,
    status_note: f.status_note.trim() === '' ? null : f.status_note,
    actors,
    actor_roles: Object.fromEntries(f.actors.map((a) => [a.name, a.role])),
    entities: f.entities,
    offices: f.offices,
    sources: f.sources.map((s) => ({ outlet: s.outlet, title: s.title, url: s.url, archive_url: s.archive_url, date: s.date, author: s.author, kind: s.kind })),
    amounts: f.amounts.map((a) => {
      const usd = Number(a.usd);
      return {
        usd: a.usd.trim() !== '' && Number.isFinite(usd) ? usd : a.usd,
        amount_type: a.amount_type,
        actual_or_estimated: a.actual_or_estimated,
        basis: a.basis,
        overlap_group: a.overlap_group.trim() === '' ? null : a.overlap_group,
      };
    }),
  };
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<[string, string]> }) {
  const known = options.some(([v]) => v === value);
  return (
    <label className="rqe-field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {!known && <option value={value}>{value ? `${value} (invalid)` : '(choose)'}</option>}
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function Text({ label, value, onChange, multiline = false, type = 'text', name }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; type?: string; name?: string }) {
  return (
    <label className="rqe-field">
      <span>{label}</span>
      {multiline
        ? <textarea name={name} rows={4} value={value} onChange={(e) => onChange(e.target.value)} />
        : <input name={name} type={type} value={value} onChange={(e) => onChange(e.target.value)} />}
    </label>
  );
}

interface ReviewEditProps {
  state: RecordState;
  busy: boolean;
  onSave: (patch: Raw) => void;
  onCancel: () => void;
}

/**
 * Edit mode: a form over the schema fields (never raw JSON). Saving sends a
 * patch to /__review/edit, which clears the approval, re-validates and
 * re-lints; the record stays unapproved until the editor presses a.
 */
export function ReviewEdit({ state, busy, onSave, onCancel }: ReviewEditProps) {
  const [f, setF] = useState<Form>(() => toForm(state.record));
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const setRow = <K extends 'actors' | 'sources' | 'amounts'>(k: K, i: number, patch: Partial<Form[K][number]>) =>
    setF((x) => ({ ...x, [k]: (x[k] as Array<Form[K][number]>).map((row, j) => (j === i ? { ...row, ...patch } : row)) }));
  const removeRow = (k: 'actors' | 'sources' | 'amounts' | 'entities' | 'offices', i: number) =>
    setF((x) => ({ ...x, [k]: (x[k] as unknown[]).filter((_, j) => j !== i) }));

  const opts = <T extends string>(values: readonly T[], label?: Record<T, string>): Array<[string, string]> => values.map((v) => [v, label ? label[v] : v]);

  return (
    <form
      className="rq-edit"
      aria-label={`Edit ${state.id}`}
      onSubmit={(e) => { e.preventDefault(); onSave(toPatch(f)); }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSave(toPatch(f)); }
      }}
    >
      <p className="rq-dim">Editing <code>{state.id}</code>. Saving clears any approval and re-validates; approve with <kbd className="kbd">a</kbd> afterwards. <kbd className="kbd">Ctrl</kbd>+<kbd className="kbd">Enter</kbd> saves, <kbd className="kbd">Esc</kbd> cancels.</p>

      <fieldset className="rqe-group"><legend>Text</legend>
        <Text name="title" label="Title" value={f.title} onChange={(v) => set('title', v)} />
        <Text name="summary" label="Summary (opens with the grade's verb)" value={f.summary} onChange={(v) => set('summary', v)} multiline />
        <Text name="evidence_note" label="Evidence note" value={f.evidence_note} onChange={(v) => set('evidence_note', v)} multiline />
        <Text name="rubric_evidence" label="Rubric evidence" value={f.rubric_evidence} onChange={(v) => set('rubric_evidence', v)} />
        <Text name="status_note" label="Status note (blank for none)" value={f.status_note} onChange={(v) => set('status_note', v)} />
      </fieldset>

      <fieldset className="rqe-group rqe-grid"><legend>Classification</legend>
        <Text name="date" label="Date" type="date" value={f.date} onChange={(v) => set('date', v)} />
        <Select label="Date precision" value={f.date_precision} onChange={(v) => set('date_precision', v)} options={[['day', 'day'], ['month', 'month (use the 1st)']]} />
        <Select label="Category" value={f.category} onChange={(v) => set('category', v)} options={opts(CATEGORIES, CATEGORY_LABEL)} />
        <Select label="Rubric prong" value={f.rubric_prong} onChange={(v) => set('rubric_prong', v)} options={opts(RUBRIC_PRONGS)} />
        <Select label="Evidence grade" value={f.evidence_grade} onChange={(v) => set('evidence_grade', v)} options={EVIDENCE_GRADES.map((g) => [String(g), gradeLabel(g)])} />
        <Select label="Evidentiary status" value={f.evidentiary_status} onChange={(v) => set('evidentiary_status', v)} options={opts(EVIDENTIARY_STATUSES, EVIDENTIARY_LABEL)} />
        <Select label="Procedural status" value={f.procedural_status} onChange={(v) => set('procedural_status', v)} options={opts(PROCEDURAL_STATUSES, PROCEDURAL_LABEL)} />
        <Select label="Subject response" value={f.subject_response} onChange={(v) => set('subject_response', v)}
          options={[['', RESPONSE_LABEL.none], ...opts(SUBJECT_RESPONSES, RESPONSE_LABEL as Record<(typeof SUBJECT_RESPONSES)[number], string>)]} />
      </fieldset>

      <fieldset className="rqe-group"><legend>Actors (each with a role)</legend>
        {f.actors.map((a, i) => (
          <div className="rqe-row" key={i}>
            <input aria-label={`Actor ${i + 1} name`} value={a.name} onChange={(e) => setRow('actors', i, { name: e.target.value })} />
            <select aria-label={`Actor ${i + 1} role`} value={a.role} onChange={(e) => setRow('actors', i, { role: e.target.value })}>
              {!(ACTOR_ROLES as readonly string[]).includes(a.role) && <option value={a.role}>{a.role || '(choose)'}</option>}
              {ACTOR_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button type="button" className="button" onClick={() => removeRow('actors', i)}>Remove</button>
          </div>
        ))}
        <button type="button" className="button" onClick={() => set('actors', [...f.actors, { name: '', role: 'public-official' }])}>Add actor</button>
      </fieldset>

      {(['entities', 'offices'] as const).map((k) => (
        <fieldset className="rqe-group" key={k}><legend>{k === 'entities' ? 'Entities' : 'Offices'}</legend>
          {f[k].map((v, i) => (
            <div className="rqe-row" key={i}>
              <input aria-label={`${k} ${i + 1}`} value={v} onChange={(e) => set(k, f[k].map((x, j) => (j === i ? e.target.value : x)))} />
              <button type="button" className="button" onClick={() => removeRow(k, i)}>Remove</button>
            </div>
          ))}
          <button type="button" className="button" onClick={() => set(k, [...f[k], ''])}>Add {k === 'entities' ? 'entity' : 'office'}</button>
        </fieldset>
      ))}

      <fieldset className="rqe-group"><legend>Sources</legend>
        {f.sources.map((s, i) => (
          <div className="rqe-card" key={i} data-source-index={i}>
            <div className="rqe-grid">
              <Text label="Outlet" value={s.outlet} onChange={(v) => setRow('sources', i, { outlet: v })} />
              <Select label="Kind" value={s.kind} onChange={(v) => setRow('sources', i, { kind: v })} options={opts(SOURCE_KINDS, SOURCE_KIND_LABEL)} />
              <Text label="Date" type="date" value={s.date} onChange={(v) => setRow('sources', i, { date: v })} />
              <Text label="Author" value={s.author} onChange={(v) => setRow('sources', i, { author: v })} />
            </div>
            <Text label="Headline" value={s.title} onChange={(v) => setRow('sources', i, { title: v })} />
            <Text label="URL" type="url" value={s.url} onChange={(v) => setRow('sources', i, { url: v })} />
            <Text label="Archive URL" type="url" value={s.archive_url} onChange={(v) => setRow('sources', i, { archive_url: v })} />
            <button type="button" className="button" onClick={() => removeRow('sources', i)}>Remove source</button>
          </div>
        ))}
        <button type="button" className="button" onClick={() => set('sources', [...f.sources, { outlet: '', title: '', url: '', archive_url: '', date: '', author: '', kind: 'news' }])}>Add source</button>
      </fieldset>

      <fieldset className="rqe-group"><legend>Amounts</legend>
        {f.amounts.map((a, i) => (
          <div className="rqe-card" key={i}>
            <div className="rqe-grid">
              <Text label="USD" type="number" value={a.usd} onChange={(v) => setRow('amounts', i, { usd: v })} />
              <Select label="Type" value={a.amount_type} onChange={(v) => setRow('amounts', i, { amount_type: v })} options={opts(AMOUNT_TYPES, AMOUNT_TYPE_LABEL)} />
              <Select label="Actual or estimated" value={a.actual_or_estimated} onChange={(v) => setRow('amounts', i, { actual_or_estimated: v })} options={opts(ACTUAL_OR_ESTIMATED)} />
              <Text label="Overlap group (blank for none)" value={a.overlap_group} onChange={(v) => setRow('amounts', i, { overlap_group: v })} />
            </div>
            <Text label="Basis" value={a.basis} onChange={(v) => setRow('amounts', i, { basis: v })} />
            <button type="button" className="button" onClick={() => removeRow('amounts', i)}>Remove amount</button>
          </div>
        ))}
        <button type="button" className="button" onClick={() => set('amounts', [...f.amounts, { usd: '', amount_type: 'private-benefit', actual_or_estimated: 'actual', basis: '', overlap_group: '' }])}>Add amount</button>
      </fieldset>

      <div className="rq-actions">
        <button type="submit" className="button rq-save" disabled={busy}>Save (re-validate)</button>
        <button type="button" className="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
