import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Category, CorrectionsState, EvidenceGrade, EvidentiaryStatus, LoadState, ProceduralStatus } from './types';
import { loadCorrections, loadEntries } from './data/load';
import { buildIndexes, optionsFrom } from './data/derive';
import { cadence, computeHeadline, computeStats } from './data/metrics';
import { inaugurationDay, parseDay, today } from './data/dates';
import { plural } from './data/format';
import { applyFilters, EMPTY_FILTERS, isFiltering, useUrlFilters } from './state/filters';
import { followLink, useRoute, type Route } from './router';
import { SITE_DECK, SITE_NAME } from './method';
import { StatePanel } from './components/StatePanel';
import { Ticker } from './components/Ticker';
import { Counters } from './components/Counters';
import { Headline } from './components/Headline';
import { Cadence } from './components/Cadence';
import { FilterBar, type FacetCounts } from './components/FilterBar';
import { Stream } from './components/Stream';
import { ChartsPanel } from './components/charts/ChartsPanel';
import { Drawer } from './components/Drawer';
import { MethodPage } from './components/pages/MethodPage';
import { CorrectionsPage } from './components/pages/CorrectionsPage';
import { NotFound } from './components/pages/NotFound';
import { useShortcuts } from './hooks/useShortcuts';
import { usePrefs } from './hooks/usePrefs';

/** Site navigation, in reading order. */
const NAV: Array<{ href: string; label: string; kinds: Route['kind'][] }> = [
  { href: '/', label: 'The record', kinds: ['home', 'record'] },
  { href: '/method', label: 'How we count', kinds: ['method'] },
  { href: '/corrections', label: 'Corrections', kinds: ['corrections'] },
];

