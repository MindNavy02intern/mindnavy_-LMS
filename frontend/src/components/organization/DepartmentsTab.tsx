import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getDepartments, getDepartment, createDepartment, updateDepartment, deleteDepartment,
  getBranches,
} from '../../api/organization';
import type { Department, DepartmentDetail, CreateDepartmentBody, DeptStatus } from '../../types/organization';
import { ApiError, getUsers } from '../../api/users';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13, fontFamily: 'inherit',
  border: '1px solid #d1d5db', borderRadius: 6, outline: 'none',
  background: '#fff', color: '#374151', boxSizing: 'border-box',
};
const LABEL: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };
const FIELD_WRAP: React.CSSProperties = { marginBottom: 14 };

function statusBadge(s: DeptStatus) {
  return s === 'ACTIVE'
    ? { bg: '#f0fdf4', color: '#16a34a', label: 'Active' }
    : { bg: '#f9fafb', color: '#6b7280', label: 'Inactive' };
}

// ── Create / Edit modal ────────────────────────────────────────────────────────

interface BriefItem { id: string; name: string }
interface UserItem  { id: string; fullName: string; email: string }

interface ModalProps {
  initial?:  Department | null;
  branches:  BriefItem[];
  onClose:   () => void;
  onSaved:   (d: Department) => void;
  showToast: Props['showToast'];
}

