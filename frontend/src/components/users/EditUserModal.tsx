import { useState } from 'react';
import { updateUser, ApiError } from '../../api/users';
import type { UpdateUserRequest } from '../../types/users';
import type { ToastType } from './Toast';
import { ACCESS_LEVEL_OPTIONS } from '../../constants/userOptions';
import useRoles from '../../hooks/useRoles';
import useOrgOptions from '../../hooks/useOrgOptions';

export interface EditInitialData {
  fullName:    string;
  phone:       string | null;
  department:  string | null;
  branch:      string | null;
  groupId:     string | null;
  accessLevel: string | null;
  managerId:   string | null;
  skills:      string[] | null;
  role?:       string | null;
}

interface Props {
  userId:      string;
  initialData: EditInitialData;
  onClose:     () => void;
  onSuccess:   (updated: EditInitialData) => void;
  showToast:   (type: ToastType, message: string) => void;
}

const INPUT: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid #e5e7eb', borderRadius: 6,
  background: '#fff', color: '#374151',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};

const ERR_INPUT: React.CSSProperties = {
  ...INPUT, borderColor: '#fca5a5', background: '#fef2f2',
};

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

export default function EditUserModal({ userId, initialData, onClose, onSuccess, showToast }: Props) {
  const { options: roleOptions, loading: rolesLoading, hasError: rolesError } = useRoles();
  const { depts, branches, loading: orgLoading, deptsError, branchesError } = useOrgOptions();

  const [form, setForm] = useState({
    fullName:    initialData.fullName,
    phone:       initialData.phone       ?? '',
    department:  initialData.department  ?? '',
    branch:      initialData.branch      ?? '',
    groupId:     initialData.groupId     ?? '',
    accessLevel: initialData.accessLevel ?? '',
    managerId:   initialData.managerId   ?? '',
    // API returns role as lowercase ("learner"), normalise to UPPER for dropdown match
    role:        (initialData.role ?? '').toUpperCase(),
    skillInput:  '',
    skills:      (initialData.skills ?? []) as string[],
  });
  const [nameError,  setNameError]  = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [formError,  setFormError]  = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  type FormKey = 'fullName' | 'phone' | 'department' | 'branch' | 'groupId' | 'accessLevel' | 'managerId' | 'role' | 'skillInput';
  const set = (k: FormKey) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  const addSkill = () => {
    const val = form.skillInput.trim();
    if (val && !form.skills.includes(val))
      setForm(prev => ({ ...prev, skills: [...prev.skills, val], skillInput: '' }));
  };

  const removeSkill = (skill: string) =>
    setForm(prev => ({ ...prev, skills: prev.skills.filter(s => s !== skill) }));

  const handleSubmit = async () => {
    const name = form.fullName.trim();
    if (!name) { setNameError('Full name is required'); return; }
    if (name.length < 2) { setNameError('Full name must be at least 2 characters'); return; }
    setNameError('');
    const phoneVal = form.phone.trim();
    if (phoneVal && !/^\+?[0-9]{7,15}$/.test(phoneVal)) {
      setPhoneError('Please enter a valid phone number');
      return;
    }
    setPhoneError('');
    setFormError(null);
    setSubmitting(true);

    const body: UpdateUserRequest = {
      fullName:    name,
      phone:       form.phone.trim()   || null,
      department:  form.department     || null,
      branch:      form.branch         || null,
      groupId:     form.groupId.trim() || null,
      accessLevel: form.accessLevel    || null,
      managerId:   form.managerId.trim() || null,
      skills:      form.skills.length > 0 ? form.skills : null,
      ...(form.role ? { role: form.role } : {}),
    };

    try {
      const res = await updateUser(userId, body);
      showToast('success', res.message || 'User updated successfully');
      onSuccess({ ...body, role: form.role || null });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400) setFormError(err.message);
        else if (err.status === 403) showToast('error', 'Not authorized');
        else if (err.status === 404) showToast('error', 'User not found');
        else showToast('error', err.message);
      } else {
        showToast('error', 'Something went wrong, please try again');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const selectStyle = (): React.CSSProperties => ({ ...INPUT, cursor: 'pointer' });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div style={{
        position: 'relative', background: '#fff', borderRadius: 12,
        width: '100%', maxWidth: 520, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Edit User</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 }}>
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

          <Field label="Full Name" required error={nameError}>
            <input
              style={nameError ? ERR_INPUT : INPUT}
              value={form.fullName}
              onChange={set('fullName')}
              placeholder="Full name"
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Phone Number" error={phoneError}>
              <input style={phoneError ? ERR_INPUT : INPUT} value={form.phone} onChange={set('phone')} placeholder="+1 555 000 0000" />
            </Field>
            <Field label="Role">
              <select style={selectStyle()} value={form.role} onChange={set('role')} disabled={rolesLoading || rolesError}>
                <option value="">{rolesLoading ? 'Loading roles…' : rolesError ? 'Failed to load roles. Please refresh.' : 'No change'}</option>
                {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Access Level">
              <select style={selectStyle()} value={form.accessLevel} onChange={set('accessLevel')}>
                {ACCESS_LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <div />{/* spacer */}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Department">
              <select style={selectStyle()} value={form.department} onChange={set('department')} disabled={orgLoading || deptsError}>
                <option value="">{orgLoading ? 'Loading…' : deptsError ? 'Failed to load departments. Please refresh.' : '— None —'}</option>
                {depts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Branch">
              <select style={selectStyle()} value={form.branch} onChange={set('branch')} disabled={orgLoading || branchesError}>
                <option value="">{orgLoading ? 'Loading…' : branchesError ? 'Failed to load branches. Please refresh.' : '— None —'}</option>
                {branches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Group Assignment">
              <input style={INPUT} value={form.groupId} onChange={set('groupId')} placeholder="Group ID or name" />
            </Field>
            <Field label="Manager">
              <input style={INPUT} value={form.managerId} onChange={set('managerId')} placeholder="Manager ID" />
            </Field>
          </div>

          <Field label="Skills">
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                style={{ ...INPUT, flex: 1 }}
                value={form.skillInput}
                onChange={set('skillInput')}
                placeholder="Type a skill and press Add"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
              />
              <button
                type="button"
                onClick={addSkill}
                style={{ padding: '8px 14px', fontSize: 13, fontFamily: 'inherit', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', color: '#374151', whiteSpace: 'nowrap' }}
              >
                Add
              </button>
            </div>
            {form.skills.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {form.skills.map(skill => (
                  <span key={skill} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#eff6ff', color: '#1d4ed8', fontSize: 12, fontWeight: 500, padding: '3px 8px', borderRadius: 20, border: '1px solid #bfdbfe' }}>
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#60a5fa', padding: 0, lineHeight: 1, fontSize: 14 }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Field>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 22px', borderTop: '1px solid #e5e7eb', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '8px 18px', fontSize: 13, fontFamily: 'inherit', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#374151' }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ padding: '8px 18px', fontSize: 13, fontFamily: 'inherit', fontWeight: 600, background: submitting ? '#9ca3af' : '#2563eb', border: 'none', borderRadius: 7, cursor: submitting ? 'not-allowed' : 'pointer', color: '#fff' }}
          >
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
