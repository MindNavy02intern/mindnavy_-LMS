// Shared light-mode style constants for every /instructor/* content page.
// Copied verbatim from components/instructors/InstructorDocumentsTab.tsx (the
// admin reference) — NOT .mn-input/.mn-label/.mn-btn-primary/.mn-alert-error,
// which are dark-theme-only classes with no .mn-main-light override anywhere
// in brand.css (confirmed by reading every override block there). Using them
// on these white-card pages renders near-white text on a white background —
// see the UI-fix pass on InstructorProfilePage.tsx/InstructorDashboardPage.tsx
// for the full writeup. Extracted here once Phase 3 needed the same constants
// in a third and fourth file, rather than re-duplicating them again.
import type { CSSProperties } from 'react';

export const LABEL: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };
export const INPUT: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', color: '#374151', fontFamily: 'inherit', outline: 'none' };
export const BTN_PRIMARY: CSSProperties = { padding: '7px 14px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer' };
export const BTN_SECONDARY: CSSProperties = { padding: '7px 14px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer' };
export const BTN_DANGER: CSSProperties = { padding: '7px 14px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 7, cursor: 'pointer' };
export const ERROR_BANNER: CSSProperties = { padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#b91c1c' };
export const TH: CSSProperties = { padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left', whiteSpace: 'nowrap' };
export const TD: CSSProperties = { padding: '8px 10px', fontSize: 12, color: '#374151', borderTop: '1px solid #f1f5f9', verticalAlign: 'middle' };

export function disabledStyle(base: CSSProperties, disabled: boolean): CSSProperties {
  return disabled ? { ...base, opacity: 0.6, cursor: 'not-allowed' } : base;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  Draft:     { bg: '#f1f5f9', fg: '#475569' },
  Pending:   { bg: '#fef9c3', fg: '#a16207' },
  Published: { bg: '#dcfce7', fg: '#15803d' },
  Archived:  { bg: '#f1f5f9', fg: '#94a3b8' },
  Rejected:  { bg: '#fee2e2', fg: '#b91c1c' },
  UPCOMING:  { bg: '#dbeafe', fg: '#1d4ed8' },
  LIVE:      { bg: '#dcfce7', fg: '#15803d' },
  ENDED:     { bg: '#f1f5f9', fg: '#64748b' },
};

export function statusBadgeStyle(status: string): CSSProperties {
  const c = STATUS_COLORS[status] ?? { bg: '#f1f5f9', fg: '#64748b' };
  return { padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: c.bg, color: c.fg, whiteSpace: 'nowrap' };
}