function DepartmentModal({ initial, branches, onClose, onSaved, showToast }: ModalProps) {
  const [form, setForm] = useState<CreateDepartmentBody>({
    name:        initial?.name        ?? '',
    code:        initial?.code        ?? '',
    description: initial?.description ?? '',
    branchId:    initial?.branchId    ?? '',
    managerId:   initial?.managerId   ?? '',
    budget:      initial?.budget      ?? 0,
    status:      initial?.status      ?? 'ACTIVE',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CreateDepartmentBody, string>>>({});
  const [busy,   setBusy]   = useState(false);
  const [users,  setUsers]  = useState<UserItem[]>([]);

  useEffect(() => {
    getUsers({ limit: 100 })
      .then(r => setUsers(r.users.map(u => ({ id: u.id, fullName: u.fullName, email: u.email }))))
      .catch(() => {});
  }, []);

  const set = (k: keyof CreateDepartmentBody) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: k === 'budget' ? Number(e.target.value) : e.target.value }));

  const validate = () => {
    const errs: typeof errors = {};
    if (!form.name.trim() || form.name.trim().length < 2) errs.name     = 'Name must be at least 2 characters';
    if (!form.branchId.trim())                            errs.branchId = 'Branch is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const res = initial
        ? await updateDepartment(initial.id, form)
        : await createDepartment(form);
      showToast('success', res.message || (initial ? 'Department updated' : 'Department created'));
      onSaved(res.data);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth: 500, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{initial ? 'Edit Department' : 'Create Department'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
          <div style={FIELD_WRAP}>
            <label style={LABEL}>Department Name <span style={{ color: '#ef4444' }}>*</span></label>
            <input style={errors.name ? { ...INPUT, borderColor: '#fca5a5' } : INPUT} value={form.name} onChange={set('name')} placeholder="e.g. IT Department" />
            {errors.name && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3 }}>{errors.name}</div>}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ ...FIELD_WRAP, flex: 1 }}>
              <label style={LABEL}>Department Code</label>
              <input style={INPUT} value={form.code} onChange={set('code')} placeholder="e.g. IT" />
            </div>
            <div style={{ ...FIELD_WRAP, flex: 1 }}>
              <label style={LABEL}>Budget (USD)</label>
              <input type="number" min={0} style={INPUT} value={form.budget} onChange={set('budget')} placeholder="0" />
            </div>
          </div>
          <div style={FIELD_WRAP}>
            <label style={LABEL}>Description</label>
            <textarea rows={3} style={{ ...INPUT, resize: 'vertical' }} value={form.description} onChange={set('description')} placeholder="Optional description" />
          </div>
          <div style={FIELD_WRAP}>
            <label style={LABEL}>Branch <span style={{ color: '#ef4444' }}>*</span></label>
            <select
              style={errors.branchId ? { ...INPUT, borderColor: '#fca5a5', cursor: 'pointer' } : { ...INPUT, cursor: 'pointer' }}
              value={form.branchId}
              onChange={set('branchId')}
            >
              <option value="">Select branch…</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            {errors.branchId && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3 }}>{errors.branchId}</div>}
          </div>
          <div style={FIELD_WRAP}>
            <label style={LABEL}>Manager</label>
            <select style={{ ...INPUT, cursor: 'pointer' }} value={form.managerId} onChange={set('managerId')}>
              <option value="">No manager assigned</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.fullName}{u.email ? ` (${u.email})` : ''}</option>)}
            </select>
          </div>
          <div style={FIELD_WRAP}>
            <label style={LABEL}>Status</label>
            <select style={{ ...INPUT, cursor: 'pointer' }} value={form.status} onChange={set('status')}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} disabled={busy} style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'inherit', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#374151' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={busy} style={{ padding: '8px 20px', fontSize: 13, fontFamily: 'inherit', fontWeight: 600, background: busy ? '#93c5fd' : '#2563eb', border: 'none', borderRadius: 7, cursor: busy ? 'not-allowed' : 'pointer', color: '#fff' }}>
            {busy ? 'Saving…' : (initial ? 'Save Changes' : 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirm ─────────────────────────────────────────────────────────────

function DeleteConfirm({ dept, onClose, onDeleted, showToast }: { dept: Department; onClose: () => void; onDeleted: () => void; showToast: Props['showToast'] }) {
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    setBusy(true);
    try {
      const res = await deleteDepartment(dept.id);
      showToast('success', res.message || 'Department deleted');
      onDeleted();
    } catch (err) {
      const msg = err instanceof ApiError && err.status === 409
        ? err.message
        : (err instanceof Error ? err.message : 'Failed to delete department');
      showToast('error', msg);
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth: 400, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Delete Department?</h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
          This will permanently delete <strong>{dept.name}</strong>. Users currently in this department may be reassigned.
        </p>
        {dept.userCount > 0 && (
          <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 13, color: '#92400e' }}>
            {dept.userCount} user{dept.userCount !== 1 ? 's' : ''} will be affected.
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} disabled={busy} style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'inherit', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#374151' }}>Cancel</button>
          <button onClick={handleDelete} disabled={busy} style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'inherit', fontWeight: 600, background: busy ? '#fca5a5' : '#dc2626', border: 'none', borderRadius: 7, cursor: busy ? 'not-allowed' : 'pointer', color: '#fff' }}>
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detail drawer ──────────────────────────────────────────────────────────────

function DetailDrawer({ deptId, onClose }: { deptId: string; onClose: () => void }) {
  const [data,    setData]    = useState<DepartmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  useEffect(() => {
    getDepartment(deptId)
      .then(setData)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [deptId]);

  const handleClose = () => { setVisible(false); setTimeout(onClose, 280); };

  const kpi = data?.kpis;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1500 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', opacity: visible ? 1 : 0, transition: 'opacity 0.28s' }} onClick={handleClose} />
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 400, background: '#fff', transform: visible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)', boxShadow: '-8px 0 32px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Department Details</span>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          {loading && <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>Loading…</div>}
          {error && <div style={{ color: '#dc2626', fontSize: 13, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '10px 12px' }}>{error}</div>}
          {data && (
            <>
              <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700 }}>{data.name}</h3>
              {data.code && <span style={{ fontSize: 12, background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: 20 }}>Code: {data.code}</span>}
              {data.description && <p style={{ fontSize: 13, color: '#6b7280', margin: '10px 0' }}>{data.description}</p>}

              {kpi && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '14px 0' }}>
                  {[
                    { label: 'Total Users',    value: kpi.totalUsers },
                    { label: 'Active',         value: kpi.activeUsers },
                    { label: 'Completion Rate', value: `${kpi.completionRate.toFixed(1)}%` },
                    { label: 'Avg Progress',    value: `${kpi.averageProgress.toFixed(1)}%` },
                  ].map(k => (
                    <div key={k.label} style={{ background: '#f8faff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{k.value}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{k.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {data.manager && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>Manager</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{data.manager.fullName}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{data.manager.email}</div>
                </div>
              )}

              {data.teams.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>Teams ({data.teams.length})</div>
                  {data.teams.map(t => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                      <span>{t.name}</span>
                      <span style={{ color: '#9ca3af', fontSize: 12 }}>{t.memberCount} members</span>
                    </div>
                  ))}
                </div>
              )}

              {data.members.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>Members ({data.members.length})</div>
                  {data.members.slice(0, 10).map(m => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                      <span>{m.fullName}</span>
                      <span style={{ fontSize: 11, color: '#6b7280', background: '#f3f4f6', padding: '2px 6px', borderRadius: 10 }}>{m.role}</span>
                    </div>
                  ))}
                  {data.members.length > 10 && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>+{data.members.length - 10} more</div>}
                </div>
              )}

              {data.members.length === 0 && <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, paddingTop: 20 }}>No members assigned yet.</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

const LIMIT = 10;

