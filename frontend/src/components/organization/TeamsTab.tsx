import { useCallback, useEffect, useRef, useState } from 'react';
import { getTeams, getTeam, createTeam, updateTeam, deleteTeam, getDepartments } from '../../api/organization';
import type { Team, TeamDetail, CreateTeamBody } from '../../types/organization';
import { ApiError, getUsers } from '../../api/users';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
}

const INPUT: React.CSSProperties = { width: '100%', padding: '7px 10px', fontSize: 13, fontFamily: 'inherit', border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', background: '#fff', color: '#374151', boxSizing: 'border-box' };
const LABEL: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };
const FW: React.CSSProperties = { marginBottom: 14 };

// ── Create/Edit modal ──────────────────────────────────────────────────────────

function TeamModal({ initial, onClose, onSaved, showToast }: { initial?: Team | null; onClose: () => void; onSaved: () => void; showToast: Props['showToast'] }) {
  const [form, setForm] = useState<CreateTeamBody>({
    name:         initial?.name         ?? '',
    departmentId: initial?.departmentId ?? '',
    leaderId:     initial?.leaderId     ?? '',
    description:  initial?.description  ?? '',
    status:       initial?.status       ?? 'ACTIVE',
  });
  const [departments, setDepts] = useState<Array<{ id: string; name: string }>>([]);
  const [users, setUsers] = useState<Array<{ id: string; fullName: string }>>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof CreateTeamBody, string>>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getDepartments({ limit: 100 })
      .then(r => setDepts(r.data.map(d => ({ id: d.id, name: d.name }))))
      .catch(() => {});
    getUsers({ limit: 100 })
      .then(r => setUsers(r.users.map(u => ({ id: u.id, fullName: u.fullName }))))
      .catch(() => {});
  }, []);

  const set = (k: keyof CreateTeamBody) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }));

  const validate = () => {
    const errs: typeof errors = {};
    if (!form.name.trim())         errs.name         = 'Name is required';
    if (!form.departmentId.trim()) errs.departmentId = 'Department is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const res = initial
        ? await updateTeam(initial.id, form)
        : await createTeam(form);
      showToast('success', res.message || (initial ? 'Team updated' : 'Team created'));
      onSaved();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{initial ? 'Edit Team' : 'Create Team'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
          <div style={FW}>
            <label style={LABEL}>Team Name <span style={{ color: '#ef4444' }}>*</span></label>
            <input style={errors.name ? { ...INPUT, borderColor: '#fca5a5' } : INPUT} value={form.name} onChange={set('name')} placeholder="e.g. Frontend Team" />
            {errors.name && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3 }}>{errors.name}</div>}
          </div>
          <div style={FW}>
            <label style={LABEL}>Department <span style={{ color: '#ef4444' }}>*</span></label>
            <select style={errors.departmentId ? { ...INPUT, borderColor: '#fca5a5', cursor: 'pointer' } : { ...INPUT, cursor: 'pointer' }} value={form.departmentId} onChange={set('departmentId')}>
              <option value="">Select department…</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {errors.departmentId && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3 }}>{errors.departmentId}</div>}
          </div>
          <div style={FW}>
            <label style={LABEL}>Team Leader</label>
            <select style={{ ...INPUT, cursor: 'pointer' }} value={form.leaderId} onChange={set('leaderId')}>
              <option value="">No leader</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select>
          </div>
          <div style={FW}>
            <label style={LABEL}>Description</label>
            <textarea rows={3} style={{ ...INPUT, resize: 'vertical' }} value={form.description} onChange={set('description')} placeholder="Optional team description" />
          </div>
          <div style={FW}>
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

