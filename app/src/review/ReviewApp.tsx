import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { QueueView, RecordState } from './api';
import * as api from './api';
import { ReviewRecord } from './ReviewRecord';
import { ReviewEdit } from './ReviewEdit';
import { ReviewBatch } from './ReviewBatch';
import { CATEGORIES } from '../types';
import { CATEGORY_LABEL } from '../categories';

export interface QueueFilters {
  month: string;
  category: string;
  grade: string;
  errorsOnly: boolean;
  includeRejected: boolean;
}
const NO_FILTERS: QueueFilters = { month: '', category: '', grade: '', errorsOnly: false, includeRejected: false };

const monthOf = (s: RecordState) => (typeof s.record.date === 'string' ? s.record.date.slice(0, 7) : '');
const hasProblems = (s: RecordState) => s.errors.length > 0 || !!s.lint;

export function applyQueueFilters(records: RecordState[], f: QueueFilters): RecordState[] {
  return records.filter((s) => (f.includeRejected || !s.rejected)
    && (!f.month || monthOf(s) === f.month)
    && (!f.category || s.record.category === f.category)
    && (!f.grade || String(s.record.evidence_grade) === f.grade)
    && (!f.errorsOnly || hasProblems(s)));
}

type Mode = 'record' | 'reject' | 'jump' | 'edit' | 'batch';

const isTyping = (el: Element | null) => !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement);

/**
 * The editor's review queue (development only). One record at a time,
 * keyboard-driven: a approve, r reject (asks for a reason), e edit, n / p
 * next and previous, / jump to an id, b batch view (a table to choose the
 * triage order; there is no bulk approve). Approval is refused while the record has
 * validation errors or lint findings; the server refuses it too.
 */
