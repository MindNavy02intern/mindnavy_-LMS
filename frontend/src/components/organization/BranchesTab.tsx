import { useCallback, useEffect, useRef, useState } from 'react';
import { getBranches, getBranch, createBranch, updateBranch, deleteBranch } from '../../api/organization';
import type { Branch, BranchDetail, CreateBranchBody, BranchLocationType, ComplianceStatus } from '../../types/organization';
import { ApiError } from '../../api/users';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
}

const INPUT: React.CSSProperties = { width: '100%', padding: '7px 10px', fontSize: 13, fontFamily: 'inherit', border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', background: '#fff', color: '#374151', boxSizing: 'border-box' };
const LABEL: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };
const FW: React.CSSProperties = { marginBottom: 14 };

function complianceBadge(s: ComplianceStatus) {
  if (s === 'COMPLIANT')     return { bg: '#f0fdf4', color: '#16a34a', label: 'Compliant' };
  if (s === 'NON_COMPLIANT') return { bg: '#fef2f2', color: '#dc2626', label: 'Non-Compliant' };
  return                            { bg: '#fefce8', color: '#a16207', label: 'Pending' };
}

function locationLabel(t: BranchLocationType) {
  if (t === 'HEAD_OFFICE') return 'Head Office';
  if (t === 'REGIONAL')    return 'Regional';
  return 'Local';
}

// ── Create/Edit modal ──────────────────────────────────────────────────────────

function BranchModal({ initial, onClose, onSaved, showToast }: { initial?: Branch | null; onClose: () => void; onSaved: (b: Branch) => void; showToast: Props['showToast'] }) {
  const blank: CreateBranchBody = { name: '', locationType: 'HEAD_OFFICE', address: '', city: '', country: '', phone: '', email: '', managerId: '', status: 'ACTIVE' };
  const [form, setForm] = useState<CreateBranchBody>(initial ? {
    name: initial.name, locationType: initial.locationType, address: initial.address,
    city: initial.city, country: initial.country, phone: initial.phone ?? '', email: initial.email ?? '',
    managerId: initial.managerId ?? '', status: initial.status,
  } : blank);
  const [errors, setErrors] = useState<Partial<Record<keyof CreateBranchBody, string>>>({});
  const [busy, setBusy] = useState(false);

  const set = (k: keyof CreateBranchBody) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }));

  const validate = () => {
    const errs: typeof errors = {};
    if (!form.name.trim())    errs.name    = 'Name is required';
    if (!form.address.trim()) errs.address = 'Address is required';
    if (!form.city.trim())    errs.city    = 'City is required';
    if (!form.country.trim()) errs.country = 'Country is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const res = initial
        ? await updateBranch(initial.id, form)
        : await createBranch(form);
      showToast('success', res.message || (initial ? 'Branch updated' : 'Branch created'));
      onSaved(res.data);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const err = (k: keyof CreateBranchBody) => errors[k] ? <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3 }}>{errors[k]}</div> : null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{initial ? 'Edit Branch' : 'Create Branch'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
          <div style={FW}>
            <label style={LABEL}>Branch Name <span style={{ color: '#ef4444' }}>*</span></label>
            <input style={errors.name ? { ...INPUT, borderColor: '#fca5a5' } : INPUT} value={form.name} onChange={set('name')} placeholder="e.g. New York Office" />
            {err('name')}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ ...FW, flex: 1 }}>
              <label style={LABEL}>Location Type</label>
              <select style={{ ...INPUT, cursor: 'pointer' }} value={form.locationType} onChange={set('locationType')}>
                <option value="HEAD_OFFICE">Head Office</option>
                <option value="REGIONAL">Regional</option>
                <option value="LOCAL">Local</option>
              </select>
            </div>
            <div style={{ ...FW, flex: 1 }}>
              <label style={LABEL}>Status</label>
              <select style={{ ...INPUT, cursor: 'pointer' }} value={form.status} onChange={set('status')}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>
          <div style={FW}>
            <label style={LABEL}>Address <span style={{ color: '#ef4444' }}>*</span></label>
            <input style={errors.address ? { ...INPUT, borderColor: '#fca5a5' } : INPUT} value={form.address} onChange={set('address')} placeholder="Street address" />
            {err('address')}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ ...FW, flex: 1 }}>
              <label style={LABEL}>City <span style={{ color: '#ef4444' }}>*</span></label>
              <input style={errors.city ? { ...INPUT, borderColor: '#fca5a5' } : INPUT} value={form.city} onChange={set('city')} placeholder="City" />
              {err('city')}
            </div>
            <div style={{ ...FW, flex: 1 }}>
              <label style={LABEL}>Country <span style={{ color: '#ef4444' }}>*</span></label>
              <input style={errors.country ? { ...INPUT, borderColor: '#fca5a5' } : INPUT} value={form.country} onChange={set('country')} placeholder="Country" />
              {err('country')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ ...FW, flex: 1 }}>
              <label style={LABEL}>Phone</label>
              <input style={INPUT} value={form.phone} onChange={set('phone')} placeholder="+1 234 567 8900" />
            </div>
            <div style={{ ...FW, flex: 1 }}>
              <label style={LABEL}>Email</label>
              <input type="email" style={INPUT} value={form.email} onChange={set('email')} placeholder="branch@example.com" />
            </div>
          </div>
          <div style={FW}>
            <label style={LABEL}>Manager ID</label>
            <input style={INPUT} value={form.managerId} onChange={set('managerId')} placeholder="User ID of manager" />
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