function DeleteConfirm({ team, onClose, onDeleted, showToast }: { team: Team; onClose: () => void; onDeleted: () => void; showToast: Props['showToast'] }) {
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    setBusy(true);
    try {
      const r = await deleteTeam(team.id);
      showToast('success', r.message || 'Team deleted');
      onDeleted();
    } catch (err) {
      showToast('error', err instanceof ApiError ? err.message : 'Failed to delete');
      setBusy(false);
    }
  };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, maxWidth: 400, width: '100%', padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Delete Team?</h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>This will permanently delete <strong>{team.name}</strong>. {team.memberCount > 0 ? `${team.memberCount} member${team.memberCount !== 1 ? 's' : ''} will be unassigned.` : ''}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} disabled={busy} style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'inherit', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#374151' }}>Cancel</button>
          <button onClick={handle} disabled={busy} style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'inherit', fontWeight: 600, background: busy ? '#fca5a5' : '#dc2626', border: 'none', borderRadius: 7, cursor: busy ? 'not-allowed' : 'pointer', color: '#fff' }}>{busy ? 'Deleting…' : 'Delete'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Detail drawer ──────────────────────────────────────────────────────────────

function DetailDrawer({ teamId, onClose }: { teamId: string; onClose: () => void }) {
  const [data, setData] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  useEffect(() => {
    getTeam(teamId)
      .then(setData)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [teamId]);

  const handleClose = () => { setVisible(false); setTimeout(onClose, 280); };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1500 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', opacity: visible ? 1 : 0, transition: 'opacity 0.28s' }} onClick={handleClose} />
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 400, background: '#fff', transform: visible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)', boxShadow: '-8px 0 32px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Team Details</span>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 20 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          {loading && <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>Loading…</div>}
          {error && <div style={{ color: '#dc2626', fontSize: 13, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '10px 12px' }}>{error}</div>}
          {data && (
            <>
              <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700 }}>{data.name}</h3>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>{data.department?.name}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                {[
                  { label: 'Members',      value: data.metrics?.totalMembers ?? data.memberCount },
                  { label: 'Avg Progress', value: `${(data.metrics?.averageProgress ?? data.averageLearningProgress).toFixed(1)}%` },
                  { label: 'Certificates', value: data.metrics?.completedCertificates ?? 0 },
                ].map(k => (
                  <div key={k.label} style={{ background: '#f8faff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{k.value}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{k.label}</div>
                  </div>
                ))}
              </div>
              {data.leader && <div style={{ marginBottom: 14 }}><div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 6 }}>Team Leader</div><div style={{ fontWeight: 600, fontSize: 13 }}>{data.leader.fullName}</div><div style={{ fontSize: 12, color: '#6b7280' }}>{data.leader.email}</div></div>}
              {data.description && <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px' }}>{data.description}</p>}
              {data.learningPaths.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 8 }}>Learning Paths</div>
                  {data.learningPaths.map(lp => (
                    <div key={lp.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                      <span>{lp.name}</span>
                      <span style={{ color: lp.completionRate >= 80 ? '#16a34a' : '#9ca3af', fontSize: 12, fontWeight: 600 }}>{lp.completionRate}%</span>
                    </div>
                  ))}
                </div>
              )}
              {data.members.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 8 }}>Members ({data.members.length})</div>
                  {data.members.slice(0, 10).map(m => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13, alignItems: 'center' }}>
                      <span>{m.fullName}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 48, height: 4, background: '#f3f4f6', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${m.learningProgress}%`, height: '100%', background: m.learningProgress >= 80 ? '#16a34a' : '#2563eb', borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>{m.learningProgress.toFixed(0)}%</span>
                      </div>
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

export default function TeamsTab({ showToast }: Props) {
  const [teams,    setTeams]    = useState<Team[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [search,   setSearch]   = useState('');
  const [debSearch, setDebSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [departments, setDepts] = useState<Array<{ id: string; name: string }>>([]);
  const [page,     setPage]     = useState(1);
  const [total,    setTotal]    = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTeam,   setEditTeam]   = useState<Team | null>(null);
  const [deleteTeam_, setDeleteTeam_] = useState<Team | null>(null);
  const [detailId,   setDetailId]   = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getDepartments({ limit: 100 })
      .then(r => setDepts(r.data.map(d => ({ id: d.id, name: d.name }))))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTeams({ search: debSearch || undefined, departmentId: deptFilter || undefined, page, limit: LIMIT });
      setTeams(res.data);
      setTotal(res.pagination.total);
      setTotalPages(res.pagination.pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  }, [debSearch, deptFilter, page]);

  useEffect(() => { load(); }, [load]);

  function handleSearch(q: string) {
    setSearch(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { setDebSearch(q); setPage(1); }, 400);
  }

  const TB: React.CSSProperties = { padding: '10px 14px', fontSize: 13, color: '#374151', borderBottom: '1px solid #f3f4f6' };
  const TH: React.CSSProperties = { padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.4px', background: '#f9fafb', textAlign: 'left' };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Search teams…" value={search} onChange={e => handleSearch(e.target.value)} style={{ paddingLeft: 28, paddingRight: 10, paddingTop: 6, paddingBottom: 6, fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', width: 200, fontFamily: 'inherit', background: '#fff', color: '#374151' }} />
        </div>
        <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(1); }} style={{ padding: '6px 8px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', outline: 'none', background: '#fff', cursor: 'pointer' }}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={load} style={{ padding: '6px 12px', fontSize: 12, fontFamily: 'inherit', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', color: '#374151' }}>Refresh</button>
          <button onClick={() => setCreateOpen(true)} style={{ padding: '6px 14px', fontSize: 13, fontFamily: 'inherit', fontWeight: 600, background: '#2563eb', border: 'none', borderRadius: 7, cursor: 'pointer', color: '#fff' }}>+ Add Team</button>
        </div>
      </div>

      {error && !loading && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#b91c1c', fontSize: 12, padding: '8px 12px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button onClick={load} style={{ fontSize: 12, fontWeight: 600, background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 5, padding: '2px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Team', 'Department', 'Leader', 'Members', 'Progress', 'Status', 'Actions'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
          <tbody>
            {loading && Array.from({ length: 4 }, (_, i) => <tr key={i}>{Array.from({ length: 7 }, (_, j) => <td key={j} style={TB}><div style={{ height: 14, background: '#f3f4f6', borderRadius: 4, width: j === 0 ? 120 : 70 }} /></td>)}</tr>)}
            {!loading && teams.map(t => (
              <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setDetailId(t.id)}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f8faff'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                <td style={TB}><span style={{ fontWeight: 600, color: '#111827' }}>{t.name}</span></td>
                <td style={TB}><span style={{ fontSize: 12, color: '#6b7280' }}>{t.departmentName ?? '—'}</span></td>
                <td style={TB}><span style={{ fontSize: 12 }}>{t.leaderName ?? '—'}</span></td>
                <td style={TB}>{t.memberCount}</td>
                <td style={TB}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 60, height: 5, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${t.averageLearningProgress}%`, height: '100%', background: '#2563eb', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 12, color: '#374151' }}>{t.averageLearningProgress.toFixed(0)}%</span>
                  </div>
                </td>
                <td style={TB}><span style={{ fontSize: 11, fontWeight: 600, background: t.status === 'ACTIVE' ? '#f0fdf4' : '#f9fafb', color: t.status === 'ACTIVE' ? '#16a34a' : '#6b7280', padding: '2px 8px', borderRadius: 20 }}>{t.status === 'ACTIVE' ? 'Active' : 'Inactive'}</span></td>
                <td style={{ ...TB, whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => setEditTeam(t)} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', marginRight: 8, fontFamily: 'inherit' }}>Edit</button>
                  <button onClick={() => setDeleteTeam_(t)} style={{ fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
                </td>
              </tr>
            ))}
            {!loading && teams.length === 0 && !error && (
              <tr><td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No teams found. Click <strong>+ Add Team</strong> to get started.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, fontSize: 12, color: '#6b7280' }}>
          <span>Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '4px 10px', fontSize: 12, fontFamily: 'inherit', border: '1px solid #e5e7eb', borderRadius: 5, background: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1 }}>Prev</button>
            <span style={{ padding: '4px 10px', border: '1px solid #2563eb', borderRadius: 5, background: '#2563eb', color: '#fff', fontSize: 12 }}>{page}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '4px 10px', fontSize: 12, fontFamily: 'inherit', border: '1px solid #e5e7eb', borderRadius: 5, background: '#fff', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1 }}>Next</button>
          </div>
        </div>
      )}

      {createOpen  && <TeamModal onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); load(); window.dispatchEvent(new CustomEvent('organizationUpdated')); window.dispatchEvent(new CustomEvent('userDataChanged')); window.dispatchEvent(new CustomEvent('analyticsUpdated')); }} showToast={showToast} />}
      {editTeam    && <TeamModal initial={editTeam} onClose={() => setEditTeam(null)} onSaved={() => { setEditTeam(null); load(); window.dispatchEvent(new CustomEvent('organizationUpdated')); window.dispatchEvent(new CustomEvent('userDataChanged')); window.dispatchEvent(new CustomEvent('analyticsUpdated')); }} showToast={showToast} />}
      {deleteTeam_ && <DeleteConfirm team={deleteTeam_} onClose={() => setDeleteTeam_(null)} onDeleted={() => { setDeleteTeam_(null); load(); window.dispatchEvent(new CustomEvent('organizationUpdated')); window.dispatchEvent(new CustomEvent('userDataChanged')); window.dispatchEvent(new CustomEvent('analyticsUpdated')); }} showToast={showToast} />}
      {detailId    && <DetailDrawer teamId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}
