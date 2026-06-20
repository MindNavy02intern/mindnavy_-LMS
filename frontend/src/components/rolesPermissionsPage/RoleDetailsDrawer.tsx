import { useEffect, useState } from 'react';
import type { ToastType } from '../users/Toast';
import type { RolePage, RolePageDetails, RoleLevel, PageRoleStatus, RiskClassification } from '../../types/rolesPage';
import { getRolePageDetails, duplicateRolePage } from '../../api/rolesPage';

// ── Visual maps ────────────────────────────────────────────────────────────────

const LEVEL_BADGE: Record<RoleLevel, { bg: string; color: string }> = {
  System:     { bg: '#eff6ff', color: '#1d4ed8' },
  Department: { bg: '#f5f3ff', color: '#6d28d9' },
  Branch:     { bg: '#f0fdf4', color: '#15803d' },
  Functional: { bg: '#fff7ed', color: '#c2410c' },
  Default:    { bg: '#f9fafb', color: '#6b7280' },
};

const STATUS_BADGE: Record<PageRoleStatus, { bg: string; color: string }> = {
  Active:   { bg: '#f0fdf4', color: '#16a34a' },
  Inactive: { bg: '#f9fafb', color: '#6b7280' },
  Archived: { bg: '#fffbeb', color: '#b45309' },
};

const RISK_BADGE: Record<RiskClassification, { bg: string; color: string }> = {
  Low:      { bg: '#f0fdf4', color: '#16a34a' },
  Medium:   { bg: '#fffbeb', color: '#b45309' },
  High:     { bg: '#fff7ed', color: '#c2410c' },
  Critical: { bg: '#fef2f2', color: '#b91c1c' },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '7px 0', borderBottom: '1px solid #f3f4f6',
    }}>
      <span style={{ fontSize: 12, color: '#6b7280', flexShrink: 0, marginRight: 12 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#111827', fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.5px', color: '#9ca3af', marginBottom: 10,
    }}>
      {title}
    </div>
  );
}

function Badge({ bg, color, label }: { bg: string; color: string; label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: bg, color, borderRadius: 100, fontSize: 11, fontWeight: 600, padding: '2px 9px',
    }}>
      {label}
    </span>
  );
}

function QuickActionBtn({
  label, color, bg, onClick, disabled,
}: {
  label: string; color: string; bg: string;
  onClick?: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '9px 8px', fontSize: 12, fontWeight: 500,
        background: bg, border: `1px solid ${color}22`,
        color, borderRadius: 7, cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', opacity: disabled ? 0.5 : 1,
        textAlign: 'center',
      }}
    >
      {label}
    </button>
  );
}

// ── Simple CSS donut ────────────────────────────────────────────────────────────