function DeleteConfirm({ branch, onClose, onDeleted, showToast }: { branch: Branch; onClose: () => void; onDeleted: () => void; showToast: Props['showToast'] }) {
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    setBusy(true);
    try {
      const r = await deleteBranch(branch.id);
      showToast('success', r.message || 'Branch deleted');
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
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>Delete Branch?</h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>This will permanently delete <strong>{branch.name}</strong> ({branch.city}, {branch.country}). Users and departments may be affected.</p>
        {branch.userCount > 0 && <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 13, color: '#92400e' }}>{branch.userCount} user{branch.userCount !== 1 ? 's' : ''} assigned to this branch.</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} disabled={busy} style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'inherit', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#374151' }}>Cancel</button>
          <button onClick={handle} disabled={busy} style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'inherit', fontWeight: 600, background: busy ? '#fca5a5' : '#dc2626', border: 'none', borderRadius: 7, cursor: busy ? 'not-allowed' : 'pointer', color: '#fff' }}>{busy ? 'Deleting…' : 'Delete'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Detail drawer ──────────────────────────────────────────────────────────────

function DetailDrawer({ branchId, onClose }: { branchId: string; onClose: () => void }) {
  const [data, setData] = useState<BranchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  useEffect(() => {
    getBranch(branchId)
      .then(setData)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [branchId]);

  const handleClose = () => { setVisible(false); setTimeout(onClose, 280); };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1500 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', opacity: visible ? 1 : 0, transition: 'opacity 0.28s' }} onClick={handleClose} />
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 400, background: '#fff', transform: visible ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)', boxShadow: '-8px 0 32px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Branch Details</span>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 20 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          {loading && <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>Loading…</div>}
          {error && <div style={{ color: '#dc2626', fontSize: 13, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '10px 12px' }}>{error}</div>}
          {data && (
            <>
              <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700 }}>{data.name}</h3>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>{locationLabel(data.locationType)} &bull; {data.city}, {data.country}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                {[{ label: 'Users', value: data.userCount }, { label: 'Departments', value: data.departmentCount }].map(k => (
                  <div key={k.label} style={{ background: '#f8faff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{k.value}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{k.label}</div>
                  </div>
                ))}
              </div>
              {[['Address', data.address], ['Phone', data.phone ?? '—'], ['Email', data.email ?? '—']].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                  <span style={{ color: '#6b7280', fontSize: 12 }}>{l}</span>
                  <span>{v}</span>
                </div>
              ))}
              {data.manager && <div style={{ marginTop: 14 }}><div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 6 }}>Manager</div><div style={{ fontWeight: 600, fontSize: 13 }}>{data.manager.fullName}</div><div style={{ fontSize: 12, color: '#6b7280' }}>{data.manager.email}</div></div>}
              {data.departments.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 8 }}>Departments ({data.departments.length})</div>
                  {data.departments.map(d => (
                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                      <span>{d.name}</span><span style={{ color: '#9ca3af', fontSize: 12 }}>{d.userCount} users</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

const LIMIT = 10;

export default function BranchesTab({ showToast }: Props) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState<string | null>(null);
  const [search,  setSearch]    = useState('');
  const [debSearch, setDebSearch] = useState('');
  const [page,    setPage]      = useState(1);
  const [total,   setTotal]     = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [deleteBranch_, setDeleteBranch_] = useState<Branch | null>(null);
  const [detailId,   setDetailId]   = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getBranches({ search: debSearch || undefined, page, limit: LIMIT });
        setBranches(res.data);
        setTotal(res.pagination.total);
        setTotalPages(res.pagination.pages);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load branches');
      } finally {
        setLoading(false);
      }
    })();
  }, [debSearch, page]);

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
          <input type="text" placeholder="Search branches…" value={search} onChange={e => handleSearch(e.target.value)} style={{ paddingLeft: 28, paddingRight: 10, paddingTop: 6, paddingBottom: 6, fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', width: 220, fontFamily: 'inherit', background: '#fff', color: '#374151' }} />
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={load} style={{ padding: '6px 12px', fontSize: 12, fontFamily: 'inherit', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', color: '#374151' }}>Refresh</button>
          <button onClick={() => setCreateOpen(true)} style={{ padding: '6px 14px', fontSize: 13, fontFamily: 'inherit', fontWeight: 600, background: '#2563eb', border: 'none', borderRadius: 7, cursor: 'pointer', color: '#fff' }}>+ Add Branch</button>
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
          <thead><tr>{['Branch', 'Type', 'Location', 'Users', 'Departments', 'Compliance', 'Actions'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
          <tbody>
            {loading && Array.from({ length: 4 }, (_, i) => <tr key={i}>{Array.from({ length: 7 }, (_, j) => <td key={j} style={TB}><div style={{ height: 14, background: '#f3f4f6', borderRadius: 4, width: j === 0 ? 130 : 70 }} /></td>)}</tr>)}
            {!loading && branches.map(b => {
              const cb = complianceBadge(b.complianceStatus);
              return (
                <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => setDetailId(b.id)}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f8faff'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}>
                  <td style={TB}><span style={{ fontWeight: 600, color: '#111827' }}>{b.name}</span></td>
                  <td style={TB}><span style={{ fontSize: 12, color: '#6b7280' }}>{locationLabel(b.locationType)}</span></td>
                  <td style={TB}><span style={{ fontSize: 12 }}>{b.city}, {b.country}</span></td>
                  <td style={TB}>{b.userCount}</td>
                  <td style={TB}>{b.departmentCount}</td>
                  <td style={TB}><span style={{ fontSize: 11, fontWeight: 600, background: cb.bg, color: cb.color, padding: '2px 8px', borderRadius: 20 }}>{cb.label}</span></td>
                  <td style={{ ...TB, whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => setEditBranch(b)} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', marginRight: 8, fontFamily: 'inherit' }}>Edit</button>
                    <button onClick={() => setDeleteBranch_(b)} style={{ fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
                  </td>
                </tr>
              );
            })}
            {!loading && branches.length === 0 && !error && (
              <tr><td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No branches found. Click <strong>+ Add Branch</strong> to get started.</td></tr>
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

      {createOpen    && <BranchModal onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); load(); window.dispatchEvent(new CustomEvent('organizationUpdated')); window.dispatchEvent(new CustomEvent('userDataChanged')); window.dispatchEvent(new CustomEvent('analyticsUpdated')); }} showToast={showToast} />}
      {editBranch    && <BranchModal initial={editBranch} onClose={() => setEditBranch(null)} onSaved={() => { setEditBranch(null); load(); window.dispatchEvent(new CustomEvent('organizationUpdated')); window.dispatchEvent(new CustomEvent('userDataChanged')); window.dispatchEvent(new CustomEvent('analyticsUpdated')); }} showToast={showToast} />}
      {deleteBranch_ && <DeleteConfirm branch={deleteBranch_} onClose={() => setDeleteBranch_(null)} onDeleted={() => { setDeleteBranch_(null); load(); window.dispatchEvent(new CustomEvent('organizationUpdated')); window.dispatchEvent(new CustomEvent('userDataChanged')); window.dispatchEvent(new CustomEvent('analyticsUpdated')); }} showToast={showToast} />}
      {detailId      && <DetailDrawer branchId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}
