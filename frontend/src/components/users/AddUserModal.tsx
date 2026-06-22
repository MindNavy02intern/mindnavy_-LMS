import { useEffect, useState } from 'react';
import { createUser, getUsers, ApiError } from '../../api/users';
import type { CreateUserRequest } from '../../types/users';
import type { ToastType } from './Toast';
import { ACCESS_LEVEL_OPTIONS } from '../../constants/userOptions';
import useRoles from '../../hooks/useRoles';
import useOrgOptions from '../../hooks/useOrgOptions';
import { groupsAPI } from '../../api/groups';

interface Props {
  onClose:   () => void;
  onSuccess: () => void;
  showToast: (type: ToastType, message: string) => void;
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid #e5e7eb', borderRadius: 6,
  background: '#fff', color: '#374151',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};

const ERR_INPUT: React.CSSProperties = { ...INPUT, borderColor: '#fca5a5', background: '#fef2f2' };

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
        {label}{required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {error && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3 }}>{error}</div>}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

type FormKey = 'fullName' | 'email' | 'password' | 'confirmPassword' | 'phone' | 'role'
             | 'department' | 'branch' | 'groupId' | 'accessLevel' | 'managerId'
             | 'skillInput';

export default function AddUserModal({ onClose, onSuccess, showToast }: Props) {
  const { options: roleOptions, loading: rolesLoading, hasError: rolesError } = useRoles();
  const { depts, branches, loading: orgLoading, deptsError, branchesError } = useOrgOptions();

  // Groups dropdown
  const [groups,         setGroups]         = useState<{ id: string; name: string; dept: string | null }[]>([]);
  const [groupsLoading,  setGroupsLoading]  = useState(false);
  const [groupsError,    setGroupsError]    = useState(false);

  // Managers dropdown (manager + admin_assistant roles)
  const [managers,        setManagers]        = useState<{ id: string; fullName: string; role: string }[]>([]);
  const [managersLoading, setManagersLoading] = useState(false);
  const [managersError,   setManagersError]   = useState(false);

  useEffect(() => {
    setGroupsLoading(true);
    groupsAPI.listGroups({ limit: 200, status: 'ACTIVE' })
      .then(res => { setGroups(res.data.map(g => ({ id: g.id, name: g.name, dept: g.department?.name ?? null }))); setGroupsError(false); })
      .catch(() => setGroupsError(true))
      .finally(() => setGroupsLoading(false));

    setManagersLoading(true);
    Promise.allSettled([
      getUsers({ role: 'manager',         limit: 200 }),
      getUsers({ role: 'admin_assistant', limit: 200 }),
    ]).then(results => {
      const seen = new Set<string>();
      const combined: { id: string; fullName: string; role: string }[] = [];
      results.forEach(r => {
        if (r.status === 'fulfilled')
          r.value.users.forEach(u => { if (!seen.has(u.id)) { seen.add(u.id); combined.push({ id: u.id, fullName: u.fullName, role: u.role }); } });
      });
      setManagers(combined);
      setManagersError(false);
    }).catch(() => setManagersError(true))
      .finally(() => setManagersLoading(false));
  }, []);

  const [form, setForm] = useState({
    fullName: '', email: '', password: '', confirmPassword: '', phone: '', role: '',
    department: '', branch: '', groupId: '', accessLevel: '', managerId: '',
    skillInput: '', skills: [] as string[],
  });
  const [errors,     setErrors]     = useState<Partial<Record<FormKey, string>>>({});
  const [formError,  setFormError]  = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (k: FormKey) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  const addSkill = () => {
    const val = form.skillInput.trim();
    if (val && !form.skills.includes(val))
      setForm(prev => ({ ...prev, skills: [...prev.skills, val], skillInput: '' }));
  };

  const validate = (): boolean => {
    const errs: Partial<Record<FormKey, string>> = {};
    if (!form.fullName.trim())                        errs.fullName        = 'Full name is required';
    else if (form.fullName.trim().length < 2)         errs.fullName        = 'Full name must be at least 2 characters';
    if (!form.email.trim())                           errs.email           = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email   = 'Invalid email format';
    if (!form.password)                               errs.password        = 'Password is required';
    else if (form.password.length < 12)              errs.password        = 'Password must be at least 12 characters';
    if (form.confirmPassword !== form.password)       errs.confirmPassword = 'Passwords do not match';
    if (!form.role)                                   errs.role            = 'Role is required';
    const phoneVal = form.phone.trim();
    if (phoneVal && !/^\+?[0-9]{7,15}$/.test(phoneVal)) errs.phone        = 'Please enter a valid phone number';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setFormError(null);
    setSubmitting(true);

    const body: CreateUserRequest = {
      fullName:         form.fullName.trim(),
      email:            form.email.trim(),
      password:         form.password,
      phone:            form.phone.trim()      || null,
      role:             form.role,
      department:       form.department        || null,
      branch:           form.branch            || null,
      groupId:          form.groupId.trim()    || null,
      accessLevel:      form.accessLevel       || null,
      managerId:        form.managerId.trim()  || null,
      skills:           form.skills.length > 0 ? form.skills : null,
    };

    try {
      const res = await createUser(body);
      showToast('success', res.message || 'User created successfully');
      window.dispatchEvent(new CustomEvent('groupsUpdated'));
      window.dispatchEvent(new CustomEvent('userDataChanged'));
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) setErrors(prev => ({ ...prev, email: 'Email already exists' }));
        else if (err.status === 400) setFormError(err.message);
        else if (err.status === 403) showToast('error', 'Not authorized');
        else showToast('error', err.message);
      } else {
        showToast('error', 'Something went wrong, please try again');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const selectStyle = (hasError?: boolean): React.CSSProperties => ({
    ...(hasError ? ERR_INPUT : INPUT),
    cursor: 'pointer',
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div style={{
        position: 'relative', background: '#fff', borderRadius: 12,
        width: '100%', maxWidth: 560, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px', borderBottom: '1px solid #e5e7eb', flexShrink: 0,
        }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Add User</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
          {formError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#dc2626' }}>
              {formError}
            </div>
          )}

          {/* Row 1 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Full Name" required error={errors.fullName}>
              <input style={errors.fullName ? ERR_INPUT : INPUT} value={form.fullName} onChange={set('fullName')} placeholder="John Doe" />
            </Field>
            <Field label="Email Address" required error={errors.email}>
              <input type="email" style={errors.email ? ERR_INPUT : INPUT} value={form.email} onChange={set('email')} placeholder="john@example.com" />
            </Field>
          </div>

          {/* Password row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Password" required error={errors.password}>
              <input type="password" style={errors.password ? ERR_INPUT : INPUT} value={form.password} onChange={set('password')} placeholder="Enter password" autoComplete="new-password" />
            </Field>
            <Field label="Confirm Password" required error={errors.confirmPassword}>
              <input type="password" style={errors.confirmPassword ? ERR_INPUT : INPUT} value={form.confirmPassword} onChange={set('confirmPassword')} placeholder="Confirm password" autoComplete="new-password" />
            </Field>
          </div>

          {/* Row 2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Phone Number" error={errors.phone}>
              <input style={errors.phone ? ERR_INPUT : INPUT} value={form.phone} onChange={set('phone')} placeholder="+1 555 000 0000" />
            </Field>
            <Field label="Role" required error={errors.role}>
              <select style={selectStyle(!!errors.role)} value={form.role} onChange={set('role')} disabled={rolesLoading || rolesError}>
                <option value="">{rolesLoading ? 'Loading roles…' : rolesError ? 'Failed to load roles. Please refresh.' : 'Select role…'}</option>
                {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
          </div>

          {/* Row 3 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Department">
              <select style={selectStyle()} value={form.department} onChange={set('department')} disabled={orgLoading || deptsError}>
                <option value="">{orgLoading ? 'Loading…' : deptsError ? 'Failed to load departments. Please refresh.' : 'Select department…'}</option>
                {depts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Branch">
              <select style={selectStyle()} value={form.branch} onChange={set('branch')} disabled={orgLoading || branchesError}>
                <option value="">{orgLoading ? 'Loading…' : branchesError ? 'Failed to load branches. Please refresh.' : 'Select branch…'}</option>
                {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
            </Field>
          </div>

          {/* Row 4 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Group Assignment">
              <select style={selectStyle()} value={form.groupId} onChange={set('groupId')} disabled={groupsLoading}>
                <option value="">
                  {groupsLoading ? 'Loading groups…' : groupsError ? 'Failed to load groups' : 'No group assigned'}
                </option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name}{g.dept ? ` (${g.dept})` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Access Level">
              <select style={selectStyle()} value={form.accessLevel} onChange={set('accessLevel')}>
                {ACCESS_LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>

          {/* Row 5 */}
          <Field label="Manager">
            <select style={selectStyle()} value={form.managerId} onChange={set('managerId')} disabled={managersLoading}>
              <option value="">
                {managersLoading ? 'Loading managers…' : managersError ? 'Failed to load managers' : 'No manager assigned'}
              </option>
              {managers.map(m => (
                <option key={m.id} value={m.id}>
                  {m.fullName} ({m.role})
                </option>
              ))}
            </select>
          </Field>

          {/* Skills */}
          <Field label="Skills">
            {form.skills.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
                {form.skills.map(s => (
                  <span key={s} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: '#eff6ff', color: '#1d4ed8',
                    borderRadius: 100, fontSize: 11, fontWeight: 600, padding: '3px 8px',
                  }}>
                    {s}
                    <button
                      onClick={() => setForm(prev => ({ ...prev, skills: prev.skills.filter(x => x !== s) }))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#60a5fa', padding: 0, fontSize: 13, lineHeight: 1 }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              style={INPUT}
              value={form.skillInput}
              onChange={set('skillInput')}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
              placeholder="Type a skill and press Enter…"
            />
          </Field>

        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 8,
          padding: '14px 22px', borderTop: '1px solid #e5e7eb', flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 18px', fontSize: 13, fontFamily: 'inherit', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#374151' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: '8px 18px', fontSize: 13, fontFamily: 'inherit', fontWeight: 600,
              background: submitting ? '#9ca3af' : '#16a34a',
              border: 'none', borderRadius: 7,
              cursor: submitting ? 'not-allowed' : 'pointer', color: '#fff',
            }}
          >
            {submitting ? 'Creating…' : '+ Add User'}
          </button>
        </div>
      </div>
    </div>
  );
}
