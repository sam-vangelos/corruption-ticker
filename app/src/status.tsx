import type { Status } from './types';

/**
 * Status: a reserved palette (never reused for categories, never themed),
 * always shown as icon + text label. The icon outline is drawn in ink so its
 * shape stays legible even where a status hue is light on a light surface.
 */
export const STATUS_LABEL: Record<Status, string> = {
  reported: 'Reported',
  'under-investigation': 'Under investigation',
  litigation: 'In litigation',
  confirmed: 'Confirmed',
  disputed: 'Disputed',
  retracted: 'Retracted',
};

const STATUS_VAR: Record<Status, string> = {
  reported: 'var(--status-reported)',
  'under-investigation': 'var(--status-investigation)',
  litigation: 'var(--status-litigation)',
  confirmed: 'var(--status-confirmed)',
  disputed: 'var(--status-disputed)',
  retracted: 'var(--status-retracted)',
};

export function statusColor(s: Status): string {
  return STATUS_VAR[s];
}

/** 14x14 icons, each a distinct shape; fill = status hue, outline = current ink (always >= 3:1). */
function iconBody(s: Status, c: string): JSX.Element {
  switch (s) {
    case 'reported': // plain disc: on the record, nothing further yet
      return <circle cx="7" cy="7" r="4.8" fill={c} stroke="currentColor" strokeWidth="1.2" />;
    case 'under-investigation': // magnifier
      return (
        <>
          <circle cx="6" cy="6" r="4" fill={c} stroke="currentColor" strokeWidth="1" />
          <path d="M9 9l3.6 3.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case 'litigation': // scales: beam, post, two pans
      return (
        <>
          <path d="M7 2v9.5M3.5 12.5h7M2 4h10" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" />
          <path d="M0.8 8.2l1.7-3.6 1.7 3.6zM9.8 8.2l1.7-3.6 1.7 3.6z" fill={c} stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round" />
        </>
      );
    case 'confirmed': // filled disc with check
      return (
        <>
          <circle cx="7" cy="7" r="6" fill={c} stroke="currentColor" strokeWidth="1" />
          <path d="M4 7.2l2 2 4-4.3" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'disputed': // half-filled disc: contested
      return (
        <>
          <circle cx="7" cy="7" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <path d="M7 1.4a5.6 5.6 0 0 1 0 11.2z" fill={c} stroke="currentColor" strokeWidth="1" />
        </>
      );
    case 'retracted': // struck-through disc
      return (
        <>
          <circle cx="7" cy="7" r="5.4" fill={c} stroke="currentColor" strokeWidth="1.2" />
          <path d="M2.6 11.4l8.8-8.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      );
  }
}

export function StatusIcon({ status }: { status: Status }) {
  return (
    <svg className="status-icon" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false">
      {iconBody(status, STATUS_VAR[status])}
    </svg>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className="status-badge" data-status={status}>
      <StatusIcon status={status} />
      <span>{STATUS_LABEL[status]}</span>
    </span>
  );
}
