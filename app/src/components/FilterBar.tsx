import { forwardRef, useMemo } from 'react';
import {
  CATEGORIES, EVIDENCE_GRADES, EVIDENTIARY_STATUSES, PROCEDURAL_STATUSES,
  type Category, type EvidenceGrade, type EvidentiaryStatus, type ProceduralStatus,
} from '../types';
import { CATEGORY_LABEL, CategoryGlyph } from '../categories';
import { EVIDENTIARY_LABEL, PROCEDURAL_LABEL } from '../status';
import { gradeLabel } from '../method';
import { EMPTY_FILTERS, isFiltering, type Filters } from '../state/filters';
import { MultiSelect, type Option } from './MultiSelect';
import { formatInt, formatUsdCompact } from '../data/format';

/** Record counts per value of each status-like facet, over the whole dataset. */
export interface FacetCounts {
  grades: Map<EvidenceGrade, number>;
  evidence: Map<EvidentiaryStatus, number>;
  procedural: Map<ProceduralStatus, number>;
}

interface FilterBarProps {
  filters: Filters;
  onChange: (next: Filters) => void;
  actorOptions: Array<{ value: string; count: number }>;
  entityOptions: Array<{ value: string; count: number }>;
  categoryCounts: Map<Category, number>;
  facetCounts: FacetCounts;
  shown: number;
  total: number;
}

