import { useState } from 'react';
import { suspendInstructor } from '../../services/instructorsApi';
import { InstructorApiError } from '../../types/instructors';
import type { InstructorViolationType } from '../../types/instructors';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';

interface Props {
  instructorId: string;
  fullName:     string;
  onClose:      () => void;
  onSuccess:    () => void;
  showToast:    (type: 'success' | 'error', message: string) => void;
}

const VIOLATION_TYPES: { value: InstructorViolationType; label: string }[] = [
  { value: 'COPYRIGHT', label: 'Copyright' },
  { value: 'POLICY',    label: 'Policy Violation' },
  { value: 'FRAUD',     label: 'Fraud' },
  { value: 'BEHAVIOR',  label: 'Inappropriate Behavior' },
  { value: 'FAKE_CERT', label: 'Fake Certification' },
  { value: 'SECURITY',  label: 'Security' },
];

const TA: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid #e5e7eb', borderRadius: 6,
  background: '#fff', color: '#374151',
  fontFamily: 'inherit', outline: 'none', resize: 'vertical',
  boxSizing: 'border-box',
};

export default function SuspendInstructorDialog({ instructorId, fullName, onClose, onSuccess, showToast }: Props) {
  const [violationType, setViolationType] = useState<InstructorViolationType | ''>('');
  const [violationErr,  setViolationErr]  = useState('');
  const [reason,     setReason]     = useState('');
  const [notes,      setNotes]      = useState('');
  const [reasonErr,  setReasonErr]  = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (submitting) return;
    let hasError = false;
    if (!violationType) { setViolationErr('Violation type is required.'); hasError = true; }
    const trimmed = reason.trim();
    if (trimmed.length < 20) { setReasonErr('Reason must be at least 20 characters.'); hasError = true; }
    if (hasError) return;
    setReasonErr('');
    setViolationErr('');
    setSubmitting(true);
    try {
      await suspendInstructor(instructorId, {
        reason: trimmed,
        violationType: violationType as InstructorViolationType,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      invalidateFor(appQueryClient, 'instructor.suspend', { id: instructorId });
      showToast('success', `${fullName} has been suspended.`);
      onSuccess();
    } catch (err) {
      if (err instanceof InstructorApiError) {
        showToast('error', err.message);
      } else {
        showToast('error', 'Something went wrong, please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={!submitting ? onClose : undefined} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth: 420, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
          </div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Suspend Instructor</h3>
        </div>

        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>
          Are you sure you want to suspend <strong>{fullName}</strong>? They will lose access to the system.
          Their courses stay published — suspending does not unpublish them.
        </p>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            Violation Type <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <select
            aria-label="Violation type"
            value={violationType}
            onChange={e => { setViolationType(e.target.value as InstructorViolationType); setViolationErr(''); }}
            style={violationErr ? { ...TA, borderColor: '#fca5a5', background: '#fef2f2' } : TA}
          >
            <option value="">Select a violation type…</option>
            {VIOLATION_TYPES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
          {violationErr && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3 }}>{violationErr}</div>}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            Reason <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <textarea
            aria-label="Suspension reason"
            style={reasonErr ? { ...TA, borderColor: '#fca5a5', background: '#fef2f2', height: 72 } : { ...TA, height: 72 }}
            value={reason}
            onChange={e => { setReason(e.target.value); setReasonErr(''); }}
            placeholder="Enter reason for suspension (min. 20 characters)…"
          />
          {reasonErr && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3 }}>{reasonErr}</div>}
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            Administrative Notes <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            aria-label="Administrative notes"
            style={{ ...TA, height: 60 }}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Internal notes…"
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} disabled={submitting} style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'inherit', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#374151' }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'inherit', fontWeight: 600, background: submitting ? '#9ca3af' : '#ea580c', border: 'none', borderRadius: 7, cursor: submitting ? 'not-allowed' : 'pointer', color: '#fff' }}
          >
            {submitting ? 'Suspending…' : 'Confirm Suspend'}
          </button>
        </div>
      </div>
    </div>
  );
}
