import { useEffect, useRef } from 'react';

export interface ShortcutHandlers {
  focusSearch: () => void;
  toggleTheme?: () => void;
  toggleLargeType?: () => void;
  /** True while a modal (the drawer) owns the keyboard. */
  modalOpen: boolean;
}

const isTyping = (el: Element | null) =>
  !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement ||
    (el as HTMLElement).isContentEditable);

/**
 * Global keys: "/" search, j/k next/previous card, t theme, + large type.
 * Enter (open) lives on each card; Escape (close) on the drawer and popovers.
 * Ignored while typing in a field or with Ctrl/Meta/Alt held.
 */
export function useShortcuts(h: ShortcutHandlers) {
  const ref = useRef(h);
  ref.current = h;
  const lastCard = useRef<string | null>(null);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const card = (e.target as HTMLElement | null)?.closest?.('.card') as HTMLElement | null;
      if (card?.dataset.cardId) lastCard.current = card.dataset.cardId;
    };

    const moveCard = (delta: 1 | -1) => {
      const cards = [...document.querySelectorAll<HTMLElement>('.stream .card')];
      if (cards.length === 0) return;
      const current = (document.activeElement as HTMLElement | null)?.closest?.('.card') as HTMLElement | null;
      let idx = current ? cards.indexOf(current) : cards.findIndex((c) => c.dataset.cardId === lastCard.current);
      if (idx === -1) idx = delta === 1 ? -1 : cards.length;
      const next = cards[Math.max(0, Math.min(cards.length - 1, idx + delta))];
      if (!next) return;
      next.focus({ preventScroll: true });
      next.scrollIntoView({ block: 'nearest' });
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTyping(document.activeElement)) return;
      const { modalOpen } = ref.current;
      switch (e.key) {
        case '/':
          if (modalOpen) return;
          e.preventDefault();
          ref.current.focusSearch();
          break;
        case 'j':
        case 'k':
          if (modalOpen) return;
          e.preventDefault();
          moveCard(e.key === 'j' ? 1 : -1);
          break;
        case 't':
          if (!ref.current.toggleTheme) return;
          e.preventDefault();
          ref.current.toggleTheme();
          break;
        case '+':
          if (!ref.current.toggleLargeType) return;
          e.preventDefault();
          ref.current.toggleLargeType();
          break;
      }
    };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
}
