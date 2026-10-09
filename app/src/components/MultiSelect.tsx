import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';

export interface Option<V extends string> {
  value: V;
  label: string;
  count?: number;
  /** Optional leading mark (category glyph, status icon). */
  icon?: ReactNode;
}

interface MultiSelectProps<V extends string> {
  label: string;
  options: Option<V>[];
  selected: V[];
  onChange: (next: V[]) => void;
  /** Show a text box that narrows the option list. */
  searchable?: boolean;
  /** Lay options out as wrapping chips instead of a list. */
  chips?: boolean;
  searchPlaceholder?: string;
}

/**
 * A button that opens a popover listbox of toggleable options.
 * Keyboard: ArrowUp/ArrowDown move, Home/End jump, Enter or Space toggle,
 * Escape closes and returns focus to the button. Typing filters when searchable.
 */
export function MultiSelect<V extends string>({
  label, options, selected, onChange, searchable = false, chips = false, searchPlaceholder,
}: MultiSelectProps<V>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const keyTargetRef = useRef<HTMLInputElement & HTMLDivElement>(null);
  const listId = useId();
  const optId = (i: number) => `${listId}-opt-${i}`;
  const selectedSet = useMemo(() => new Set<string>(selected), [selected]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  useEffect(() => { setActive(0); }, [query]);

  // Focus the key target when the popover opens.
  useEffect(() => {
    if (open) keyTargetRef.current?.focus();
  }, [open]);

  // Close on outside pointer.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  // Keep the active option scrolled into view.
  useEffect(() => {
    if (!open) return;
    document.getElementById(optId(active))?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const toggle = (v: V) => {
    onChange(selectedSet.has(v) ? selected.filter((s) => s !== v) : [...selected, v]);
  };

  const close = (refocus: boolean) => {
    setOpen(false);
    setQuery('');
    if (refocus) buttonRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const n = visible.length;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); if (n) setActive((a) => (a + 1) % n); break;
      case 'ArrowUp': e.preventDefault(); if (n) setActive((a) => (a - 1 + n) % n); break;
      case 'ArrowRight': if (chips) { e.preventDefault(); if (n) setActive((a) => (a + 1) % n); } break;
      case 'ArrowLeft': if (chips) { e.preventDefault(); if (n) setActive((a) => (a - 1 + n) % n); } break;
      case 'Home': if (!searchable) { e.preventDefault(); setActive(0); } break;
      case 'End': if (!searchable) { e.preventDefault(); setActive(Math.max(0, n - 1)); } break;
      case 'Enter': {
        e.preventDefault();
        const o = visible[active];
        if (o) toggle(o.value);
        break;
      }
      case ' ': {
        if (searchable) break; // space types into the search box
        e.preventDefault();
        const o = visible[active];
        if (o) toggle(o.value);
        break;
      }
      case 'Escape': e.preventDefault(); e.stopPropagation(); close(true); break;
      case 'Tab': close(false); break;
    }
  };

  const count = selected.length;
  const activeId = open && visible[active] ? optId(active) : undefined;

  return (
    <div className="ms" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="ms__button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true); } }}
        data-active={count > 0 || undefined}
      >
        <span>{label}</span>
        {count > 0 && <span className="ms__count">{count}<span className="visually-hidden"> selected</span></span>}
        <svg className="ms__caret" viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" focusable="false">
          <path d="M1.5 3.5L5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {open && (
        <div className={`ms__pop${chips ? ' ms__pop--chips' : ''}`}>
          {searchable ? (
            <input
              ref={keyTargetRef}
              className="ms__search"
              type="text"
              role="combobox"
              aria-label={`Search ${label.toLowerCase()}`}
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={activeId}
              aria-autocomplete="list"
              placeholder={searchPlaceholder ?? `Search ${label.toLowerCase()}`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
            />
          ) : null}
          <div
            ref={searchable ? undefined : keyTargetRef}
            id={listId}
            role="listbox"
            aria-multiselectable="true"
            aria-label={label}
            aria-orientation={chips ? 'horizontal' : 'vertical'}
            aria-activedescendant={searchable ? undefined : activeId}
            tabIndex={searchable ? -1 : 0}
            className={chips ? 'ms__list ms__list--chips' : 'ms__list'}
            onKeyDown={searchable ? undefined : onKeyDown}
          >
            {visible.length === 0 && <p className="ms__empty">No match for “{query}”.</p>}
            {visible.map((o, i) => {
              const on = selectedSet.has(o.value);
              return (
                <div
                  key={o.value}
                  id={optId(i)}
                  role="option"
                  aria-selected={on}
                  className="ms__opt"
                  data-active={i === active || undefined}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => { setActive(i); toggle(o.value); }}
                >
                  <span className="ms__check" aria-hidden="true">
                    {on && (
                      <svg viewBox="0 0 12 12" width="12" height="12" focusable="false">
                        <path d="M2.2 6.3l2.4 2.4 5.2-5.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  {o.icon}
                  <span className="ms__label">{o.label}</span>
                  {o.count !== undefined && <span className="ms__n">{o.count}</span>}
                </div>
              );
            })}
          </div>
          {count > 0 && (
            <div className="ms__foot">
              <button type="button" className="link-button" onClick={() => { onChange([]); keyTargetRef.current?.focus(); }}>
                Clear {label.toLowerCase()}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
