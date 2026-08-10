// Shared inline-style primitives reused across every System Settings tab
// (20 tabs, same visual vocabulary as Finance/Competencies). Kept in one file
// purely to avoid pasting the same constants into 20 near-identical files —
// same rationale as finance/_shared.tsx.

import { useEffect, type ReactNode } from 'react';

// Only the active tab is mounted at a time (see SystemSettingsPage), so the
// header's page-level "Save All Changes" button can't call every tab's
// submit handler directly. It dispatches this DOM CustomEvent instead — same
// bridge convention AdminLayout already uses (openNotificationsPanel,
// analyticsUpdated) — and whichever form tab is currently mounted submits
// itself. Tabs with nothing to save (read-only / Coming Soon) just don't
// call this hook.
export const SAVE_ALL_EVENT = 'settings:saveAll';

export function useSaveAllListener(handler: () => void) {
  useEffect(() => {
    window.addEventListener(SAVE_ALL_EVENT, handler);
    return () => window.removeEventListener(SAVE_ALL_EVENT, handler);
  }, [handler]);
}

export const INPUT: React.CSSProperties = {
  padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  border: '1px solid #d1d5db', borderRadius: 6, color: '#374151', background: '#fff',
};
export const FULL_INPUT: React.CSSProperties = { ...INPUT, width: '100%', boxSizing: 'border-box' };
export const LABEL: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };
export const HINT: React.CSSProperties = { fontSize: 11.5, color: '#94a3b8', marginTop: 4 };
export const ERR: React.CSSProperties = { fontSize: 11, color: '#ef4444', marginTop: 3 };

export const BTN_PRIMARY: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', fontSize: 13, fontWeight: 600,
  fontFamily: 'inherit', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
};
export const BTN_SECONDARY: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', fontSize: 13, fontWeight: 600,
  fontFamily: 'inherit', background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer',
};
export const BTN_DANGER: React.CSSProperties = { ...BTN_PRIMARY, background: '#dc2626' };

export function Card({ title, subtitle, children, action }: { title?: string; subtitle?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24, marginBottom: 20 }}>
      {(title || action) && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            {title && <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{title}</div>}
            {subtitle && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{subtitle}</div>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function FormGrid({ children }: { children: ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>{children}</div>;
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label style={LABEL}>{label}</label>
      {children}
      {hint && <div style={HINT}>{hint}</div>}
    </div>
  );
}

export function ToggleRow({ label, description, checked, onChange, disabled, disabledHint }: {
  label: ReactNode; description?: string; checked: boolean; onChange: (v: boolean) => void;
  disabled?: boolean; disabledHint?: string;
}) {
  return (
    <div
      title={disabled ? disabledHint : undefined}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 14px', background: '#f8fafc', borderRadius: 8, opacity: disabled ? 0.6 : 1,
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{label}</div>
        {description && <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>{description}</div>}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          width: 42, height: 24, borderRadius: 999, border: 'none',
          background: checked ? '#2563eb' : '#cbd5e1',
          cursor: disabled ? 'not-allowed' : 'pointer', position: 'relative', flexShrink: 0,
        }}
      >
        <span style={{ position: 'absolute', top: 2, left: checked ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
      </button>
    </div>
  );
}

export function ComingSoonCard({ label, description }: { label: string; description?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 24px', textAlign: 'center' }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 12.5, color: '#94a3b8', maxWidth: 360 }}>{description ?? 'This feature is coming soon.'}</div>
    </div>
  );
}

export function ComingSoonBadge() {
  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: '#f1f5f9', color: '#94a3b8', whiteSpace: 'nowrap' }}>
      COMING SOON
    </span>
  );
}

export function StatusBadge({ text, tone }: { text: string; tone: 'success' | 'warn' | 'neutral' }) {
  const colors = tone === 'success' ? { bg: '#dcfce7', fg: '#15803d' } : tone === 'warn' ? { bg: '#fef3c7', fg: '#b45309' } : { bg: '#f1f5f9', fg: '#64748b' };
  return <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: colors.bg, color: colors.fg, whiteSpace: 'nowrap' }}>{text}</span>;
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, color: '#b91c1c' }}>
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 5, color: '#b91c1c', fontSize: 12, fontWeight: 600, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
      {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 14, borderRadius: 4, background: '#e5e7eb', width: `${55 + i * 8}%` }} />)}
    </div>
  );
}

export function SaveBar({ submitting, label = 'Save Settings', savedAt, updatedByName }: {
  submitting: boolean; label?: string; savedAt?: string | null; updatedByName?: string | null;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8 }}>
      <button type="submit" disabled={submitting} style={{ ...BTN_PRIMARY, opacity: submitting ? 0.7 : 1 }}>
        {submitting ? 'Saving…' : label}
      </button>
      {savedAt && (
        <span style={{ fontSize: 11.5, color: '#94a3b8' }}>
          Last updated {new Date(savedAt).toLocaleString()}{updatedByName ? ` by ${updatedByName}` : ''}
        </span>
      )}
    </div>
  );
}

export function fmtBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
