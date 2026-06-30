import { useState } from 'react';
import type { ToastType } from '../users/Toast';
import {
  updateAssignment,
  UserRoleAssignmentError,
} from '../../api/userRoleAssignments';
import type { Assignment, AssignmentType } from '../../api/userRoleAssignments';

// ── Shared styles ──────────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box', border: '1px solid #d1d5db',
  borderRadius: 6, color: '#374151', background: '#ffffff',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

const LABEL: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4,
};

function focusIn(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = '#3b82f6';
  e.currentTarget.style.boxShadow   = '0 0 0 2px rgba(59,130,246,0.15)';
}
function focusOut(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = '#d1d5db';
  e.currentTarget.style.boxShadow   = 'none';
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
      color: '#6b7280', paddingBottom: 8, marginBottom: 12,
      borderBottom: '1px solid #f3f4f6',
    }}>
      {title}
    </div>
  );
}

function tomorrowISODate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ── Assignment type option list ────────────────────────────────────────────────

const TYPE_OPTIONS: { value: AssignmentType; label: string; description: string }[] = [
  { value: 'PRIMARY',   label: 'Primary',   description: 'Main role — replaces any existing primary' },
  { value: 'SECONDARY', label: 'Secondary', description: 'Additional role alongside primary' },
  { value: 'TEMPORARY', label: 'Temporary', description: 'Time-limited access' },
  { value: 'EMERGENCY', label: 'Emergency', description: 'Emergency override access' },
];

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  assignment: Assignment;
  onClose:    () => void;
  onSuccess:  () => void;
  showToast:  (type: ToastType, message: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EditAssignmentModal({ assignment, onClose, onSuccess, showToast }: Props) {
  const [assignmentType, setAssignmentType] = useState<AssignmentType>(assignment.assignmentType);
  const [expiresAt,      setExpiresAt]      = useState(assignment.expiresAt ? assignment.expiresAt.slice(0, 10) : '');

  const [error,      setError]      = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting,  setSubmitting]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    setError(null);

    if (assignmentType === 'TEMPORARY' && !expiresAt) {
      setError('Expiration date is required for temporary assignments.');
      return;
    }

    setSubmitting(true);
    try {
      await updateAssignment(assignment.id, {
        assignmentType,
        expiresAt: assignmentType === 'TEMPORARY' ? expiresAt : null,
      });
      showToast('success', 'Assignment updated successfully');
      window.dispatchEvent(new CustomEvent('rolesUpdated'));
      window.dispatchEvent(new CustomEvent('userDataChanged'));
      onSuccess();
    } catch (err) {
      if (err instanceof UserRoleAssignmentError) {
        setServerError(err.message);
        showToast('error', err.message);
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to update assignment';
        setServerError(msg);
        showToast('error', msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2500,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '24px 16px', overflowY: 'auto',
    }}>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />

      <div style={{
        position: 'relative', background: '#fff', borderRadius: 12,
        width: '100%', maxWidth: 520, padding: 28,
        boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
        marginTop: 'auto', marginBottom: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#111827' }}>
              Edit Assignment
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6b7280' }}>
              Update the assignment type or expiration.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6,
              cursor: 'pointer', color: '#6b7280', padding: 0, flexShrink: 0,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {serverError && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6,
            padding: '8px 12px', marginBottom: 16, fontSize: 12, color: '#b91c1c',
          }}>
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* ── Read-only user/role ── */}
          <div style={{ marginBottom: 22 }}>
            <SectionHeader title="User & Role" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={LABEL}>User</label>
                <div style={{ ...INPUT, background: '#f9fafb', color: '#9ca3af', cursor: 'not-allowed' }}>
                  {assignment.user.fullName}
                </div>
              </div>
              <div>
                <label style={LABEL}>Role</label>
                <div style={{ ...INPUT, background: '#f9fafb', color: '#9ca3af', cursor: 'not-allowed' }}>
                  {assignment.role.name}
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>
                To change the user or role, remove this assignment and create a new one.
              </p>
            </div>
          </div>

          {/* ── Assignment Type ── */}
          <div style={{ marginBottom: 22 }}>
            <SectionHeader title="Assignment Type" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TYPE_OPTIONS.map(opt => {
                const active = assignmentType === opt.value;
                return (
                  <label
                    key={opt.value}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                      padding: '9px 12px', borderRadius: 8,
                      background: active ? '#eff6ff' : '#f9fafb',
                      border: active ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                    }}
                  >
                    <input
                      type="radio"
                      name="editAssignmentType"
                      checked={active}
                      onChange={() => { setAssignmentType(opt.value); setError(null); }}
                      style={{ marginTop: 2, accentColor: '#2563eb', cursor: 'pointer' }}
                    />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111827' }}>{opt.label}</div>
                      <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 1 }}>{opt.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* ── Expiration (TEMPORARY only) ── */}
          {assignmentType === 'TEMPORARY' && (
            <div style={{ marginBottom: 24 }}>
              <SectionHeader title="Expiration" />
              <div>
                <label style={LABEL}>Expiration Date <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="date"
                  value={expiresAt}
                  min={tomorrowISODate()}
                  onChange={e => { setExpiresAt(e.target.value); setError(null); }}
                  style={{ ...INPUT, cursor: 'text', borderColor: error ? '#ef4444' : '#d1d5db' }}
                  onFocus={focusIn} onBlur={focusOut}
                />
                {error && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{error}</div>}
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 8,
            paddingTop: 16, borderTop: '1px solid #f3f4f6',
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '8px 18px', fontSize: 13, fontFamily: 'inherit',
                background: '#f9fafb', border: '1px solid #e5e7eb',
                borderRadius: 7, cursor: 'pointer', color: '#374151',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '8px 20px', fontSize: 13, fontFamily: 'inherit',
                fontWeight: 600,
                background: submitting ? '#93c5fd' : '#2563eb',
                border: 'none', borderRadius: 7,
                cursor: submitting ? 'not-allowed' : 'pointer', color: '#fff',
              }}
            >
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