function DonutChart({ breakdown }: {
  breakdown: { fullAccess: number; readOnly: number; custom: number; noAccess: number };
}) {
  const { fullAccess, readOnly, custom, noAccess } = breakdown;
  const total = fullAccess + readOnly + custom + noAccess || 1;

  const fa = Math.round((fullAccess / total) * 100);
  const ro = Math.round((readOnly  / total) * 100);
  const cu = Math.round((custom    / total) * 100);

  const gradient = `conic-gradient(
    #16a34a 0% ${fa}%,
    #3b82f6 ${fa}% ${fa + ro}%,
    #f97316 ${fa + ro}% ${fa + ro + cu}%,
    #d1d5db ${fa + ro + cu}% 100%
  )`;

  const items = [
    { label: 'Full Access', color: '#16a34a', count: fullAccess },
    { label: 'Read Only',   color: '#3b82f6', count: readOnly   },
    { label: 'Custom',      color: '#f97316', count: custom      },
    { label: 'No Access',   color: '#d1d5db', count: noAccess   },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: gradient,
        }} />
        <div style={{
          position: 'absolute', inset: 14, borderRadius: '50%',
          background: '#fff',
        }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {items.map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#6b7280' }}>{item.label}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginLeft: 4 }}>{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function Skeleton({ w, h }: { w: number | string; h: number }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 5, background: '#f0f0f0',
      animation: 'mn-pulse 1.4s ease-in-out infinite',
    }} />
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  roleId:      string;
  onClose:     () => void;
  onEdit:      (role: RolePage) => void;
  onDelete:    (roleId: string, roleName: string) => void;
  showToast:   (type: ToastType, message: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RoleDetailsDrawer({ roleId, onClose, onEdit, onDelete, showToast }: Props) {
  const [data,      setData]      = useState<RolePageDetails | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [visible,   setVisible]   = useState(false);
  const [dupBusy,   setDupBusy]   = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getRolePageDetails(roleId)
      .then(d  => { if (!cancelled) { setData(d);  setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e instanceof Error ? e.message : 'Failed to load'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [roleId]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const handleEdit = () => {
    if (!data) return;
    const role: RolePage = {
      id:               data.id,
      name:             data.name,
      description:      data.description,
      level:            data.level,
      usersCount:       data.assignedUsers,
      permissionsCount: data.totalPermissions,
      scope:            data.scope,
      status:           data.status,
      riskClassification: data.riskClassification,
      priority:         data.priority,
      departmentScope:  data.departmentScope,
      branchScope:      data.branchScope,
      createdAt:        data.createdAt,
      updatedAt:        data.updatedAt,
    };
    handleClose();
    setTimeout(() => onEdit(role), 300);
  };

  const handleDuplicate = async () => {
    setDupBusy(true);
    try {
      const dup = await duplicateRolePage(roleId);
      showToast('success', `Role duplicated as '${dup.name}'`);
      window.dispatchEvent(new CustomEvent('rolesUpdated'));
      window.dispatchEvent(new CustomEvent('analyticsUpdated'));
      handleClose();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to duplicate role');
    } finally {
      setDupBusy(false);
    }
  };

  const handleDelete = () => {
    if (!data) return;
    handleClose();
    setTimeout(() => onDelete(data.id, data.name), 300);
  };

  const levelBadge  = data ? LEVEL_BADGE[data.level]              : null;
  const statusBadge = data ? STATUS_BADGE[data.status]            : null;
  const riskBadge   = data ? RISK_BADGE[data.riskClassification]  : null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1500 }}>
      {/* Overlay */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.28s ease',
        }}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0,
        width: 420, background: '#ffffff',
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.13)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Close bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: '1px solid #f3f4f6', flexShrink: 0,
        }}>
          <button
            onClick={handleClose}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#6b7280', fontSize: 13, fontFamily: 'inherit', padding: '3px 0',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
            Back
          </button>
          <button
            onClick={handleClose}
            style={{
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#f9fafb', border: '1px solid #e5e7eb',
              borderRadius: 6, cursor: 'pointer', color: '#6b7280', padding: 0,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <style>{`@keyframes mn-pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }`}</style>
            <Skeleton w="60%" h={20} />
            <Skeleton w="40%" h={14} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Skeleton w={60} h={22} />
              <Skeleton w={60} h={22} />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} w="100%" h={14} />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', flex: 1, gap: 10, padding: 24,
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p style={{ margin: 0, fontSize: 13, color: '#374151', fontWeight: 600, textAlign: 'center' }}>{error}</p>
            <button
              onClick={handleClose}
              style={{ padding: '6px 14px', fontSize: 12, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}
            >
              Close
            </button>
          </div>
        )}

        {/* Content */}
        {!loading && !error && data && (
          <>
            {/* Role header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{data.name}</span>
                    {statusBadge && <Badge bg={statusBadge.bg} color={statusBadge.color} label={data.status} />}
                  </div>
                  {levelBadge && <Badge bg={levelBadge.bg} color={levelBadge.color} label={data.level} />}
                </div>
              </div>
              {data.description && (
                <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>{data.description}</p>
              )}
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

              {/* Role Overview */}
              <div style={{ marginBottom: 22 }}>
                <SectionTitle title="Role Overview" />
                <InfoRow label="Total Permissions" value={String(data.totalPermissions)} />
                <InfoRow label="Assigned Users"    value={String(data.assignedUsers)} />
                <InfoRow label="Access Scope"      value={data.scope} />
                <InfoRow label="Priority"          value={`Level ${data.priority}`} />
                <InfoRow
                  label="Risk Level"
                  value={riskBadge && <Badge bg={riskBadge.bg} color={riskBadge.color} label={data.riskClassification} />}
                />
                <InfoRow label="Last Modified"  value={formatDate(data.updatedAt)} />
                <InfoRow label="Modified By"    value={data.lastModifiedBy ?? '—'} />
              </div>

              {/* Permission Summary */}
              <div style={{ marginBottom: 22 }}>
                <SectionTitle title="Permission Summary" />
                <DonutChart breakdown={data.permissionBreakdown} />
              </div>

              {/* Security & Compliance */}
              <div style={{ marginBottom: 22 }}>
                <SectionTitle title="Security & Compliance" />
                <InfoRow label="MFA Required" value={
                  data.mfaRequired
                    ? <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 100, fontSize: 11, fontWeight: 600, padding: '2px 8px' }}>Required</span>
                    : <span style={{ background: '#f9fafb', color: '#9ca3af', borderRadius: 100, fontSize: 11, fontWeight: 600, padding: '2px 8px' }}>Not Required</span>
                } />
                <InfoRow label="Sensitive Permissions" value={String(data.sensitivePermissions)} />
                <InfoRow label="Last Access Review"    value={data.lastAccessReview ? formatDate(data.lastAccessReview) : '—'} />
                <InfoRow label="Compliance Status"     value={
                  data.complianceStatus === 'Compliant'
                    ? <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 100, fontSize: 11, fontWeight: 600, padding: '2px 8px' }}>Compliant</span>
                    : <span style={{ background: '#fef2f2', color: '#b91c1c', borderRadius: 100, fontSize: 11, fontWeight: 600, padding: '2px 8px' }}>Non-Compliant</span>
                } />
              </div>

              {/* Quick Actions */}
              <div style={{ marginBottom: 22 }}>
                <SectionTitle title="Quick Actions" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                  <QuickActionBtn label="✏️ Edit Role"       color="#1d4ed8" bg="#eff6ff" onClick={handleEdit} />
                  <QuickActionBtn label="📋 Duplicate"       color="#15803d" bg="#f0fdf4" onClick={handleDuplicate} disabled={dupBusy} />
                  <QuickActionBtn label="👥 Assign Users"    color="#6b7280" bg="#f9fafb" onClick={() => showToast('error', 'Assign Users — Coming Soon')} />
                  <QuickActionBtn label="📋 Audit Logs"      color="#6b7280" bg="#f9fafb" onClick={() => showToast('error', 'Audit Logs — Coming Soon')} />
                  <QuickActionBtn label="🗄️ Archive Role"    color="#b45309" bg="#fffbeb" onClick={() => showToast('error', 'Archive Role — Coming Soon')} />
                  <QuickActionBtn label="🗑️ Delete Role"     color="#dc2626" bg="#fef2f2" onClick={handleDelete} />
                </div>
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
}
