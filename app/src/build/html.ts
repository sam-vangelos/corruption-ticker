/** Escape text for HTML element content and double-quoted attribute values. */
export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Head metadata for one page. Every value is plain text; escaping happens here. */
export interface PageMeta {
  title: string;
  description: string;
  /** Absolute URL of this page. */
  url: string;
  siteName: string;
  type: 'website' | 'article';
  /** og:title / twitter:title; defaults to `title`. */
  ogTitle?: string;
  publishedTime?: string;
  modifiedTime?: string;
  /** Extra <link> tags, already escaped. */
  extraLinks?: string[];
}

/**
 * Open Graph and Twitter card tags. No og:image in this wave: an image is
 * omitted rather than faked, so the card type is "summary".
 */
export function metaTags(m: PageMeta): string {
  const og = m.ogTitle ?? m.title;
  const tags = [
    `<meta name="description" content="${esc(m.description)}" />`,
    `<link rel="canonical" href="${esc(m.url)}" />`,
    `<meta property="og:site_name" content="${esc(m.siteName)}" />`,
    `<meta property="og:type" content="${m.type}" />`,
    `<meta property="og:title" content="${esc(og)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`,
    `<meta property="og:url" content="${esc(m.url)}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${esc(og)}" />`,
    `<meta name="twitter:description" content="${esc(m.description)}" />`,
  ];
  if (m.publishedTime) tags.push(`<meta property="article:published_time" content="${esc(m.publishedTime)}" />`);
  if (m.modifiedTime) tags.push(`<meta property="article:modified_time" content="${esc(m.modifiedTime)}" />`);
  for (const l of m.extraLinks ?? []) tags.push(l);
  return tags.join('\n    ');
}

/**
 * Fill the built index.html: replace <title>, add the meta tags, and put
 * `body` inside #root (React replaces it when the app mounts; without
 * JavaScript it is the page).
 */
export function fillShell(shell: string, m: PageMeta, body: string, noscript: string): string {
  if (!/<title>[\s\S]*?<\/title>/.test(shell)) throw new Error('prerender: no <title> in dist/index.html');
  if (!shell.includes('<div id="root"></div>')) throw new Error('prerender: no empty <div id="root"></div> in dist/index.html');
  const titled = shell.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(m.title)}</title>\n    ${metaTags(m)}`);
  const rooted = titled.replace('<div id="root"></div>', () => `<div id="root">${body}</div>`);
  return rooted.replace(/<noscript>[\s\S]*?<\/noscript>/, () => `<noscript>${esc(noscript)}</noscript>`);
}
