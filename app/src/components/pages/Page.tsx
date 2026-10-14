import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { SITE_NAME } from '../../method';
import { inAppNavigations } from '../../router';

interface PageProps {
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}

/**
 * A standalone page: sets the document title, and on arrival by an in-app
 * link moves focus to its heading (so a screen reader announces the new page)
 * or scrolls to the #fragment the link named.
 */
export function Page({ title, lead, children }: PageProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = `${title} | ${SITE_NAME}`;
  }, [title]);
  useLayoutEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    const target = id ? document.getElementById(id) : null;
    if (target) {
      target.scrollIntoView();
      if (target.tabIndex >= -1 && target.hasAttribute('tabindex')) target.focus({ preventScroll: true });
    } else if (inAppNavigations() > 0) {
      window.scrollTo(0, 0);
      headingRef.current?.focus();
    }
  }, []);
  return (
    <article className="page">
      <h1 className="page__title" ref={headingRef} tabIndex={-1}>{title}</h1>
      {lead && <div className="page__lead">{lead}</div>}
      {children}
    </article>
  );
}
