// Mirrors AddEditInstructorModal.tsx — same shape, learner-specific profile
// fields (program/level/department/batch/advisor/verification/risk instead of
// specialization/headline/bio/website/linkedin).

import { useEffect, useState } from 'react';
import { createLearner, updateLearner } from '../../services/learnersApi';
import { LearnerApiError } from '../../types/learners';
import type { Learner, LearnerLevel, LearnerVerificationStatus } from '../../types/learners';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';

interface Props {
  mode:    'create' | 'edit';
  learner?: Learner;
  onClose:   () => void;
  onSuccess: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

const INPUT: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  border: '1px solid #d1d5db', borderRadius: 6, color: '#374151', background: '#fff',
};
const LABEL: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4,
};
const ERR: React.CSSProperties = { fontSize: 11, color: '#ef4444', marginTop: 3 };

const STATUS_OPTIONS = [
  { value: 'ACTIVE',  label: 'Active — verified immediately' },
  { value: 'PENDING', label: 'Pending — needs verification' },
  { value: 'INVITED', label: 'Invited — no password yet' },
];

const LEVEL_OPTIONS: LearnerLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const VERIFICATION_OPTIONS: LearnerVerificationStatus[] = ['PENDING', 'VERIFIED', 'REJECTED'];

export default function AddEditLearnerModal({ mode, learner, onClose, onSuccess, showToast }: Props) {
  const [fullName, setFullName] = useState(learner?.fullName ?? '');
  const [email,    setEmail]    = useState(learner?.email ?? '');
  const [password, setPassword] = useState('');
  const [status,   setStatus]   = useState<'ACTIVE' | 'PENDING' | 'INVITED'>('ACTIVE');
  const [phone,    setPhone]    = useState(learner?.phone ?? '');

  const [program,    setProgram]    = useState(learner?.program ?? '');
  const [level,      setLevel]      = useState<LearnerLevel>(learner?.level ?? 'BEGINNER');
  const [department, setDepartment] = useState(learner?.department ?? '');
  const [batch,       setBatch]     = useState(learner?.batch ?? '');
  const [advisorId,  setAdvisorId]  = useState(learner?.advisorId ?? '');
  const [verificationStatus, setVerificationStatus] = useState<LearnerVerificationStatus>(learner?.verificationStatus ?? 'PENDING');
  const [riskScore,  setRiskScore]  = useState(learner?.riskScore?.toString() ?? '');

  const [errors,      setErrors]      = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting,  setSubmitting]  = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (fullName.trim().length < 2) next.fullName = 'Full name must be at least 2 characters.';
    if (mode === 'create') {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = 'Enter a valid email address.';
      if (status !== 'INVITED' && password.length < 12) {
        next.password = 'Password must be at least 12 characters (upper, lower, digit, symbol).';
      }
    }
    if (riskScore.trim()) {
      const n = Number(riskScore);
      if (!Number.isInteger(n) || n < 0 || n > 100) next.riskScore = 'Risk score must be an integer 0-100.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      if (mode === 'create') {
        await createLearner({
          fullName: fullName.trim(),
          email:    email.trim(),
          ...(status !== 'INVITED' ? { password } : {}),
          status,
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          ...(program.trim() ? { program: program.trim() } : {}),
          level,
          ...(department.trim() ? { department: department.trim() } : {}),
          ...(batch.trim() ? { batch: batch.trim() } : {}),
          ...(advisorId.trim() ? { advisorId: advisorId.trim() } : {}),
          verificationStatus,
          ...(riskScore.trim() ? { riskScore: Number(riskScore) } : {}),
        });
        invalidateFor(appQueryClient, 'learner.create');
        showToast('success', `${fullName.trim()} added as a learner.`);
      } else if (learner) {
        // Sent unconditionally, like AddEditInstructorModal's edit path — an
        // omitted key means "leave unchanged" server-side.
        await updateLearner(learner.id, {
          fullName:    fullName.trim(),
          phone:       phone.trim(),
          program:     program.trim(),
          level,
          department:  department.trim(),
          batch:       batch.trim(),
          advisorId:   advisorId.trim(),
          verificationStatus,
          riskScore: riskScore.trim() ? Number(riskScore) : null,
        });
        invalidateFor(appQueryClient, 'learner.update', { id: learner.id });
        showToast('success', 'Learner updated.');
      }
      onSuccess();
    } catch (err) {
      const msg = err instanceof LearnerApiError ? err.message : 'Something went wrong. Please try again.';
      setServerError(msg);
      showToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={!submitting ? onClose : undefined} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>
            {mode === 'create' ? 'Add Learner' : `Edit ${learner?.fullName ?? 'Learner'}`}
          </h3>
          <button type="button" onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {serverError && (
            <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#b91c1c' }}>{serverError}</div>
          )}

          <div>
            <label style={LABEL}>Full Name <span style={{ color: '#ef4444' }}>*</span></label>
            <input style={INPUT} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Alex Rivera" />
            {errors.fullName && <div style={ERR}>{errors.fullName}</div>}
          </div>

          {mode === 'create' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={LABEL}>Email <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="email" style={INPUT} value={email} onChange={e => setEmail(e.target.value)} placeholder="alex@example.com" />
                  {errors.email && <div style={ERR}>{errors.email}</div>}
                </div>
                <div>
                  <label style={LABEL}>Status</label>
                  <select style={{ ...INPUT, cursor: 'pointer' }} value={status} onChange={e => setStatus(e.target.value as typeof status)}>
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              {status !== 'INVITED' && (
                <div>
                  <label style={LABEL}>Password <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="password" style={INPUT} value={password} onChange={e => setPassword(e.target.value)} placeholder="≥12 chars, upper+lower+digit+symbol" />
                  {errors.password && <div style={ERR}>{errors.password}</div>}
                </div>
              )}
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={LABEL}>Phone</label>
              <input style={INPUT} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+961…" />
            </div>
            <div>
              <label style={LABEL}>Program</label>
              <input style={INPUT} value={program} onChange={e => setProgram(e.target.value)} placeholder="Data Science" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={LABEL}>Level</label>
              <select style={{ ...INPUT, cursor: 'pointer' }} value={level} onChange={e => setLevel(e.target.value as LearnerLevel)}>
                {LEVEL_OPTIONS.map(l => <option key={l} value={l}>{l[0] + l.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL}>Department</label>
              <input style={INPUT} value={department} onChange={e => setDepartment(e.target.value)} placeholder="Engineering" />
            </div>
            <div>
              <label style={LABEL}>Batch</label>
              <input style={INPUT} value={batch} onChange={e => setBatch(e.target.value)} placeholder="2026-A" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={LABEL}>Advisor ID <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
              <input style={INPUT} value={advisorId} onChange={e => setAdvisorId(e.target.value)} placeholder="AppUser id" />
            </div>
            <div>
              <label style={LABEL}>Verification</label>
              <select style={{ ...INPUT, cursor: 'pointer' }} value={verificationStatus} onChange={e => setVerificationStatus(e.target.value as LearnerVerificationStatus)}>
                {VERIFICATION_OPTIONS.map(v => <option key={v} value={v}>{v[0] + v.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL}>Risk Score <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>(0-100)</span></label>
              <input type="number" min={0} max={100} style={INPUT} value={riskScore} onChange={e => setRiskScore(e.target.value)} />
              {errors.riskScore && <div style={ERR}>{errors.riskScore}</div>}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <button type="button" onClick={onClose} disabled={submitting} style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'inherit', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#374151' }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} style={{ padding: '8px 18px', fontSize: 13, fontFamily: 'inherit', fontWeight: 600, background: submitting ? '#93c5fd' : '#2563eb', border: 'none', borderRadius: 7, cursor: submitting ? 'not-allowed' : 'pointer', color: '#fff' }}>
              {submitting ? 'Saving…' : mode === 'create' ? 'Add Learner' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
