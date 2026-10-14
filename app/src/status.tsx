import type { EvidentiaryStatus, ProceduralStatus, SubjectResponse } from './types';

/** Labels for the three status fields (schema v2). */
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
  'not-sought': 'Response not sought',
  'retracted-by-outlet': 'Retracted by outlet',
  none: 'No response recorded',
};

/** Interim single badge (wave-2 commit 1); replaced by three labelled chips. */
export function StatusBadge({ status }: { status: EvidentiaryStatus }) {
  return (
    <span className="status-badge" data-status={status}>
      <span>{EVIDENTIARY_LABEL[status]}</span>
    </span>
  );
}
