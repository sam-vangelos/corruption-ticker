import type { EvidentiaryStatus, Item, ProceduralStatus, SubjectResponse } from './types';

/**
 * The three status fields (schema v2), always shown as three labelled chips:
 * field name, value, and an icon whose shape is unique within its field.
 * Icons are drawn in ink; the reserved status hues mark only the states a
 * reader most needs to spot: under investigation, in litigation, retracted.
 */
export const EVIDENTIARY_LABEL: Record<EvidentiaryStatus, string> = {
  finding: 'Finding',
  documented: 'Documented',
  corroborated: 'Corroborated',
  alleged: 'Alleged',
  retracted: 'Retracted',
};

export const PROCEDURAL_LABEL: Record<ProceduralStatus, string> = {
  none: 'No proceeding',
  'under-investigation': 'Under investigation',
  litigation: 'In litigation',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

export const RESPONSE_LABEL: Record<SubjectResponse | 'none', string> = {
  denied: 'Denied',
  'no-comment': 'No comment',
  admitted: 'Admitted',
  'not-sought': 'Not sought',
  'retracted-by-outlet': 'Retracted by outlet',
  none: 'Not recorded',
};

const INK = 'currentColor';
const sw = { stroke: INK, strokeWidth: 1.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function evidentiaryIcon(s: EvidentiaryStatus): JSX.Element {
  switch (s) {
    case 'finding': // seal: disc with a check
      return <><circle cx="7" cy="7" r="5.6" fill="none" {...sw} /><path d="M4.4 7.2l1.8 1.8 3.5-3.8" fill="none" {...sw} strokeWidth={1.6} /></>;
    case 'documented': // page with a folded corner and lines
      return <><path d="M3 1.5h5.5L11 4v8.5H3z" fill="none" {...sw} /><path d="M8.5 1.5V4H11M5 7h4M5 9.5h4" fill="none" {...sw} /></>;
    case 'corroborated': // two overlapping discs: two independent accounts
      return <><circle cx="5" cy="7" r="3.6" fill="none" {...sw} /><circle cx="9" cy="7" r="3.6" fill="none" {...sw} /></>;
    case 'alleged': // open speech mark
      return <path d="M2 3.5h10v6H6.5L3.5 12V9.5H2z" fill="none" {...sw} />;
    case 'retracted': // struck disc, retracted hue
      return <><circle cx="7" cy="7" r="5.4" fill="var(--status-retracted)" {...sw} /><path d="M2.8 11.2l8.4-8.4" {...sw} strokeWidth={1.8} /></>;
  }
}

function proceduralIcon(s: ProceduralStatus): JSX.Element {
  switch (s) {
    case 'none': // dashed ring: nothing under way
      return <circle cx="7" cy="7" r="5" fill="none" {...sw} strokeDasharray="1.6 1.6" />;
    case 'under-investigation': // magnifier
      return <><circle cx="6" cy="6" r="4" fill="var(--status-investigation)" {...sw} /><path d="M9 9l3.6 3.6" {...sw} strokeWidth={2} /></>;
    case 'litigation': // scales
      return <><path d="M7 2v9.5M3.5 12.5h7M2 4h10" fill="none" {...sw} /><path d="M0.8 8.2l1.7-3.6 1.7 3.6zM9.8 8.2l1.7-3.6 1.7 3.6z" fill="var(--status-litigation)" {...sw} strokeWidth={0.9} /></>;
    case 'resolved': // closed square with a check
      return <><rect x="2" y="2" width="10" height="10" rx="1.5" fill="none" {...sw} /><path d="M4.6 7.2l1.7 1.7 3.2-3.6" fill="none" {...sw} strokeWidth={1.5} /></>;
    case 'dismissed': // square with a cross
      return <><rect x="2" y="2" width="10" height="10" rx="1.5" fill="none" {...sw} /><path d="M5 5l4 4M9 5l-4 4" fill="none" {...sw} strokeWidth={1.5} /></>;
  }
}

function responseIcon(s: SubjectResponse | 'none'): JSX.Element {
  const bubble = (dash?: string) => <path d="M1.8 2.5h10.4v7H6.8L4 12V9.5H1.8z" fill="none" {...sw} strokeDasharray={dash} />;
  switch (s) {
    case 'denied':
      return <>{bubble()}<path d="M5.2 4.3l3.6 3.4M8.8 4.3L5.2 7.7" {...sw} /></>;
    case 'no-comment':
      return <>{bubble()}<path d="M4.6 6h.01M7 6h.01M9.4 6h.01" {...sw} strokeWidth={1.8} /></>;
    case 'admitted':
      return <>{bubble()}<path d="M4.8 6.1l1.5 1.4 2.9-3" fill="none" {...sw} /></>;
    case 'not-sought':
      return bubble('1.5 1.3');
    case 'retracted-by-outlet':
      return <>{bubble()}<path d="M1.5 12.5l11-11" {...sw} strokeWidth={1.6} /></>;
    case 'none':
      return <path d="M1.8 2.5h10.4v7H6.8L4 12V9.5H1.8z" fill="none" stroke={INK} strokeWidth={1} strokeDasharray="0.6 1.6" strokeLinecap="round" />;
  }
}

export function StatusIcon({ children }: { children: JSX.Element }) {
  return (
    <svg className="status-icon" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export const EvidentiaryIcon = ({ status }: { status: EvidentiaryStatus }) => <StatusIcon>{evidentiaryIcon(status)}</StatusIcon>;
export const ProceduralIcon = ({ status }: { status: ProceduralStatus }) => <StatusIcon>{proceduralIcon(status)}</StatusIcon>;
export const ResponseIcon = ({ status }: { status: SubjectResponse | 'none' }) => <StatusIcon>{responseIcon(status)}</StatusIcon>;

/** The three status fields as three labelled chips. */
export function StatusChips({ item, size = 'm' }: { item: Pick<Item, 'evidentiary_status' | 'procedural_status' | 'subject_response'>; size?: 's' | 'm' }) {
  const response = item.subject_response ?? 'none';
  return (
    <ul className={`status-chips status-chips--${size}`} aria-label="Status">
      <li className="status-chip" data-field="evidence" data-value={item.evidentiary_status}>
        <EvidentiaryIcon status={item.evidentiary_status} />
        <span className="status-chip__k">Evidence</span>
        <span className="status-chip__v">{EVIDENTIARY_LABEL[item.evidentiary_status]}</span>
      </li>
      <li className="status-chip" data-field="procedure" data-value={item.procedural_status}>
        <ProceduralIcon status={item.procedural_status} />
        <span className="status-chip__k">Procedure</span>
        <span className="status-chip__v">{PROCEDURAL_LABEL[item.procedural_status]}</span>
      </li>
      <li className="status-chip" data-field="response" data-value={response}>
        <ResponseIcon status={response} />
        <span className="status-chip__k">Response</span>
        <span className="status-chip__v">{RESPONSE_LABEL[response]}</span>
      </li>
    </ul>
  );
}