/** One row of filter controls, plus a line that lists what is active. Mirrors to the URL via the filters hook. */
export const FilterBar = forwardRef<HTMLInputElement, FilterBarProps>(function FilterBar(
  { filters, onChange, actorOptions, entityOptions, categoryCounts, facetCounts, shown, total },
  searchRef,
) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v });
  const active = isFiltering(filters);

  const categoryOptions = useMemo<Option<Category>[]>(
    () => CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c], count: categoryCounts.get(c) ?? 0, icon: <CategoryGlyph category={c} /> })),
    [categoryCounts],
  );
  // MultiSelect values are strings; grades round-trip through String/Number.
  const gradeOptions = useMemo<Option<string>[]>(
    () => EVIDENCE_GRADES.map((g) => ({ value: String(g), label: gradeLabel(g), count: facetCounts.grades.get(g) ?? 0 })),
    [facetCounts],
  );
  const evidenceOptions = useMemo<Option<EvidentiaryStatus>[]>(
    () => EVIDENTIARY_STATUSES.map((s) => ({ value: s, label: EVIDENTIARY_LABEL[s], count: facetCounts.evidence.get(s) ?? 0 })),
    [facetCounts],
  );
  const proceduralOptions = useMemo<Option<ProceduralStatus>[]>(
    () => PROCEDURAL_STATUSES.map((s) => ({ value: s, label: PROCEDURAL_LABEL[s], count: facetCounts.procedural.get(s) ?? 0 })),
    [facetCounts],
  );
  const actorOpts = useMemo(() => actorOptions.map((o) => ({ value: o.value, label: o.value, count: o.count })), [actorOptions]);
  const entityOpts = useMemo(() => entityOptions.map((o) => ({ value: o.value, label: o.value, count: o.count })), [entityOptions]);

  /** Removable chips describing the active filters. */
  const chips: Array<{ key: string; text: string; icon?: JSX.Element; remove: () => void }> = [];
  for (const c of filters.categories) chips.push({ key: `c:${c}`, text: CATEGORY_LABEL[c], icon: <CategoryGlyph category={c} />, remove: () => set('categories', filters.categories.filter((x) => x !== c)) });
  for (const a of filters.actors) chips.push({ key: `a:${a}`, text: a, remove: () => set('actors', filters.actors.filter((x) => x !== a)) });
  for (const e of filters.entities) chips.push({ key: `e:${e}`, text: e, remove: () => set('entities', filters.entities.filter((x) => x !== e)) });
  for (const g of filters.grades) chips.push({ key: `g:${g}`, text: gradeLabel(g), remove: () => set('grades', filters.grades.filter((x) => x !== g)) });
  for (const s of filters.evidence) chips.push({ key: `ev:${s}`, text: `Evidence: ${EVIDENTIARY_LABEL[s]}`, remove: () => set('evidence', filters.evidence.filter((x) => x !== s)) });
  for (const s of filters.procedural) chips.push({ key: `pr:${s}`, text: `Procedure: ${PROCEDURAL_LABEL[s]}`, remove: () => set('procedural', filters.procedural.filter((x) => x !== s)) });
  if (filters.from) chips.push({ key: 'from', text: `From ${filters.from}`, remove: () => set('from', null) });
  if (filters.to) chips.push({ key: 'to', text: `To ${filters.to}`, remove: () => set('to', null) });
  if (filters.minUsd !== null) chips.push({ key: 'min', text: `At least ${formatUsdCompact(filters.minUsd)}`, remove: () => set('minUsd', null) });
  if (filters.q.trim()) chips.push({ key: 'q', text: `Text “${filters.q.trim()}”`, remove: () => set('q', '') });

  return (
    <section className="filters" aria-label="Filters">
      <div className="filters__row">
        <label className="field field--search">
          <span className="field__label">Search <kbd className="kbd" aria-hidden="true">/</kbd></span>
          <input
            ref={searchRef}
            type="search"
            value={filters.q}
            placeholder="Titles, summaries, people, organizations"
            onChange={(e) => set('q', e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape' && filters.q) { e.stopPropagation(); set('q', ''); } }}
          />
        </label>

        <div className="field">
          <span className="field__label" aria-hidden="true">&nbsp;</span>
          <div className="filters__selects">
            <MultiSelect label="Category" options={categoryOptions} selected={filters.categories} onChange={(v) => set('categories', v)} chips />
            <MultiSelect label="Actor" options={actorOpts} selected={filters.actors} onChange={(v) => set('actors', v)} searchable searchPlaceholder="Search people" />
            <MultiSelect label="Entity" options={entityOpts} selected={filters.entities} onChange={(v) => set('entities', v)} searchable searchPlaceholder="Search organizations" />
            <MultiSelect
              label="Grade"
              options={gradeOptions}
              selected={filters.grades.map(String)}
              onChange={(v) => set('grades', v.map(Number).filter((g): g is EvidenceGrade => (EVIDENCE_GRADES as readonly number[]).includes(g)))}
            />
            <MultiSelect label="Evidence" options={evidenceOptions} selected={filters.evidence} onChange={(v) => set('evidence', v)} />
            <MultiSelect label="Procedure" options={proceduralOptions} selected={filters.procedural} onChange={(v) => set('procedural', v)} />
          </div>
        </div>

        <label className="field field--date">
          <span className="field__label">From</span>
          <input type="date" value={filters.from ?? ''} max={filters.to ?? undefined} onChange={(e) => set('from', e.target.value || null)} />
        </label>
        <label className="field field--date">
          <span className="field__label">To</span>
          <input type="date" value={filters.to ?? ''} min={filters.from ?? undefined} onChange={(e) => set('to', e.target.value || null)} />
        </label>
        <label className="field field--min">
          <span className="field__label">Minimum $</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1000}
            placeholder="Any"
            value={filters.minUsd ?? ''}
            onChange={(e) => {
              const n = Number(e.target.value);
              set('minUsd', e.target.value === '' || !Number.isFinite(n) || n <= 0 ? null : n);
            }}
          />
        </label>

      </div>

      <div className="filters__summary" aria-live="polite">
        <p className="filters__count">
          {active
            ? <>Showing <strong>{formatInt(shown)}</strong> of {formatInt(total)} records</>
            : <>Showing all <strong>{formatInt(total)}</strong> records</>}
        </p>
        {active && (
          <button type="button" className="link-button" onClick={() => onChange(EMPTY_FILTERS)}>
            Clear all
          </button>
        )}
        {chips.length > 0 && (
          <ul className="active-chips" aria-label="Active filters">
            {chips.map((c) => (
              <li key={c.key}>
                <button type="button" className="chip chip--removable" onClick={c.remove} aria-label={`Remove filter: ${c.text}`}>
                  {c.icon}
                  <span>{c.text}</span>
                  <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" focusable="false">
                    <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
});
