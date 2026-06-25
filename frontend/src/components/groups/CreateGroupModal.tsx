import { useState, useEffect } from 'react';
import { groupsAPI } from '../../api/groups';
import { getUsers } from '../../api/users';
import useOrgOptions from '../../hooks/useOrgOptions';
import type { User } from '../../types/users';

const ROLE_LABEL: Record<string, string> = {
  learner: 'Learner', instructor: 'Instructor',
  manager: 'Manager', admin_assistant: 'Admin Asst.',
};

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

const INPUT: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '6px',
  fontSize: '14px', boxSizing: 'border-box', width: '100%', color: '#111827', outline: 'none',
};

const LABEL: React.CSSProperties = {
  display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '13px', color: '#374151',
};

const FIELD: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px' };

const CreateGroupModal: React.FC<Props> = ({ onClose, onSaved }) => {
  const { depts, loading: orgLoading } = useOrgOptions();
  const [users,        setUsers]        = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [busy,         setBusy]         = useState(false);
  const [error,        setError]        = useState('');

  const [form, setForm] = useState({
    name:         '',
    description:  '',
    departmentId: '',
    leaderId:     '',
    status:       'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  // Load users for leader dropdown
  useEffect(() => {
    // usersLoading already starts true (see useState above); this effect
    // only ever runs once per mount ([] deps), so no need to set it again.
    getUsers({ limit: 100, status: 'active' })
      .then((res) => setUsers(res.users ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load users.'))
      .finally(() => setUsersLoading(false));
  }, []);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Group name is required.'); return; }
    setBusy(true);
    setError('');
    try {
      await groupsAPI.createGroup({
        name:         form.name.trim(),
        description:  form.description.trim() || null,
        departmentId: form.departmentId || null,
        leaderId:     form.leaderId || undefined,
        status:       form.status,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '28px', maxWidth: '500px', width: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>➕ Create Group</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>Fill in the details to create a new group.</p>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '6px', marginBottom: '16px', fontSize: '14px', border: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span>
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', fontSize: '18px', lineHeight: 1 }}>×</button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Group Name */}
          <div style={FIELD}>
            <label style={LABEL}>Group Name *</label>
            <input
              type="text" value={form.name}
              onChange={(e) => set('name', e.target.value)}
              style={INPUT} placeholder="e.g. Development Team"
            />
          </div>

          {/* Description */}
          <div style={FIELD}>
            <label style={LABEL}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              style={{ ...INPUT, resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="What this group does…"
            />
          </div>

          {/* Department — optional */}
          <div style={FIELD}>
            <label style={LABEL}>Department</label>
            <select
              value={form.departmentId}
              onChange={(e) => set('departmentId', e.target.value)}
              style={{ ...INPUT, cursor: 'pointer' }}
              disabled={orgLoading}
            >
              <option value="">{orgLoading ? 'Loading departments…' : 'No department (optional)'}</option>
              {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {/* Leader */}
          <div style={FIELD}>
            <label style={LABEL}>Leader</label>
            <select
              value={form.leaderId}
              onChange={(e) => set('leaderId', e.target.value)}
              style={{ ...INPUT, cursor: usersLoading ? 'default' : 'pointer' }}
              disabled={usersLoading}
            >
              <option value="">{usersLoading ? 'Loading users…' : '— None —'}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} ({ROLE_LABEL[u.role] ?? u.role})
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div style={FIELD}>
            <label style={LABEL}>Status</label>
            <select
              value={form.status}
              onChange={(e) => set('status', e.target.value as 'ACTIVE' | 'INACTIVE')}
              style={{ ...INPUT, cursor: 'pointer' }}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', border: '1px solid #e5e7eb', backgroundColor: 'white', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', color: '#374151' }}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{ padding: '8px 16px', backgroundColor: busy ? '#93c5fd' : '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: busy ? 'default' : 'pointer', fontSize: '14px', fontWeight: 500 }}
            disabled={busy}
          >
            {busy ? 'Creating…' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupModal;