export default function DepartmentsTab({ showToast }: Props) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [branches,  setBranches]  = useState<BriefItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [search,   setSearch]   = useState('');
  const [debSearch, setDebSearch] = useState('');
  const [status,   setStatus]   = useState('');
  const [page,     setPage]     = useState(1);
  const [total,    setTotal]    = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [editDept,   setEditDept]   = useState<Department | null>(null);
  const [deleteDept, setDeleteDept] = useState<Department | null>(null);
  const [detailId,   setDetailId]   = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load branches once for the modal dropdowns
  useEffect(() => {
    getBranches({ limit: 100 })
      .then(r => setBranches(r.data.map(b => ({ id: b.id, name: b.name }))))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDepartments({ search: debSearch || undefined, status: status || undefined, page, limit: LIMIT });
      setDepartments(res.data);
      setTotal(res.pagination.total);
      setTotalPages(res.pagination.pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, [debSearch, status, page]);

  useEffect(() => { load(); }, [load]);

  function handleSearch(q: string) {
    setSearch(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { setDebSearch(q); setPage(1); }, 400);
  }

  function onSaved(_d: Department) {
    setCreateOpen(false);
    setEditDept(null);
    load();
  }

  const showingFrom = departments.length === 0 ? 0 : (page - 1) * LIMIT + 1;
  const showingTo   = (page - 1) * LIMIT + departments.length;

  const TB: React.CSSProperties = { padding: '10px 14px', fontSize: 13, color: '#374151', borderBottom: '1px solid #f3f4f6' };
  const TH: React.CSSProperties = { padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px', background: '#f9fafb', textAlign: 'left' };

  return (
    <div style={{ marginTop: 8 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <svg style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text" placeholder="Search departments…" value={search} onChange={e => handleSearch(e.target.value)}
            style={{ paddingLeft: 28, paddingRight: 10, paddingTop: 6, paddingBottom: 6, fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', width: 220, fontFamily: 'inherit', background: '#fff', color: '#374151' }}
          />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} style={{ padding: '6px 8px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', outline: 'none', background: '#fff', cursor: 'pointer' }}>
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => load()} style={{ padding: '6px 12px', fontSize: 12, fontFamily: 'inherit', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', color: '#374151' }}>Refresh</button>
          <button onClick={() => setCreateOpen(true)} style={{ padding: '6px 14px', fontSize: 13, fontFamily: 'inherit', fontWeight: 600, background: '#2563eb', border: 'none', borderRadius: 7, cursor: 'pointer', color: '#fff' }}>+ Add Department</button>
        </div>
      </div>

      {/* Error */}
      {error && !loading && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#b91c1c', fontSize: 12, padding: '8px 12px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button onClick={load} style={{ fontSize: 12, fontWeight: 600, background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 5, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Department', 'Code', 'Branch', 'Manager', 'Budget', 'Users', 'Status', 'Actions'].map(h => <th key={h} style={TH}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 4 }, (_, i) => (
              <tr key={i}>
                {Array.from({ length: 8 }, (_, j) => (
                  <td key={j} style={TB}><div style={{ height: 14, background: '#f3f4f6', borderRadius: 4, width: j === 0 ? 140 : 70 }} /></td>
                ))}
              </tr>
            ))}
            {!loading && departments.map(d => {
              const badge = statusBadge(d.status);
              return (
                <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => setDetailId(d.id)}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f8faff'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                  <td style={TB}><span style={{ fontWeight: 600, color: '#111827' }}>{d.name}</span></td>
                  <td style={TB}><span style={{ fontSize: 12, color: '#6b7280' }}>{d.code || '—'}</span></td>
                  <td style={TB}><span style={{ fontSize: 12 }}>{d.branchName ?? '—'}</span></td>
                  <td style={TB}><span style={{ fontSize: 12 }}>{d.managerName ?? '—'}</span></td>
                  <td style={TB}>{d.budget > 0 ? `$${d.budget.toLocaleString()}` : '—'}</td>
                  <td style={TB}>{d.userCount}</td>
                  <td style={TB}><span style={{ fontSize: 11, fontWeight: 600, background: badge.bg, color: badge.color, padding: '2px 8px', borderRadius: 20 }}>{badge.label}</span></td>
                  <td style={{ ...TB, whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => setEditDept(d)} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', marginRight: 8, fontFamily: 'inherit' }}>Edit</button>
                    <button onClick={() => setDeleteDept(d)} style={{ fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
                  </td>
                </tr>
              );
            })}
            {!loading && departments.length === 0 && !error && (
              <tr><td colSpan={8} style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                No departments found. Click <strong>+ Add Department</strong> to get started.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, fontSize: 12, color: '#6b7280' }}>
          <span>Showing {showingFrom}–{showingTo} of {total}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '4px 10px', fontSize: 12, fontFamily: 'inherit', border: '1px solid #e5e7eb', borderRadius: 5, background: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1 }}>Prev</button>
            <span style={{ padding: '4px 10px', border: '1px solid #2563eb', borderRadius: 5, background: '#2563eb', color: '#fff', fontSize: 12 }}>{page}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '4px 10px', fontSize: 12, fontFamily: 'inherit', border: '1px solid #e5e7eb', borderRadius: 5, background: '#fff', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1 }}>Next</button>
          </div>
        </div>
      )}

      {/* Modals */}
      {createOpen && <DepartmentModal branches={branches} onClose={() => setCreateOpen(false)} onSaved={onSaved} showToast={showToast} />}
      {editDept   && <DepartmentModal initial={editDept} branches={branches} onClose={() => setEditDept(null)} onSaved={onSaved} showToast={showToast} />}
      {deleteDept && <DeleteConfirm dept={deleteDept} onClose={() => setDeleteDept(null)} onDeleted={() => { setDeleteDept(null); load(); }} showToast={showToast} />}
      {detailId   && <DetailDrawer deptId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}
