import { useCallback, useEffect, useState } from 'react';
import type { ToastType } from '../users/Toast';
import type { RolePage, RolePageDetails, RoleStatus, Permission } from '../../types/rolesPage';
import { getRolePageDetails, duplicateRolePage, RolesPageError } from '../../api/rolesPage';
import AssignUsersToRoleModal from './AssignUsersToRoleModal';

// ── Visual maps ────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<RoleStatus, { bg: string; color: string }> = {
  ACTIVE:   { bg: '#f0fdf4', color: '#16a34a' },
  INACTIVE: { bg: '#f9fafb', color: '#6b7280' },
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

// ── Permission list grouped by category ───────────────────────────────────────

function PermissionsList({ permissions }: { permissions: Permission[] }) {
  if (permissions.length === 0) {
    return (
      <div style={{ fontSize: 12, color: '#9ca3af', padding: '6px 0' }}>
        No permissions assigned to this role.
      </div>
    );
  }

  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    const cat = p.category || 'OTHER';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Object.entries(grouped).map(([category, perms]) => (
        <div key={category}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.4px', color: '#6b7280', marginBottom: 5,
          }}>
            {category}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {perms.map(p => (
              <span
                key={p.id}
                title={p.description ?? undefined}
                style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 100,
                  background: '#eff6ff', color: '#1d4ed8',
                  border: '1px solid #bfdbfe', fontWeight: 500,
                }}
              >
                {p.name}
              </span>
            ))}
          </div>
        </div>
      ))}
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
  roleId:    string;
  onClose:   () => void;
  onEdit:    (role: RolePage) => void;
  onDelete:  (roleId: string, roleName: string) => void;
  showToast: (type: ToastType, message: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RoleDetailsDrawer({ roleId, onClose, onEdit, onDelete, showToast }: Props) {
  const [data,        setData]        = useState<RolePageDetails | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [visible,     setVisible]     = useState(false);
  const [dupBusy,     setDupBusy]     = useState(false);
  const [assignOpen,  setAssignOpen]  = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    getRolePageDetails(roleId)
      .then(d  => { setData(d);  setLoading(false); })
      .catch(e => { setError(e instanceof Error ? e.message : 'Failed to load'); setLoading(false); });
  }, [roleId]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener('rolesUpdated', handler);
    return () => window.removeEventListener('rolesUpdated', handler);
  }, [loadData]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const handleEdit = () => {
    if (!data) return;
    handleClose();
    setTimeout(() => onEdit(data), 300);
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
      if (err instanceof RolesPageError && err.status === 404) {
        showToast('error', 'Role not found');
      } else {
        showToast('error', err instanceof Error ? err.message : 'Failed to duplicate role');
      }
    } finally {
      setDupBusy(false);
    }
  };

  const handleDelete = () => {
    if (!data) return;
    handleClose();
    setTimeout(() => onDelete(data.id, data.name), 300);
  };

  const statusBadge = data ? STATUS_BADGE[data.status] ?? { bg: '#f9fafb', color: '#6b7280' } : null;

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
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{data.name}</span>
                {statusBadge && (
                  <Badge
                    bg={statusBadge.bg}
                    color={statusBadge.color}
                    label={data.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                  />
                )}
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
                <InfoRow label="Permissions"  value={String(data.permissionCount)} />
                <InfoRow label="Users Assigned" value={String(data.userCount)} />
                <InfoRow label="Created"       value={formatDate(data.createdAt)} />
                <InfoRow label="Last Updated"  value={formatDate(data.updatedAt)} />
              </div>

              {/* Permissions list */}
              <div style={{ marginBottom: 22 }}>
                <SectionTitle title={`Permissions (${data.permissions.length})`} />
                <PermissionsList permissions={data.permissions} />
              </div>

              {/* Quick Actions */}
              <div style={{ marginBottom: 22 }}>
                <SectionTitle title="Quick Actions" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                  <QuickActionBtn label="✏️ Edit Role"    color="#1d4ed8" bg="#eff6ff" onClick={handleEdit} />
                  <QuickActionBtn label="📋 Duplicate"    color="#15803d" bg="#f0fdf4" onClick={handleDuplicate} disabled={dupBusy} />
                  <QuickActionBtn label="👥 Assign Users" color="#7c3aed" bg="#f5f3ff" onClick={() => setAssignOpen(true)} />
                  <QuickActionBtn label="🗑️ Delete Role"  color="#dc2626" bg="#fef2f2" onClick={handleDelete} />
                </div>
              </div>

            </div>
          </>
        )}
      </div>

      {/* Assign Users modal */}
      {assignOpen && data && (
        <AssignUsersToRoleModal
          roleId={data.id}
          roleName={data.name}
          onClose={() => setAssignOpen(false)}
          onSuccess={() => { setAssignOpen(false); loadData(); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}
