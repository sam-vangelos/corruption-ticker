import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';

/** Content-box width of an element, tracked with ResizeObserver. */
export function useWidth(ref: RefObject<HTMLElement>): number {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

const readRem = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

/** Root font size in px; follows the large-type toggle (an attribute change on <html>). */
export function useRem(): number {
  const [rem, setRem] = useState(readRem);
  useEffect(() => {
    const mo = new MutationObserver(() => setRem(readRem()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-type', 'style', 'class'] });
    return () => mo.disconnect();
  }, []);
  return rem;
}
