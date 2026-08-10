// Shared bits reused across the Integrations module's tabs — badges, table
// cell styles, and small building blocks. Kept here instead of duplicated
// per-tab, same convention as components/notifications/shared.tsx.

import { Clock } from 'lucide-react';

export const CARD: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' };
export const CARD_PAD: React.CSSProperties = { ...CARD, padding: 18 };
export const CARD_TITLE: React.CSSProperties = { margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#0f172a' };
export const EMPTY: React.CSSProperties = { fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '40px 0' };
export const TH: React.CSSProperties = { textAlign: 'left', padding: '10px 14px', fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.3, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' };
export const TD: React.CSSProperties = { padding: '11px 14px', fontSize: 13, color: '#374151', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' };
export const INPUT: React.CSSProperties = { padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none', border: '1px solid #d1d5db', borderRadius: 6, color: '#374151', background: '#fff' };
export const LABEL: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };
export const ERR: React.CSSProperties = { fontSize: 11, color: '#ef4444', marginTop: 3 };
export const BTN_PRIMARY: React.CSSProperties = { padding: '9px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' };
export const BTN_SECONDARY: React.CSSProperties = { padding: '9px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer' };
export const BTN_DANGER: React.CSSProperties = { padding: '9px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' };

export const CATEGORY_LABELS: Record<string, string> = {
  PAYMENT: 'Payment', VIDEO: 'Video', EMAIL: 'Email', SMS: 'SMS',
  HR_ERP: 'HR & ERP', CRM: 'CRM', STORAGE: 'Storage', AUTH: 'Auth & SSO', OTHER: 'Other',
};

const STATUS_COLOR: Record<string, string> = {
  CONNECTED: '#16a34a', DISCONNECTED: '#64748b', ERROR: '#dc2626', PENDING: '#c2410c', COMING_SOON: '#2563eb',
};
export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? '#64748b';
  const label = status === 'COMING_SOON' ? 'Coming Soon' : status.charAt(0) + status.slice(1).toLowerCase();
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: `${color}1a`, color, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: '#f1f5f9', color: '#475569', whiteSpace: 'nowrap' }}>
      {CATEGORY_LABELS[category] ?? category}
    </span>
  );
}

const LOG_STATUS_COLOR: Record<string, string> = { SUCCESS: '#16a34a', FAILED: '#dc2626', PENDING: '#c2410c' };
export function LogStatusBadge({ status }: { status: string }) {
  const color = LOG_STATUS_COLOR[status] ?? '#64748b';
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: `${color}1a`, color }}>{status}</span>;
}

const API_KEY_STATUS_COLOR: Record<string, string> = { ACTIVE: '#16a34a', REVOKED: '#dc2626', EXPIRED: '#64748b' };
export function ApiKeyStatusBadge({ status }: { status: string }) {
  const color = API_KEY_STATUS_COLOR[status] ?? '#64748b';
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: `${color}1a`, color }}>{status}</span>;
}

const WEBHOOK_STATUS_COLOR: Record<string, string> = { ACTIVE: '#16a34a', PAUSED: '#c2410c', FAILED: '#dc2626' };
export function WebhookStatusBadge({ status }: { status: string }) {
  const color = WEBHOOK_STATUS_COLOR[status] ?? '#64748b';
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: `${color}1a`, color }}>{status}</span>;
}

const SYNC_STATUS_COLOR: Record<string, string> = { RUNNING: '#2563eb', COMPLETED: '#16a34a', FAILED: '#dc2626', PAUSED: '#64748b' };
export function SyncStatusBadge({ status }: { status: string }) {
  const color = SYNC_STATUS_COLOR[status] ?? '#64748b';
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: `${color}1a`, color }}>{status}</span>;
}

export function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function Pager({ page, limit, total, onPage }: { page: number; limit: number; total: number; onPage: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, padding: '12px 14px', fontSize: 12.5, color: '#64748b' }}>
      <span>Page {page} of {totalPages} · {total} total</span>
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} style={{ ...BTN_SECONDARY, padding: '5px 10px', opacity: page <= 1 ? 0.5 : 1 }}>Prev</button>
      <button type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)} style={{ ...BTN_SECONDARY, padding: '5px 10px', opacity: page >= totalPages ? 0.5 : 1 }}>Next</button>
    </div>
  );
}

// A catalog entry with no real backing provider — every non-Zoom/Supabase/SMTP
// row in the catalog renders this. Deliberately does NOT call connect/test
// (task rule: no fake API calls for unbuilt integrations).
export function ComingSoonCard({
  name, description, onRequestAccess,
}: { name: string; description: string; onRequestAccess: () => void }) {
  return (
    <div style={CARD_PAD}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>
          {name.charAt(0)}
        </div>
        <StatusBadge status="COMING_SOON" />
      </div>
      <div style={{ marginTop: 12, fontSize: 14.5, fontWeight: 700, color: '#0f172a' }}>{name}</div>
      <div style={{ marginTop: 4, fontSize: 12.5, color: '#64748b', lineHeight: 1.5, minHeight: 36 }}>{description}</div>
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" style={{ ...BTN_SECONDARY, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={onRequestAccess}>
          <Clock size={13} strokeWidth={2} />
          Request Early Access
        </button>
      </div>
    </div>
  );
}
