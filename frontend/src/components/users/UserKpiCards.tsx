import type { KpiSummary } from '../../types/users';

interface Props {
  kpiSummary: KpiSummary | null;
  loading:    boolean;
}

// ── Icons (20px) ───────────────────────────────────────────────────────────────

function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

function IconBan() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
    </svg>
  );
}

function IconMail() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}

// ── Card definitions ───────────────────────────────────────────────────────────

interface CardDef {
  label:     string;
  valueKey:  keyof KpiSummary;
  changeKey: keyof KpiSummary;
  topLine:   string;
  iconBg:    string;
  iconColor: string;
  Icon:      () => React.ReactElement;
}

const CARDS: CardDef[] = [
  { label: 'Total Users',          valueKey: 'totalUsers',          changeKey: 'totalUsersChange',          topLine: '#3b82f6', iconBg: '#eff6ff', iconColor: '#2563eb', Icon: IconUsers  },
  { label: 'Active Users',         valueKey: 'activeUsers',         changeKey: 'activeUsersChange',         topLine: '#22c55e', iconBg: '#f0fdf4', iconColor: '#16a34a', Icon: IconCheck  },
  { label: 'Pending Verification', valueKey: 'pendingVerification', changeKey: 'pendingVerificationChange', topLine: '#f59e0b', iconBg: '#fefce8', iconColor: '#ca8a04', Icon: IconClock  },
  { label: 'Suspended Users',      valueKey: 'suspendedUsers',      changeKey: 'suspendedUsersChange',      topLine: '#ef4444', iconBg: '#fef2f2', iconColor: '#dc2626', Icon: IconBan    },
  { label: 'Invitations Pending',  valueKey: 'invitationsPending',  changeKey: 'invitationsPendingChange',  topLine: '#a855f7', iconBg: '#faf5ff', iconColor: '#7c3aed', Icon: IconMail   },
];

// ── Shimmer helper ─────────────────────────────────────────────────────────────

function sk(w: number | string, h: number, r = 4): React.CSSProperties {
  return {
    width: w, height: h, borderRadius: r,
    background: 'linear-gradient(90deg,#f0f3f7 25%,#e8ecf2 50%,#f0f3f7 75%)',
    backgroundSize: '600px 100%',
    animation: 'mn-shimmer 1.3s ease-in-out infinite',
    flexShrink: 0,
  };
}

function SkeletonCard() {
  return (
    <div style={{
      background: '#fff', borderRadius: 8, padding: '12px 16px',
      border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#e5e7eb' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={sk(32, 32, 16)} />
        <div style={sk(80, 10)} />
      </div>
      <div style={{ ...sk(56, 22), marginBottom: 6 }} />
      <div style={sk(90, 9)} />
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function UserKpiCards({ kpiSummary, loading }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 16 }}>
      {loading && !kpiSummary
        ? CARDS.map(c => <SkeletonCard key={c.label} />)
        : CARDS.map(({ label, valueKey, changeKey, topLine, iconBg, iconColor, Icon }) => {
            const value  = (kpiSummary?.[valueKey]  ?? 0) as number;
            const change = (kpiSummary?.[changeKey] ?? 0) as number;
            const up     = change >= 0;

            return (
              <div
                key={label}
                style={{
                  background: '#ffffff', border: '1px solid #e5e7eb',
                  borderRadius: 8, padding: '12px 16px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  position: 'relative', overflow: 'hidden',
                }}
              >
                {/* 3px colored top stripe */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: topLine }} />

                {/* Icon + label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingTop: 2 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: iconBg, color: iconColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.2 }}>
                    {label}
                  </span>
                </div>

                {/* Value */}
                <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', lineHeight: 1, marginBottom: 5, letterSpacing: '-0.5px' }}>
                  {value.toLocaleString()}
                </div>

                {/* Change */}
                <div style={{ fontSize: 11, color: up ? '#16a34a' : '#dc2626', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ fontWeight: 600 }}>{up ? '↑' : '↓'} {Math.abs(change)}%</span>
                  <span style={{ color: '#9ca3af' }}>vs last month</span>
                </div>
              </div>
            );
          })
      }
    </div>
  );
}
