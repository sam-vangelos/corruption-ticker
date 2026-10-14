import { useEffect, useState } from 'react';

/**
 * A minimal path router for the static site. Every route also exists as a
 * real file in dist/ (the prerender writes route shells and record pages), so
 * a static host serves each URL directly; in the browser, links navigate with
 * the History API and nothing reloads.
 */
export type Route =
  | { kind: 'home' }
  | { kind: 'record'; id: string }
  | { kind: 'method' }
  | { kind: 'corrections' }
  | { kind: 'recent' }
  | { kind: 'subscribe' }
  | { kind: 'notfound'; path: string };

export function parseRoute(pathname: string): Route {
  const path = pathname.replace(/\/index\.html$/, '/').replace(/\/+$/, '') || '/';
  if (path === '/') return { kind: 'home' };
  const rec = /^\/r\/([^/]+)$/.exec(path);
  if (rec && rec[1]) {
    try { return { kind: 'record', id: decodeURIComponent(rec[1]) }; } catch { return { kind: 'notfound', path }; }
  }
  switch (path) {
    case '/method': return { kind: 'method' };
    case '/corrections': return { kind: 'corrections' };
    case '/recent': return { kind: 'recent' };
    case '/subscribe': return { kind: 'subscribe' };
    default: return { kind: 'notfound', path };
  }
}

/** Canonical path for a record page. */
export const recordPath = (id: string) => `/r/${encodeURIComponent(id)}/`;

let navigations = 0;
/** How many in-app navigations have happened since load (0 on a fresh page load). */
export const inAppNavigations = () => navigations;

/** Push (or replace) a URL and tell every listener, the same way the back button would. */
export function navigate(href: string, opts: { replace?: boolean } = {}) {
  navigations += 1;
  const url = new URL(href, window.location.href);
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== current) {
    if (opts.replace) window.history.replaceState(window.history.state, '', next);
    else window.history.pushState(null, '', next);
  }
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** onClick for an in-app <a href>: plain left clicks navigate in place; modified clicks behave normally. */
export function followLink(e: React.MouseEvent<HTMLAnchorElement>, href?: string) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  navigate(href ?? e.currentTarget.getAttribute('href') ?? '/');
}

export function useRoute(): { route: Route; hash: string } {
  const read = () => ({ route: parseRoute(window.location.pathname), hash: window.location.hash });
  const [state, setState] = useState(read);
  useEffect(() => {
    const onPop = () => setState(read());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return state;
}