export function ReviewApp() {
  const [view, setView] = useState<QueueView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useState<QueueFilters>(NO_FILTERS);
  const [pos, setPos] = useState(0);
  const [mode, setMode] = useState<Mode>('record');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [jumpTo, setJumpTo] = useState('');
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const jumpRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    const { status, data } = await api.getQueue();
    if (status !== 200 || data.error) { setLoadError(data.error ?? `HTTP ${status}`); return null; }
    setLoadError(null);
    setView(data);
    return data;
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { document.title = 'Review queue (development only)'; }, []);

  const list = useMemo(() => (view ? applyQueueFilters(view.records, filters) : []), [view, filters]);
  const index = list.length ? Math.min(pos, list.length - 1) : -1;
  const current = index >= 0 ? list[index] ?? null : null;
  const blocked = !!current && hasProblems(current);

  const go = useCallback((delta: number) => {
    if (!list.length) return;
    setPos((p) => Math.max(0, Math.min(list.length - 1, Math.min(p, list.length - 1) + delta)));
    setMessage('');
  }, [list.length]);

  const doApprove = useCallback(async () => {
    if (!current || busy) return;
    if (hasProblems(current)) { setMessage('This record cannot be approved until its validation errors and lint findings are fixed by an edit.'); return; }
    setBusy(true);
    const { status, data } = await api.approve(current.id);
    setBusy(false);
    if (status !== 200) { setMessage(`Not approved: ${data.error ?? `HTTP ${status}`}`); await reload(); return; }
    setMessage(`Approved ${current.id} (digest ${String(data.digest).slice(0, 12)}…).`);
    await reload(); // the record leaves the queue; the same position now shows the next one
  }, [current, busy, reload]);

  const doReject = useCallback(async () => {
    if (!current || busy) return;
    if (!reason.trim()) { setMessage('A rejection needs a reason.'); return; }
    setBusy(true);
    const { status, data } = await api.reject(current.id, reason);
    setBusy(false);
    if (status !== 200) { setMessage(`Not rejected: ${data.error ?? `HTTP ${status}`}`); return; }
    setMessage(`Rejected ${current.id}.`);
    setReason('');
    setMode('record');
    await reload();
  }, [current, busy, reason, reload]);

  const doSave = useCallback(async (patch: Record<string, unknown>) => {
    if (!current || busy) return;
    const id = current.id;
    setBusy(true);
    const { status, data } = await api.edit(id, patch);
    setBusy(false);
    if (status !== 200) { setMessage(`Not saved: ${data.error ?? `HTTP ${status}`}`); return; }
    const problems = (data.state?.errors.length ?? 0) + (data.state?.lint ? 1 : 0);
    setMessage(`Saved ${id}; ${problems ? `${problems} problem(s) remain, so it cannot be approved yet` : 'it validates; press a to approve'}.`);
    setMode('record');
    const fresh = await reload();
    // Stay on the edited record.
    if (fresh) {
      const i = applyQueueFilters(fresh.records, filters).findIndex((s) => s.id === id);
      if (i >= 0) setPos(i);
    }
  }, [current, busy, reload, filters]);

  const doArchive = useCallback(async (url: string) => {
    if (busy) return;
    setBusy(true);
    setMessage(`Requesting a Wayback Machine snapshot of ${url}…`);
    const { status, data } = await api.archive(url);
    setBusy(false);
    if (status !== 200) { setMessage(`Archive failed: ${data.error ?? `HTTP ${status}`}`); return; }
    setMessage(`Archived: ${data.archive_url} (written into ${data.touched?.length ?? 0} record(s)).`);
    const id = current?.id;
    const fresh = await reload();
    if (fresh && id) {
      const i = applyQueueFilters(fresh.records, filters).findIndex((s) => s.id === id);
      if (i >= 0) setPos(i);
    }
  }, [busy, current, reload, filters]);

  const openFromBatch = useCallback((id: string) => {
    if (!view) return;
    const i = list.findIndex((s) => s.id === id);
    setPos(i >= 0 ? i : 0);
    setMode('record');
    setMessage('');
  }, [view, list]);

  const doJump = useCallback(() => {
    if (!view) return;
    const id = jumpTo.trim();
    let i = list.findIndex((s) => s.id === id);
    if (i < 0 && view.records.some((s) => s.id === id)) {
      // Not in the filtered list: clear the filters and look again.
      const all = applyQueueFilters(view.records, { ...NO_FILTERS, includeRejected: true });
      setFilters({ ...NO_FILTERS, includeRejected: true });
      i = all.findIndex((s) => s.id === id);
    }
    if (i < 0) { setMessage(`No unapproved record has the id "${id}".`); return; }
    setPos(i);
    setMode('record');
    setJumpTo('');
    setMessage('');
  }, [view, list, jumpTo]);

  // Keyboard: ignored while typing in a field, and outside record mode except Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape' && mode !== 'record') { e.preventDefault(); setMode('record'); return; }
      if (e.key === 'b' && (mode === 'record' || mode === 'batch') && !isTyping(document.activeElement)) {
        e.preventDefault();
        setMode(mode === 'batch' ? 'record' : 'batch');
        return;
      }
      if (mode !== 'record' || isTyping(document.activeElement)) return;
      switch (e.key) {
        case 'a': e.preventDefault(); void doApprove(); break;
        case 'r': if (current) { e.preventDefault(); setMode('reject'); } break;
        case 'e': if (current) { e.preventDefault(); setMode('edit'); } break;
        case 'n': e.preventDefault(); go(1); break;
        case 'p': e.preventDefault(); go(-1); break;
        case '/': e.preventDefault(); setMode('jump'); break;
        default: break;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mode, current, doApprove, go]);

  useEffect(() => {
    if (mode === 'reject') reasonRef.current?.focus();
    if (mode === 'jump') jumpRef.current?.focus();
  }, [mode]);

  const months = useMemo(() => [...new Set((view?.records ?? []).map(monthOf).filter(Boolean))].sort().reverse(), [view]);
  const set = <K extends keyof QueueFilters>(k: K, v: QueueFilters[K]) => { setFilters((f) => ({ ...f, [k]: v })); setPos(0); };

  return (
    <div className="review-queue">
      <header className="rq-head">
        <p className="rq-kicker">Development only · not part of the site</p>
        <h2 className="rq-h">Review queue</h2>
        {view && (
          <p className="rq-progress" aria-live="polite">
            Approved <strong>{view.progress.approved}</strong> · Rejected <strong>{view.progress.rejected}</strong> ·
            Remaining <strong>{view.progress.remaining}</strong> of {view.progress.total} records · editor {view.editor}
          </p>
        )}
        <div className="rq-filters" role="group" aria-label="Filter the queue">
          <label>Month <select value={filters.month} onChange={(e) => set('month', e.target.value)}>
            <option value="">Any</option>{months.map((m) => <option key={m} value={m}>{m}</option>)}
          </select></label>
          <label>Category <select value={filters.category} onChange={(e) => set('category', e.target.value)}>
            <option value="">Any</option>{CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select></label>
          <label>Grade <select value={filters.grade} onChange={(e) => set('grade', e.target.value)}>
            <option value="">Any</option>{[1, 2, 3, 4, 5].map((g) => <option key={g} value={String(g)}>{g}</option>)}
          </select></label>
          <label className="rq-check"><input type="checkbox" checked={filters.errorsOnly} onChange={(e) => set('errorsOnly', e.target.checked)} /> Has validation errors</label>
          <label className="rq-check"><input type="checkbox" checked={filters.includeRejected} onChange={(e) => set('includeRejected', e.target.checked)} /> Include rejected</label>
        </div>
        <p className="rq-keys">
          <kbd className="kbd">a</kbd> approve · <kbd className="kbd">r</kbd> reject · <kbd className="kbd">e</kbd> edit · <kbd className="kbd">n</kbd>/<kbd className="kbd">p</kbd> next/previous ·{' '}
          <kbd className="kbd">/</kbd> jump to id · <kbd className="kbd">b</kbd> batch view · <kbd className="kbd">Esc</kbd> cancel
        </p>
      </header>

      <p className="rq-message" role="status" aria-live="polite">{message}</p>
      {loadError && <p className="rq-problems" role="alert">The queue could not be loaded: {loadError}</p>}

      {mode === 'jump' && (
        <form className="rq-panel" onSubmit={(e) => { e.preventDefault(); doJump(); }}>
          <label htmlFor="rq-jump">Jump to id</label>
          <input id="rq-jump" ref={jumpRef} list="rq-ids" value={jumpTo} onChange={(e) => setJumpTo(e.target.value)} autoComplete="off" />
          <datalist id="rq-ids">{(view?.records ?? []).map((s) => <option key={s.id} value={s.id} />)}</datalist>
          <button type="submit" className="button">Go</button>
        </form>
      )}

      {mode === 'reject' && current && (
        <form className="rq-panel" onSubmit={(e) => { e.preventDefault(); void doReject(); }}>
          <label htmlFor="rq-reason">Why reject <code>{current.id}</code>? (required)</label>
          <textarea id="rq-reason" ref={reasonRef} rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void doReject(); } }} />
          <div className="rq-actions">
            <button type="submit" className="button" disabled={busy || !reason.trim()}>Reject</button>
            <button type="button" className="button" onClick={() => setMode('record')}>Cancel</button>
          </div>
        </form>
      )}

      {view && list.length === 0 && <p className="rq-empty">Nothing to review under these filters.</p>}

      {mode === 'batch' && <ReviewBatch records={list} onOpen={openFromBatch} />}

      {mode !== 'batch' && current && (
        <>
          <nav className="rq-nav" aria-label="Queue position">
            <button type="button" className="button" onClick={() => go(-1)} disabled={index <= 0}>Previous</button>
            <span>Record {index + 1} of {list.length}</span>
            <button type="button" className="button" onClick={() => go(1)} disabled={index >= list.length - 1}>Next</button>
            <button type="button" className="button rq-approve" onClick={() => void doApprove()} disabled={busy || blocked}
              title={blocked ? 'Fix the validation errors and lint findings by an edit first' : 'Approve (a)'}>
              Approve
            </button>
            <button type="button" className="button" onClick={() => setMode('reject')} disabled={busy}>Reject</button>
            <button type="button" className="button" onClick={() => setMode('edit')} disabled={busy}>Edit</button>
            <button type="button" className="button" onClick={() => setMode('batch')}>Batch view</button>
          </nav>
          {mode === 'edit'
            ? <ReviewEdit key={current.id} state={current} busy={busy} onSave={(p) => void doSave(p)} onCancel={() => setMode('record')} />
            : <ReviewRecord state={current} busy={busy} onArchive={(u) => void doArchive(u)} />}
        </>
      )}
    </div>
  );
}
