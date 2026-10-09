import type { ReactNode } from 'react';

/** Positioned inside the plot wrapper; flips to the left of the anchor past mid-width. */
export function ChartTooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const flip = x > width / 2;
  return (
    <div
      className="tooltip chart-tip"
      data-open
      aria-hidden="true"
      style={{ left: x, top: y, transform: `translate(${flip ? 'calc(-100% - 12px)' : '12px'}, -50%)` }}
    >
      {children}
    </div>
  );
}
