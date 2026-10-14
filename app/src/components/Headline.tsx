import type { Headline as HeadlineNumbers } from '../data/metrics';
import { formatInt } from '../data/format';
import { START_LABEL } from '../method';

interface HeadlineProps {
  headline: HeadlineNumbers;
  /** True when the loaded data is the placeholder fixture. */
  placeholder: boolean;
  /** Called for in-app navigation to the methodology page. */
  onNavigate: (href: string, e: React.MouseEvent<HTMLAnchorElement>) => void;
}

/** "1,168" for long intervals; one decimal below 100 hours so short intervals keep their precision. */
export function formatHours(h: number): string {
  if (h >= 100) return formatInt(Math.round(h));
  return (Math.round(h * 10) / 10).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

const n = (count: number, one: string, many: string) => (
  <><span className="headline__num">{formatInt(count)}</span> {count === 1 ? one : many}</>
);

/**
 * The front page's one honest number, worded per plans/concept.md § The
 * headline: two counts and an average with the counting rules one click away.
 * Always the whole record; filters never change it. The only display type.
 */
export function Headline({ headline, placeholder, onNavigate }: HeadlineProps) {
  const { records, events, intervalHours } = headline;
  return (
    <div className="headline">
      {placeholder && <p className="headline__tag">Placeholder data: these counts describe fake records</p>}
      <p className="headline__text">
        {n(records, 'qualifying record', 'qualifying records')} concerning {n(events, 'distinct event', 'distinct events')} since {START_LABEL}.
      </p>
      <p className="headline__interval">
        {intervalHours === null
          ? 'No qualifying events yet, so there is no average interval.'
          : <>One new qualifying record every {formatHours(intervalHours)} hours on average, counted over distinct events.</>}
        {' '}
        <a className="headline__how" href="/method#counting" onClick={(e) => onNavigate('/method#counting', e)}>How we count</a>
      </p>
    </div>
  );
}
