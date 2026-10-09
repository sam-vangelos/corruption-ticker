import { forwardRef, useMemo } from 'react';
import { CATEGORIES, STATUSES, type Category, type Status } from '../types';
import { CATEGORY_LABEL, CategoryGlyph } from '../categories';
import { STATUS_LABEL, StatusIcon } from '../status';
import { EMPTY_FILTERS, isFiltering, type Filters } from '../state/filters';
import { MultiSelect, type Option } from './MultiSelect';
import { formatInt, formatUsdCompact } from '../data/format';

interface FilterBarProps {
  filters: Filters;
  onChange: (next: Filters) => void;
  actorOptions: Array<{ value: string; count: number }>;
  entityOptions: Array<{ value: string; count: number }>;
  categoryCounts: Map<Category, number>;
  statusCounts: Map<Status, number>;
  shown: number;
  total: number;
}

/** One row of filter controls, plus a line that lists what is active. Mirrors to the URL via the filters hook. */
export const FilterBar = forwardRef<HTMLInputElement, FilterBarProps>(function FilterBar(
  { filters, onChange, actorOptions, entityOptions, categoryCounts, statusCounts, shown, total },
  searchRef,
) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v });
  const active = isFiltering(filters);

  const categoryOptions = useMemo<Option<Category>[]>(
    () => CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c], count: categoryCounts.get(c) ?? 0, icon: <CategoryGlyph category={c} /> })),
    [categoryCounts],
  );
  const statusOptions = useMemo<Option<Status>[]>(
    () => STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s], count: statusCounts.get(s) ?? 0, icon: <StatusIcon status={s} /> })),
    [statusCounts],
  );
  const actorOpts = useMemo(() => actorOptions.map((o) => ({ value: o.value, label: o.value, count: o.count })), [actorOptions]);
  const entityOpts = useMemo(() => entityOptions.map((o) => ({ value: o.value, label: o.value, count: o.count })), [entityOptions]);

  /** Removable chips describing the active filters. */
  const chips: Array<{ key: string; text: string; icon?: JSX.Element; remove: () => void }> = [];
  for (const c of filters.categories) chips.push({ key: `c:${c}`, text: CATEGORY_LABEL[c], icon: <CategoryGlyph category={c} />, remove: () => set('categories', filters.categories.filter((x) => x !== c)) });
  for (const a of filters.actors) chips.push({ key: `a:${a}`, text: a, remove: () => set('actors', filters.actors.filter((x) => x !== a)) });
  for (const e of filters.entities) chips.push({ key: `e:${e}`, text: e, remove: () => set('entities', filters.entities.filter((x) => x !== e)) });
  for (const s of filters.statuses) chips.push({ key: `s:${s}`, text: STATUS_LABEL[s], icon: <StatusIcon status={s} />, remove: () => set('statuses', filters.statuses.filter((x) => x !== s)) });
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
            <MultiSelect label="Status" options={statusOptions} selected={filters.statuses} onChange={(v) => set('statuses', v)} />
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
            ? <>Showing <strong>{formatInt(shown)}</strong> of {formatInt(total)} items</>
            : <>Showing all <strong>{formatInt(total)}</strong> items</>}
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
