import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Item } from '../types';
import { CATEGORY_LABEL, CategoryGlyph } from '../categories';
import { EVIDENTIARY_LABEL } from '../status';
import { amountLong } from '../amounts';
import { formatDate, parseDay } from '../data/dates';

interface DrawerProps {
  item: Item;
  byId: Map<string, Item>;
  onClose: () => void;
  onNavigate: (id: string) => void;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Detail drawer: a modal dialog that slides in from the right. The rest of the
 * page is made inert while it is open; Tab wraps inside it; Escape closes it.
 * Related entries swap the content in place and move focus to the new title.
 */
export function Drawer({ item, byId, onClose, onNavigate }: DrawerProps) {
  const panelRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Make everything behind the drawer inert and stop the page scrolling.
  // A layout effect, so the cleanup runs synchronously on close: focus can
  // only return to the page once the inert attribute is gone.
  useLayoutEffect(() => {
    const app = document.querySelector<HTMLElement>('.app');
    app?.setAttribute('inert', '');
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      app?.removeAttribute('inert');
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Focus the title on open and whenever the content swaps.
  useLayoutEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
    titleRef.current?.focus();
  }, [item.id]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !panelRef.current) return;
    const nodes = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent !== null || n === document.activeElement);
    if (nodes.length === 0) return;
    const first = nodes[0] as HTMLElement;
    const last = nodes[nodes.length - 1] as HTMLElement;
    const activeEl = document.activeElement;
    if (e.shiftKey && (activeEl === first || activeEl === titleRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && activeEl === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const related = item.related_ids.map((id) => ({ id, it: byId.get(id) ?? null }));
  const titleId = `drawer-title-${item.id}`;

  return createPortal(
    <div className="drawer-layer" onKeyDown={onKeyDown}>
      <div className="drawer-scrim" onClick={onClose} aria-hidden="true" />
      <aside ref={panelRef} className="drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="drawer__bar">
          <p className="drawer__kicker">Item details</p>
          <button type="button" className="button drawer__close" onClick={onClose}>
            <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" focusable="false">
              <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Close <kbd className="kbd" aria-hidden="true">Esc</kbd>
          </button>
        </div>

        <div className="drawer__body" ref={bodyRef}>
          {item.placeholder && (
            <p className="drawer__placeholder" role="note">Placeholder entry. This item is fake and describes no real event.</p>
          )}

          <div className="drawer__meta">
            <time dateTime={item.date}>{formatDate(item.day, item.date_precision)}</time>
            <span className="card__cat"><CategoryGlyph category={item.category} />{CATEGORY_LABEL[item.category]}</span>
          </div>

          <h2 className="drawer__title" id={titleId} ref={titleRef} tabIndex={-1}>{item.title}</h2>

          <section className="drawer__section drawer__status" aria-label="Status">
            <p className="drawer__status-line">
              <strong>{EVIDENTIARY_LABEL[item.evidentiary_status]}</strong>
            </p>
            {item.status_note && <p className="drawer__note">{item.status_note}</p>}
          </section>

          {item.summary && <p className="drawer__summary">{item.summary}</p>}

          <dl className="drawer__facts">
            {item.actors.length > 0 && (
              <div>
                <dt>Actors</dt>
                <dd><ul className="chips chips--static">{item.actors.map((a) => <li key={a} className="chip chip--static">{a}</li>)}</ul></dd>
              </div>
            )}
            {item.entities.length > 0 && (
              <div>
                <dt>Entities</dt>
                <dd><ul className="chips chips--static">{item.entities.map((e) => <li key={e} className="chip chip--static">{e}</li>)}</ul></dd>
              </div>
            )}
            {item.amounts.length > 0 && (
              <div>
                <dt>Stated amounts</dt>
                <dd>
                  <ul className="amounts">
                    {item.amounts.map((a, i) => (
                      <li key={i}>
                        <p className="drawer__usd">{amountLong(a)}</p>
                        <p className="drawer__basis">{a.basis}</p>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
          </dl>

          <section className="drawer__section" aria-labelledby={`${titleId}-src`}>
            <h3 className="drawer__h3" id={`${titleId}-src`}>Sources ({item.sources.length})</h3>
            {item.sources.length === 0 ? (
              <p className="drawer__muted">No sources are listed for this item.</p>
            ) : (
              <ol className="sources">
                {item.sources.map((s, i) => {
                  const d = s.date ? parseDay(s.date) : null;
                  return (
                    <li key={`${s.url}-${i}`} className="source">
                      <p className="source__outlet">{s.outlet}</p>
                      <a className="source__title" href={s.url} target="_blank" rel="noopener noreferrer">
                        {s.title || s.url}
                        <span className="visually-hidden"> (opens in a new tab)</span>
                      </a>
                      {(d !== null || s.author) && (
                        <p className="source__byline">
                          {d !== null && <time dateTime={s.date}>{formatDate(d)}</time>}
                          {d !== null && s.author && ', '}
                          {s.author && <span>{s.author}</span>}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {related.length > 0 && (
            <section className="drawer__section" aria-labelledby={`${titleId}-rel`}>
              <h3 className="drawer__h3" id={`${titleId}-rel`}>Related items</h3>
              <ul className="related">
                {related.map(({ id, it }) => (
                  <li key={id}>
                    {it ? (
                      <a
                        href={`?item=${encodeURIComponent(id)}`}
                        className="related__link"
                        onClick={(e) => { e.preventDefault(); onNavigate(id); }}
                      >
                        <span className="related__meta">
                          <CategoryGlyph category={it.category} />
                          {formatDate(it.day, it.date_precision)}
                        </span>
                        <span className="related__title">{it.title}</span>
                      </a>
                    ) : (
                      <span className="drawer__muted">{id} (not in this dataset)</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {item.tags.length > 0 && (
            <p className="drawer__tags"><span className="drawer__muted">Tags </span>{item.tags.join(', ')}</p>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
