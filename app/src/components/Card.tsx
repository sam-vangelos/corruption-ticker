import { memo } from 'react';
import type { Item } from '../types';
import { CATEGORY_LABEL, CategoryGlyph } from '../categories';
import { StatusBadge } from '../status';
import { formatDate } from '../data/dates';
import { formatUsd, formatUsdCompact } from '../data/format';

interface CardProps {
  item: Item;
  onOpen: (id: string, opener: HTMLElement) => void;
  onActor: (actor: string) => void;
}

/** One item in the stream. The whole card is focusable; click or Enter opens the drawer. */
export const Card = memo(function Card({ item, onOpen, onActor }: CardProps) {
  const titleId = `card-title-${item.id}`;
  return (
    <article
      className="card"
      tabIndex={0}
      data-card-id={item.id}
      aria-labelledby={titleId}
      onClick={(e) => onOpen(item.id, e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) {
          e.preventDefault();
          onOpen(item.id, e.currentTarget);
        }
      }}
    >
      <div className="card__meta">
        <time dateTime={item.date}>{formatDate(item.day, item.date_precision)}</time>
        <span className="card__cat">
          <CategoryGlyph category={item.category} />
          {CATEGORY_LABEL[item.category]}
        </span>
        <StatusBadge status={item.status} />
      </div>

      <h3 className="card__title" id={titleId}>{item.title}</h3>

      {(item.actors.length > 0 || item.hasDollar) && (
        <div className="card__row">
          {item.actors.length > 0 && (
            <ul className="chips" aria-label="Actors">
              {item.actors.map((a) => (
                <li key={a}>
                  <button
                    type="button"
                    className="chip"
                    title={`Show only items involving ${a}`}
                    onClick={(e) => { e.stopPropagation(); onActor(a); }}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    {a}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {item.hasDollar && item.dollar_amount_usd !== null && (
            <p className="card__usd" title={`${formatUsd(item.dollar_amount_usd)} as reported`}>
              <span className="visually-hidden">Reported figure: </span>
              {formatUsdCompact(item.dollar_amount_usd)}
              <span className="card__usd-note"> reported</span>
            </p>
          )}
        </div>
      )}

      {item.sources.length > 0 && (
        <p className="card__sources">
          <span className="card__sources-label">Sources </span>
          {item.sources.map((s, i) => (
            <span key={`${s.url}-${i}`}>
              {i > 0 && ', '}
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {s.outlet}
                <span className="visually-hidden"> (opens in a new tab)</span>
              </a>
            </span>
          ))}
        </p>
      )}
    </article>
  );
});
