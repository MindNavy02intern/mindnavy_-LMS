import { useEffect, useMemo, useState } from 'react';
import type { PermissionMatrixData } from '../../types/rolesPage';
import { getPermissionMatrix } from '../../api/rolesPage';

const MAX_ROLES = 5;
const MAX_PERMS = 8;

interface Props {
  onViewFullMatrix: () => void;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PreviewSkeleton() {
  return (
    <div style={{ padding: '12px 14px', flex: 1 }}>
      {Array.from({ length: MAX_PERMS }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 10, alignItems: 'center' }}>
          <div style={{ width: 110, height: 9, borderRadius: 3, background: '#f0f0f0', animation: 'rp-pulse 1.4s ease-in-out infinite', flexShrink: 0 }} />
          {[0, 1, 2, 3, 4].map(j => (
            <div key={j} style={{ width: 22, height: 22, borderRadius: '50%', background: '#f0f0f0', animation: 'rp-pulse 1.4s ease-in-out infinite', flexShrink: 0 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── SVG icons (inline, tiny) ──────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

// ── Legend items ──────────────────────────────────────────────────────────────

const LEGEND = [
  { label: 'Full Access', dot: '#16a34a' },
  { label: 'Read Only',   dot: '#2563eb', ring: true },
  { label: 'No Access',   dot: '#e5e7eb', inner: '#94a3b8' },
  { label: 'Custom',      dot: '#ea580c' },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────

export default function PermissionMatrixPreview({ onViewFullMatrix }: Props) {
  const [data,    setData]    = useState<PermissionMatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    getPermissionMatrix()
      .then(d  => { setData(d);                                          setLoading(false); })
      .catch(e  => { setError(e instanceof Error ? e.message : 'Failed'); setLoading(false); });
  }, []);

  const roles = useMemo(() => (data?.roles       ?? []).slice(0, MAX_ROLES), [data]);
  const perms = useMemo(() => (data?.permissions ?? []).slice(0, MAX_PERMS), [data]);

  const checkedSet = useMemo(
    () => new Set(data?.assignments.map(a => `${a.roleId}:${a.permissionId}`) ?? []),
    [data?.assignments],
  );

  const isAssigned = (roleId: string, permId: string) =>
    checkedSet.has(`${roleId}:${permId}`);

  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: '13px 16px 10px', borderBottom: '1px solid #f3f4f6' }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Permission Matrix</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>View and manage role permissions</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, paddingTop: 2 }}>
            <select style={{ padding: '4px 7px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 10, fontFamily: 'inherit', color: '#374151', background: '#fff', cursor: 'pointer', outline: 'none' }}>
              <option>All Modules</option>
            </select>
            <select style={{ padding: '4px 7px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 10, fontFamily: 'inherit', color: '#374151', background: '#fff', cursor: 'pointer', outline: 'none' }}>
              <option>All Actions</option>
            </select>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
          {LEGEND.map((item) => (
            <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#374151' }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
                background: item.dot,
                boxShadow: 'ring' in item && item.ring ? `0 0 0 1.5px #bfdbfe` : undefined,
              }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Table area ─────────────────────────────────────────────────────── */}
      {loading && <PreviewSkeleton />}

      {!loading && error && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 140, fontSize: 12, color: '#f87171', padding: 16 }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <div style={{ overflowX: 'auto', flex: 1 }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>

            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{
                  padding: '8px 10px', textAlign: 'left', fontWeight: 700,
                  color: '#6b7280', fontSize: 9, letterSpacing: '0.4px',
                  borderBottom: '1px solid #e5e7eb', minWidth: 130, whiteSpace: 'nowrap',
                  textTransform: 'uppercase',
                }}>
                  MODULES / FEATURES
                </th>
                {roles.map(role => (
                  <th key={role.id} style={{
                    padding: '6px 8px', textAlign: 'center',
                    fontWeight: 700, color: '#111827', fontSize: 9,
                    borderBottom: '1px solid #e5e7eb', minWidth: 68,
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: role.status === 'ACTIVE' ? '#16a34a' : '#9ca3af' }} />
                        <span style={{ maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {role.name}
                        </span>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {perms.map(perm => (
                <tr key={perm.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 10px', color: '#374151', fontWeight: 500, fontSize: 11 }}>
                    {perm.name}
                  </td>
                  {roles.map(role => {
                    const assigned = isAssigned(role.id, perm.id);
                    return (
                      <td key={role.id} style={{ padding: '5px 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 22, height: 22, borderRadius: '50%',
                          background: assigned ? '#dcfce7' : '#f1f5f9',
                          color:      assigned ? '#16a34a' : '#94a3b8',
                        }}>
                          {assigned ? <CheckIcon /> : <MinusIcon />}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: '9px 14px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={onViewFullMatrix}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 12, fontWeight: 600, color: '#3b82f6',
            display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 0',
          }}
        >
          View full matrix
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
