// Shared inline-style primitives + small components reused across every
// Finance tab (13 tabs, same visual vocabulary as Competencies/Reports —
// ChartCard/ChartSkeleton/EmptyChart mirror ReportsOverviewTab.tsx 1:1).
// Kept in one file purely to avoid pasting the same ~10 constants into 13
// near-identical CRUD tab files — not a new pattern, just DRY given the
// module's size.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getUsers } from '../../api/users';

export const INPUT: React.CSSProperties = {
  padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  border: '1px solid #d1d5db', borderRadius: 6, color: '#374151', background: '#fff',
};
export const FULL_INPUT: React.CSSProperties = { ...INPUT, width: '100%', boxSizing: 'border-box' };
export const LABEL: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };
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
export const ICON_BTN: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 };

export function Badge({ text, colors }: { text: string; colors: { bg: string; fg: string } }) {
  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: colors.bg, color: colors.fg, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  );
}

export function ChartCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
      {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 14, borderRadius: 4, background: '#e5e7eb', width: `${55 + i * 8}%` }} />)}
    </div>
  );
}

export function EmptyChart({ label }: { label: string }) {
  return <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13 }}>{label}</div>;
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

export function PaginationBar({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 14, borderTop: '1px solid #f1f5f9' }}>
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>Prev</button>
      <span style={{ fontSize: 12, color: '#64748b' }}>Page {page} of {pages}</span>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: page >= pages ? 'default' : 'pointer', opacity: page >= pages ? 0.5 : 1 }}>Next</button>
    </div>
  );
}

export function TableShell({ headers, children, colSpan, loading, empty }: {
  headers: { label: string; align?: 'left' | 'center' | 'right' }[];
  children: ReactNode; colSpan: number; loading: boolean; empty: boolean;
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
            {headers.map(h => (
              <th key={h.label} style={{ textAlign: h.align ?? 'left', padding: '10px 12px', color: '#94a3b8', fontWeight: 600, fontSize: 11.5, whiteSpace: 'nowrap' }}>{h.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={colSpan} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Loading…</td></tr>
          ) : empty ? (
            <tr><td colSpan={colSpan} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No records found.</td></tr>
          ) : children}
        </tbody>
      </table>
    </div>
  );
}

export function Modal({ title, onClose, children, maxWidth = 480, submitting }: {
  title: string; onClose: () => void; children: ReactNode; maxWidth?: number; submitting?: boolean;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={!submitting ? onClose : undefined} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>{title}</h3>
          <button type="button" onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ModalFooter({ onCancel, submitting, submitLabel = 'Save' }: { onCancel: () => void; submitting: boolean; submitLabel?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
      <button type="button" onClick={onCancel} disabled={submitting} style={BTN_SECONDARY}>Cancel</button>
      <button type="submit" disabled={submitting} style={{ ...BTN_PRIMARY, opacity: submitting ? 0.7 : 1 }}>{submitting ? 'Saving…' : submitLabel}</button>
    </div>
  );
}

// Debounced user search-and-pick — every Finance create modal that needs a
// userId (Subscriptions, Invoices) uses this instead of a raw text input, per
// R2 (selects read their source entity's query key, never hardcoded).
export function UserPicker({ value, onChange, label = 'User' }: { value: { id: string; label: string } | null; onChange: (u: { id: string; label: string } | null) => void; label?: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; fullName: string; email: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    setLoading(true);
    const handle = setTimeout(() => {
      getUsers({ search: query.trim(), limit: 8 })
        .then(res => setResults(res.users ?? []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <label style={LABEL}>{label}</label>
      {value ? (
        <div style={{ ...FULL_INPUT, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{value.label}</span>
          <button type="button" onClick={() => { onChange(null); setQuery(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 12 }}>Change</button>
        </div>
      ) : (
        <>
          <input
            style={FULL_INPUT} value={query} placeholder="Search by name or email…"
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
          />
          {open && query.trim() && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, marginTop: 4, maxHeight: 220, overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.12)' }}>
              {loading ? (
                <div style={{ padding: 12, fontSize: 12, color: '#94a3b8' }}>Searching…</div>
              ) : results.length === 0 ? (
                <div style={{ padding: 12, fontSize: 12, color: '#94a3b8' }}>No users found.</div>
              ) : results.map(u => (
                <button
                  key={u.id} type="button"
                  onClick={() => { onChange({ id: u.id, label: `${u.fullName} (${u.email})` }); setOpen(false); }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12.5, background: 'none', border: 'none', cursor: 'pointer', color: '#374151' }}
                >
                  <div style={{ fontWeight: 600 }}>{u.fullName}</div>
                  <div style={{ color: '#94a3b8', fontSize: 11 }}>{u.email}</div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function money(v: number | null | undefined, currency = 'USD'): string {
  if (v === null || v === undefined) return '—';
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(v); }
  catch { return `$${v.toFixed(2)}`; }
}

export function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}
