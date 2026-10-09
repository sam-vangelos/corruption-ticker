import { useState } from 'react';

/**
 * Shared hover/focus state for a chart: one active datum index, driven by the
 * pointer or by arrow keys while the plot has focus (same readout either way).
 */
export function useActive(n: number, orientation: 'horizontal' | 'vertical' = 'horizontal') {
  const [active, setActive] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const next = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
  const prev = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (n === 0) return;
    const cur = active ?? (orientation === 'horizontal' ? n - 1 : 0);
    let to: number | null = null;
    if (e.key === next) to = Math.min(n - 1, cur + 1);
    else if (e.key === prev) to = Math.max(0, cur - 1);
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = n - 1;
    else if (e.key === 'Escape' && active !== null) { e.stopPropagation(); setActive(null); return; }
    if (to !== null) { e.preventDefault(); setActive(to); }
  };

  return {
    active,
    setActive,
    focused,
    plotProps: {
      tabIndex: 0,
      onKeyDown,
      onFocus: () => { setFocused(true); setActive((a) => a ?? (orientation === 'horizontal' ? n - 1 : 0)); },
      onBlur: () => { setFocused(false); setActive(null); },
      onPointerLeave: () => { if (!focused) setActive(null); },
    },
  };
}
