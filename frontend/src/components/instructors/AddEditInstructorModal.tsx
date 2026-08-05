import { useEffect, useState } from 'react';
import { createInstructor, updateInstructor } from '../../services/instructorsApi';
import { InstructorApiError } from '../../types/instructors';
import type { Instructor } from '../../types/instructors';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';

interface Props {
  mode:      'create' | 'edit';
  instructor?: Instructor;
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

export default function AddEditInstructorModal({ mode, instructor, onClose, onSuccess, showToast }: Props) {
  const [fullName,        setFullName]        = useState(instructor?.fullName ?? '');
  const [email,           setEmail]           = useState(instructor?.email ?? '');
  const [password,        setPassword]        = useState('');
  const [status,          setStatus]          = useState<'ACTIVE' | 'PENDING' | 'INVITED'>('ACTIVE');
  const [phone,           setPhone]           = useState(instructor?.phone ?? '');
  const [skillsInput,     setSkillsInput]     = useState((instructor?.skills ?? []).join(', '));
  const [specialization,  setSpecialization]  = useState(instructor?.specialization ?? '');
  const [headline,        setHeadline]        = useState(instructor?.headline ?? '');
  const [bio,              setBio]            = useState(instructor?.bio ?? '');
  const [yearsExperience, setYearsExperience] = useState(instructor?.yearsExperience?.toString() ?? '');
  const [websiteUrl,      setWebsiteUrl]      = useState(instructor?.websiteUrl ?? '');
  const [linkedinUrl,     setLinkedinUrl]     = useState(instructor?.linkedinUrl ?? '');

  const [errors,     setErrors]     = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    if (websiteUrl.trim() && !/^https?:\/\//i.test(websiteUrl.trim())) next.websiteUrl = 'Must start with http:// or https://';
    if (linkedinUrl.trim() && !/^https?:\/\//i.test(linkedinUrl.trim())) next.linkedinUrl = 'Must start with http:// or https://';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    const skills = skillsInput.split(',').map(s => s.trim()).filter(Boolean);
    setSubmitting(true);
    try {
      if (mode === 'create') {
        await createInstructor({
          fullName: fullName.trim(),
          email:    email.trim(),
          ...(status !== 'INVITED' ? { password } : {}),
          status,
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          ...(skills.length ? { skills } : {}),
          ...(specialization.trim() ? { specialization: specialization.trim() } : {}),
          ...(headline.trim() ? { headline: headline.trim() } : {}),
          ...(bio.trim() ? { bio: bio.trim() } : {}),
          ...(yearsExperience.trim() ? { yearsExperience: Number(yearsExperience) } : {}),
          ...(websiteUrl.trim() ? { websiteUrl: websiteUrl.trim() } : {}),
          ...(linkedinUrl.trim() ? { linkedinUrl: linkedinUrl.trim() } : {}),
        });
        invalidateFor(appQueryClient, 'instructor.create');
        showToast('success', `${fullName.trim()} added as an instructor.`);
      } else if (instructor) {
        await updateInstructor(instructor.id, {
          fullName: fullName.trim(),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          skills,
          ...(specialization.trim() ? { specialization: specialization.trim() } : {}),
          ...(headline.trim() ? { headline: headline.trim() } : {}),
          ...(bio.trim() ? { bio: bio.trim() } : {}),
          ...(yearsExperience.trim() ? { yearsExperience: Number(yearsExperience) } : {}),
          ...(websiteUrl.trim() ? { websiteUrl: websiteUrl.trim() } : {}),
          ...(linkedinUrl.trim() ? { linkedinUrl: linkedinUrl.trim() } : {}),
        });
        invalidateFor(appQueryClient, 'instructor.update', { id: instructor.id });
        showToast('success', 'Instructor updated.');
      }
      onSuccess();
    } catch (err) {
      const msg = err instanceof InstructorApiError ? err.message : 'Something went wrong. Please try again.';
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
            {mode === 'create' ? 'Add Instructor' : `Edit ${instructor?.fullName ?? 'Instructor'}`}
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
            <input style={INPUT} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Rana Haddad" />
            {errors.fullName && <div style={ERR}>{errors.fullName}</div>}
          </div>

          {mode === 'create' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={LABEL}>Email <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="email" style={INPUT} value={email} onChange={e => setEmail(e.target.value)} placeholder="rana@example.com" />
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
              <label style={LABEL}>Specialization</label>
              <input style={INPUT} value={specialization} onChange={e => setSpecialization(e.target.value)} placeholder="Machine Learning" />
            </div>
          </div>

          <div>
            <label style={LABEL}>Headline</label>
            <input style={INPUT} value={headline} onChange={e => setHeadline(e.target.value)} placeholder="Senior ML Engineer & Educator" maxLength={200} />
          </div>

          <div>
            <label style={LABEL}>Bio</label>
            <textarea style={{ ...INPUT, resize: 'vertical', minHeight: 70 }} value={bio} onChange={e => setBio(e.target.value)} maxLength={5000} placeholder="Short professional bio…" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={LABEL}>Years Experience</label>
              <input type="number" min={0} max={70} style={INPUT} value={yearsExperience} onChange={e => setYearsExperience(e.target.value)} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={LABEL}>Skills <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>(comma-separated)</span></label>
              <input style={INPUT} value={skillsInput} onChange={e => setSkillsInput(e.target.value)} placeholder="Python, ML, Data Science" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={LABEL}>Website URL</label>
              <input style={INPUT} value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://…" />
              {errors.websiteUrl && <div style={ERR}>{errors.websiteUrl}</div>}
            </div>
            <div>
              <label style={LABEL}>LinkedIn URL</label>
              <input style={INPUT} value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/…" />
              {errors.linkedinUrl && <div style={ERR}>{errors.linkedinUrl}</div>}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <button type="button" onClick={onClose} disabled={submitting} style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'inherit', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#374151' }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} style={{ padding: '8px 18px', fontSize: 13, fontFamily: 'inherit', fontWeight: 600, background: submitting ? '#93c5fd' : '#2563eb', border: 'none', borderRadius: 7, cursor: submitting ? 'not-allowed' : 'pointer', color: '#fff' }}>
              {submitting ? 'Saving…' : mode === 'create' ? 'Add Instructor' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