export function App() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [corrections, setCorrections] = useState<CorrectionsState>({ kind: 'loading' });
  const [filters, setFilters] = useUrlFilters();
  const { route } = useRoute();
  const isHome = route.kind === 'home' || route.kind === 'record';
  const prefs = usePrefs();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    loadEntries().then((s) => { if (live) setState(s); });
    loadCorrections().then((c) => { if (live) setCorrections(c); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (isHome) document.title = SITE_NAME;
  }, [isHome]);

  const items = state.kind === 'ready' ? state.items : null;
  const now = useMemo(() => today(), []);

  // Indexes over the full dataset, computed once per load.
  const indexes = useMemo(() => (items ? buildIndexes(items) : null), [items]);
  const actorOptions = useMemo(() => (indexes ? optionsFrom(indexes.byActor) : []), [indexes]);
  const entityOptions = useMemo(() => (indexes ? optionsFrom(indexes.byEntity) : []), [indexes]);
  const categoryCounts = useMemo(() => {
    const m = new Map<Category, number>();
    indexes?.byCategory.forEach((list, k) => m.set(k, list.length));
    return m;
  }, [indexes]);
  const facetCounts = useMemo<FacetCounts>(() => {
    const grades = new Map<EvidenceGrade, number>();
    const evidence = new Map<EvidentiaryStatus, number>();
    const procedural = new Map<ProceduralStatus, number>();
    items?.forEach((it) => {
      grades.set(it.evidence_grade, (grades.get(it.evidence_grade) ?? 0) + 1);
      evidence.set(it.evidentiary_status, (evidence.get(it.evidentiary_status) ?? 0) + 1);
      procedural.set(it.procedural_status, (procedural.get(it.procedural_status) ?? 0) + 1);
    });
    return { grades, evidence, procedural };
  }, [items]);

  // The active slice: counters, charts and the stream follow it; the ticker does not.
  const filtering = isFiltering(filters);
  const filtered = useMemo(() => (items ? applyFilters(items, filters) : []), [items, filters]);
  const nowMs = useMemo(() => Date.now(), []);
  // The headline block (headline, counters, cadence strip) describes the whole
  // record and never follows the filters; charts and the list do.
  const headline = useMemo(() => (items ? computeHeadline(items, nowMs) : null), [items, nowMs]);
  const cadenceDays = useMemo(() => (items ? cadence(items, nowMs) : []), [items, nowMs]);
  const stats = useMemo(
    () => (items ? computeStats(items, { now, nowMs, inauguration: inaugurationDay() }) : null),
    [items, now, nowMs],
  );
  // Grade-5 leads and retracted records are listed but never charted.
  const charted = useMemo(() => filtered.filter((it) => it.qualifying), [filtered]);

  const isPlaceholder = !!items && items.some((it) => it.placeholder);

  // Chart window: 20 Jan 2025 (or the earliest item, if older) through today
  // (or the latest item, if newer); a from/to filter narrows it.
  const chartWindow = useMemo(() => {
    const oldest = items && items.length ? (items[items.length - 1] as { day: number }).day : inaugurationDay();
    const newest = items && items.length ? (items[0] as { day: number }).day : now;
    const from = filters.from ? (parseDay(filters.from) ?? inaugurationDay()) : Math.min(inaugurationDay(), oldest);
    const to = filters.to ? (parseDay(filters.to) ?? now) : Math.max(now, newest);
    return { from, to: Math.max(from, to) };
  }, [items, filters.from, filters.to, now]);

  // Drawer: which item is open, and where focus goes back to on close.
  const [openId, setOpenId] = useState<string | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const restoredItem = useRef(false);

  const writeItemParam = (id: string | null) => {
    const p = new URLSearchParams(window.location.search);
    if (id) p.set('item', id); else p.delete('item');
    const qs = p.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
  };

  const openItem = useCallback((id: string, opener: HTMLElement) => {
    openerRef.current = opener;
    setOpenId(id);
    writeItemParam(id);
  }, []);

  const navigateItem = useCallback((id: string) => {
    setOpenId(id);
    writeItemParam(id);
  }, []);

  const closeItem = useCallback(() => {
    const closingId = openId;
    setOpenId(null);
    writeItemParam(null);
    // Return focus to the opener; if it is gone, to that item's card; else to the list.
    requestAnimationFrame(() => {
      const opener = openerRef.current;
      if (opener && opener.isConnected) { opener.focus({ preventScroll: false }); return; }
      const card = closingId ? document.querySelector<HTMLElement>(`.card[data-card-id="${CSS.escape(closingId)}"]`) : null;
      (card ?? document.getElementById('main'))?.focus();
    });
  }, [openId]);

  // Deep link: ?item=<id> opens that item once the data is ready.
  useEffect(() => {
    if (!indexes || restoredItem.current) return;
    restoredItem.current = true;
    const id = new URLSearchParams(window.location.search).get('item');
    if (id && indexes.byId.has(id)) {
      openerRef.current = null;
      setOpenId(id);
    } else if (id) {
      writeItemParam(null);
    }
  }, [indexes]);

  const openEntry = openId && indexes ? indexes.byId.get(openId) ?? null : null;

  useShortcuts({
    focusSearch: () => { searchRef.current?.focus(); searchRef.current?.select(); },
    toggleTheme: prefs.toggleTheme,
    toggleLargeType: prefs.toggleLargeType,
    modalOpen: openEntry !== null,
  });
  const addActor = useCallback((actor: string) => {
    setFilters((f) => (f.actors.includes(actor) ? f : { ...f, actors: [...f.actors, actor] }));
  }, [setFilters]);
  const clearFilters = useCallback(() => setFilters(EMPTY_FILTERS), [setFilters]);

  const skippedNotice = state.kind === 'ready' && state.skipped.length > 0 && (
    <p className="skip-notice" role="note">
      {plural(state.skipped.length, 'record')} in the file failed validation and{' '}
      {state.skipped.length === 1 ? 'is' : 'are'} not shown:{' '}
      {state.skipped.slice(0, 5).map((s) => `#${s.index}${s.id ? ` (${s.id})` : ''}: ${s.reason}`).join('; ')}
      {state.skipped.length > 5 ? '; and more.' : '.'}
    </p>
  );

  const brand = <a className="brand__link" href="/" onClick={(e) => followLink(e)}>{SITE_NAME}</a>;

  let body: JSX.Element;
  if (route.kind === 'method') {
    body = <main id="main" className="main main--page" tabIndex={-1}><MethodPage items={items} /></main>;
  } else if (route.kind === 'corrections') {
    body = (
      <main id="main" className="main main--page" tabIndex={-1}>
        <CorrectionsPage corrections={corrections} byId={indexes?.byId ?? null} recordHref={(id) => `/?item=${encodeURIComponent(id)}`} />
      </main>
    );
  } else if (route.kind === 'recent' || route.kind === 'subscribe' || route.kind === 'notfound') {
    body = <main id="main" className="main main--page" tabIndex={-1}><NotFound path={route.kind === 'notfound' ? route.path : `/${route.kind}`} /></main>;
  } else if (state.kind !== 'ready') {
    body = <main id="main" className="main"><StatePanel state={state} /></main>;
  } else {
    body = (
      <>
        <div className="frame">
          {headline && stats && (
            <section className="front" aria-label="The count">
              <Headline headline={headline} placeholder={isPlaceholder} onNavigate={(href, e) => followLink(e, href)} />
              <Counters stats={stats} />
              <Cadence days={cadenceDays} onOpen={openItem} />
            </section>
          )}
          {skippedNotice}
          <FilterBar
            ref={searchRef}
            filters={filters}
            onChange={setFilters}
            actorOptions={actorOptions}
            entityOptions={entityOptions}
            categoryCounts={categoryCounts}
            facetCounts={facetCounts}
            shown={filtered.length}
            total={state.items.length}
          />
        </div>
        <div className="frame">
          <ChartsPanel items={charted} fromDay={chartWindow.from} toDay={chartWindow.to} />
        </div>
        <main id="main" className="main" tabIndex={-1}>
          <Stream items={filtered} onOpen={openItem} onActor={addActor} onClear={clearFilters} filtered={filtering} />
        </main>
      </>
    );
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to the main content</a>
      {isHome && items && <Ticker items={items} onOpen={openItem} />}
      <header className="masthead">
        <div className="masthead__title">
          {isHome ? <h1 className="brand">{brand}</h1> : <p className="brand">{brand}</p>}
          <p className="masthead__sub">{SITE_DECK}</p>
        </div>
        <div className="prefs" role="group" aria-label="Display">
          <button type="button" className="pref" aria-pressed={prefs.theme === 'light'} onClick={prefs.toggleTheme}>
            <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false">
              <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
              <path d="M7 1.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" />
            </svg>
            Light theme <kbd className="kbd" aria-hidden="true">t</kbd>
          </button>
          <button type="button" className="pref" aria-pressed={prefs.largeType} onClick={prefs.toggleLargeType}>
            <svg viewBox="0 0 16 14" width="16" height="14" aria-hidden="true" focusable="false">
              <path d="M1 12L4.5 3 8 12M2.4 8.6h4.2M10 9h5M12.5 6.5v5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Large type <kbd className="kbd" aria-hidden="true">+</kbd>
          </button>
        </div>
      </header>
      <nav className="frame site-nav" aria-label="Site">
        <ul>
          {NAV.map((n) => (
            <li key={n.href}>
              <a href={n.href} aria-current={n.kinds.includes(route.kind) ? 'page' : undefined} onClick={(e) => followLink(e)}>{n.label}</a>
            </li>
          ))}
        </ul>
      </nav>

      {isPlaceholder && (
        <div className="frame">
          <p className="placeholder-notice" role="note">
            <strong>Placeholder data.</strong> Every record on this site is fake and exists only to test the
            layout. None of it describes a real event, person, or organization.
          </p>
        </div>
      )}

      {body}

      <footer className="frame">
        <div className="footer">
          {isHome && (
            <>
              <h2 className="footer__h">Keyboard</h2>
              <dl className="keys">
                <div><dt><kbd className="kbd">/</kbd></dt><dd>Search</dd></div>
                <div><dt><kbd className="kbd">j</kbd> <kbd className="kbd">k</kbd></dt><dd>Next and previous record</dd></div>
                <div><dt><kbd className="kbd">Enter</kbd></dt><dd>Open the focused record</dd></div>
                <div><dt><kbd className="kbd">Esc</kbd></dt><dd>Close details or a menu</dd></div>
                <div><dt><kbd className="kbd">t</kbd></dt><dd>Light or dark theme</dd></div>
                <div><dt><kbd className="kbd">+</kbd></dt><dd>Large type</dd></div>
              </dl>
            </>
          )}
          <p className="footer__note">
            The record states what was reported, by whom, with what evidence, and what happened next. It never
            calls a person corrupt. <a href="/method" onClick={(e) => followLink(e)}>How we count</a>.
          </p>
        </div>
      </footer>
      {isHome && openEntry && indexes && (
        <Drawer item={openEntry} byId={indexes.byId} onClose={closeItem} onNavigate={navigateItem} />
      )}
    </div>
  );
}
