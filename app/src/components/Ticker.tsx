import { memo, useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { Item } from '../types';
import { CategoryGlyph, CATEGORY_LABEL } from '../categories';
import { formatDate } from '../data/dates';
import { useReducedMotion } from '../hooks/useMediaQuery';

/** Scroll speed in CSS pixels per second; the loop duration follows track width. */
const SPEED_PX_S = 42;

interface TickerProps {
  /** Always the full dataset, newest first. Filters never apply here. */
  items: Item[];
  onOpen: (id: string, opener: HTMLElement) => void;
}

/**
 * A continuously scrolling strip of every title (duplicated track, CSS
 * animation). Hover pauses it. Keyboard focus or the pause control switches it
 * to a static, horizontally scrollable strip at the same visual offset, so a
 * focused title is never stranded off-screen. Reduced motion: always static.
 */
export const Ticker = memo(function Ticker({ items, onOpen }: TickerProps) {
  const reduced = useReducedMotion();
  const viewportRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const [duration, setDuration] = useState(120);
  const [userPaused, setUserPaused] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const [delay, setDelay] = useState(0);
  const pendingScroll = useRef<number | null>(null);

  const manual = reduced || userPaused || focusInside;

  // Loop duration proportional to the width of one copy of the track.
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => setDuration(Math.max(20, track.scrollWidth / SPEED_PX_S));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => ro.disconnect();
  }, [items]);

  // After switching to manual, restore the visual offset as a scroll position.
  useLayoutEffect(() => {
    if (manual && pendingScroll.current !== null && viewportRef.current) {
      viewportRef.current.scrollLeft = pendingScroll.current;
      pendingScroll.current = null;
    }
  }, [manual]);

  /** Freeze: read the animated offset and carry it over as scrollLeft. */
  const freeze = useCallback(() => {
    if (manual || !railRef.current) return;
    const t = getComputedStyle(railRef.current).transform;
    const x = t && t !== 'none' ? new DOMMatrixReadOnly(t).m41 : 0;
    pendingScroll.current = Math.max(0, -x);
  }, [manual]);

  /** Thaw: resume the animation from the current scroll position. */
  const thawDelay = useCallback(() => {
    const vp = viewportRef.current;
    const track = trackRef.current;
    if (!vp || !track || track.scrollWidth === 0) return 0;
    const progress = (vp.scrollLeft % track.scrollWidth) / track.scrollWidth;
    vp.scrollLeft = 0;
    return -progress * duration;
  }, [duration]);

  const onFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!focusInside) {
      freeze();
      setFocusInside(true);
    }
    // Keep the focused title visible once the strip is static.
    const target = e.target as HTMLElement;
    requestAnimationFrame(() => target.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  };

  const onBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    if (!userPaused && !reduced) setDelay(thawDelay());
    setFocusInside(false);
  };

  const togglePause = () => {
    if (userPaused) {
      if (!focusInside) setDelay(thawDelay());
      setUserPaused(false);
    } else {
      freeze();
      setUserPaused(true);
    }
  };

  if (items.length === 0) return null;

  const renderTrack = (copy: boolean) => (
    <ul className="ticker__track" ref={copy ? undefined : trackRef} aria-hidden={copy || undefined}>
      {items.map((it) => (
        <li key={it.id} className="ticker__entry">
          <button
            type="button"
            className="ticker__item"
            tabIndex={copy ? -1 : undefined}
            onClick={(e) => onOpen(it.id, e.currentTarget)}
          >
            <span className="ticker__date">{formatDate(it.day, it.date_precision)}</span>
            <CategoryGlyph category={it.category} className="ticker__glyph" />
            <span className="visually-hidden">{CATEGORY_LABEL[it.category]}: </span>
            <span className="ticker__title">{it.title}</span>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <section className="ticker" data-mode={manual ? 'manual' : 'auto'} aria-label="Every item, newest first">
      {!reduced && (
        <button
          type="button"
          className="ticker__toggle"
          aria-pressed={userPaused}
          onClick={togglePause}
          title={userPaused ? 'Resume scrolling' : 'Pause scrolling'}
        >
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
            {userPaused ? <polygon points="2.5,1.5 10.5,6 2.5,10.5" /> : <path d="M2.5 1.5h2.6v9H2.5zM6.9 1.5h2.6v9H6.9z" />}
          </svg>
          <span>{userPaused ? 'Play' : 'Pause'}</span>
        </button>
      )}
      <div className="ticker__viewport" ref={viewportRef} onFocus={onFocus} onBlur={onBlur}>
        <div
          className="ticker__rail"
          ref={railRef}
          style={{ animationDuration: `${duration}s`, animationDelay: `${delay}s` }}
        >
          {renderTrack(false)}
          {!reduced && renderTrack(true)}
        </div>
      </div>
    </section>
  );
});
