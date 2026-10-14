import { useMemo, useState } from 'react';
import type { RecordState } from './api';
import { CATEGORY_LABEL } from '../categories';
import type { Category } from '../types';

type SortKey = 'id' | 'date' | 'grade' | 'category' | 'title' | 'errors';

const str = (v: unknown) => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v));
const errorCount = (s: RecordState) => s.errors.length + (s.lint ? 1 : 0);

interface ReviewBatchProps {
  records: RecordState[];
  onOpen: (id: string) => void;
}

/**
 * Batch view: every unapproved record (after the queue's filters) as a table,
 * to choose a triage order. Click a row to open that record in the queue.
 * There is deliberately no bulk approve: each record is read and approved
 * on its own.
 */
export function ReviewBatch({ records, onOpen }: ReviewBatchProps) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'errors', dir: -1 });
  const rows = useMemo(() => {
    const val = (s: RecordState): string | number => {
      switch (sort.key) {
        case 'id': return s.id;
        case 'date': return str(s.record.date);
        case 'grade': return typeof s.record.evidence_grade === 'number' ? s.record.evidence_grade : 99;
        case 'category': return str(s.record.category);
        case 'title': return str(s.record.title);
        case 'errors': return errorCount(s);
      }
    };
    return [...records].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || a.id.localeCompare(b.id);
    });
  }, [records, sort]);

  const head = (key: SortKey, label: string) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="rqb-sort" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))}>
        {label}{sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  );

  return (
    <section className="rq-batch" aria-label="Batch view">
      <p className="rq-dim">{records.length} unapproved {records.length === 1 ? 'record' : 'records'} under the current filters. Click a row to open it; <kbd className="kbd">b</kbd> returns to the queue. There is no bulk approve.</p>
      <div className="table-wrap rqb-wrap" tabIndex={0} role="region" aria-label="Unapproved records">
        <table className="data-table rqb-table">
          <thead>
            <tr>
              {head('id', 'Id')}
              {head('date', 'Date')}
              {head('grade', 'Grade')}
              {head('category', 'Category')}
              {head('title', 'Title')}
              {head('errors', 'Errors')}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} data-batch-id={s.id} className={errorCount(s) ? 'rqb-has-errors' : undefined}>
                <th scope="row"><button type="button" className="link-button" onClick={() => onOpen(s.id)}>{s.id}</button></th>
                <td>{str(s.record.date)}</td>
                <td className="num">{str(s.record.evidence_grade)}</td>
                <td>{CATEGORY_LABEL[s.record.category as Category] ?? str(s.record.category)}</td>
                <td>{str(s.record.title)}{s.rejected ? <span className="rq-dim"> (rejected)</span> : null}</td>
                <td className="num">{errorCount(s) ? <strong className="rq-bad">{errorCount(s)}</strong> : 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
