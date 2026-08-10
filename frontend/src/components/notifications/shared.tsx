// Shared bits reused across the Notifications module's tabs — badges, table
// cell styles, and a small pager. Kept here instead of duplicated per-tab
// (8+ tabs render the same status/priority vocabulary).

export const CARD: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' };
export const CARD_PAD: React.CSSProperties = { ...CARD, padding: 18 };
export const EMPTY: React.CSSProperties = { fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '40px 0' };
export const TH: React.CSSProperties = { textAlign: 'left', padding: '10px 14px', fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.3, borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' };
export const TD: React.CSSProperties = { padding: '11px 14px', fontSize: 13, color: '#374151', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' };
export const INPUT: React.CSSProperties = { padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none', border: '1px solid #d1d5db', borderRadius: 6, color: '#374151', background: '#fff' };
export const LABEL: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };
export const ERR: React.CSSProperties = { fontSize: 11, color: '#ef4444', marginTop: 3 };
export const BTN_PRIMARY: React.CSSProperties = { padding: '9px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' };
export const BTN_SECONDARY: React.CSSProperties = { padding: '9px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer' };
export const BTN_DANGER: React.CSSProperties = { padding: '9px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' };

const LOG_STATUS_COLOR: Record<string, string> = {
  SENT: '#16a34a', OPENED: '#2563eb', CLICKED: '#4338ca', PENDING: '#c2410c', FAILED: '#dc2626', BOUNCED: '#dc2626',
};
export function LogStatusBadge({ status }: { status: string }) {
  const color = LOG_STATUS_COLOR[status] ?? '#64748b';
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: `${color}1a`, color }}>
      {status}
    </span>
  );
}

const PRIORITY_COLOR: Record<string, string> = { LOW: '#64748b', NORMAL: '#2563eb', HIGH: '#c2410c', URGENT: '#dc2626' };
export function PriorityBadge({ priority }: { priority: string }) {
  const color = PRIORITY_COLOR[priority] ?? '#64748b';
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: `${color}1a`, color }}>
      {priority}
    </span>
  );
}

const ANNOUNCEMENT_STATUS_COLOR: Record<string, string> = { DRAFT: '#64748b', SCHEDULED: '#a16207', SENT: '#16a34a', CANCELLED: '#dc2626' };
export function AnnouncementStatusBadge({ status }: { status: string }) {
  const color = ANNOUNCEMENT_STATUS_COLOR[status] ?? '#64748b';
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: `${color}1a`, color }}>
      {status}
    </span>
  );
}

const AUTOMATION_STATUS_COLOR: Record<string, string> = { ACTIVE: '#16a34a', PAUSED: '#a16207' };
export function AutomationStatusBadge({ status }: { status: string }) {
  const color = AUTOMATION_STATUS_COLOR[status] ?? '#64748b';
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: `${color}1a`, color }}>
      {status}
    </span>
  );
}

const TEMPLATE_STATUS_COLOR: Record<string, string> = { ACTIVE: '#16a34a', INACTIVE: '#64748b' };
export function TemplateStatusBadge({ status }: { status: string }) {
  const color = TEMPLATE_STATUS_COLOR[status] ?? '#64748b';
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: `${color}1a`, color }}>
      {status}
    </span>
  );
}

export function ChannelBadge({ channel }: { channel: string }) {
  const colors: Record<string, string> = { EMAIL: '#2563eb', PUSH: '#7c3aed', SMS: '#f59e0b', IN_APP: '#16a34a' };
  const color = colors[channel] ?? '#64748b';
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: `${color}1a`, color }}>
      {channel === 'IN_APP' ? 'IN-APP' : channel}
    </span>
  );
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
