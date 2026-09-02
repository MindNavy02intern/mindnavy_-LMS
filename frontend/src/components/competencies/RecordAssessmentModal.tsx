import { useEffect, useRef, useState } from 'react';
import { getUsers } from '../../api/users';
import { createAssessment, getCompetencySettings, listSkills } from '../../services/competenciesApi';
import { ASSESSMENT_TYPES, CompetenciesApiError } from '../../types/competencies';
import type { AssessmentType, Skill } from '../../types/competencies';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';

interface Props {
  skillId?:   string; // pre-scoped when opened from a competency's side panel
  skillName?: string;
  onClose:    () => void;
  onSuccess:  () => void;
  showToast:  (type: 'success' | 'error', message: string) => void;
}

interface UserOption { id: string; fullName: string; email: string }

const INPUT: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  border: '1px solid #d1d5db', borderRadius: 6, color: '#374151', background: '#fff',
};
const LABEL: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };
const ERR: React.CSSProperties = { fontSize: 11, color: '#ef4444', marginTop: 3 };

export default function RecordAssessmentModal({ skillId, skillName, onClose, onSuccess, showToast }: Props) {
  const [userSearch, setUserSearch] = useState('');
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);

  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState(skillId ?? '');

  const [score, setScore] = useState('');
  const [maxScore, setMaxScore] = useState('100');
  const [type, setType] = useState<AssessmentType>('QUIZ');
  const typeTouchedRef = useRef(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!skillId) listSkills({ limit: 100 }).then(res => setSkills(res.skills)).catch(err => console.error(err));
  }, [skillId]);

  // Prefill from Settings' "Default assessment type" — best-effort, falls
  // back to the QUIZ initial state if the fetch fails, and never clobbers a
  // value the user already picked from the dropdown themselves.
  useEffect(() => {
    let cancelled = false;
    getCompetencySettings()
      .then(s => { if (!cancelled && !typeTouchedRef.current) setType(s.defaultAssessmentType); })
      .catch(err => console.error(err));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (userSearch.trim().length < 2) { setUserOptions([]); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      getUsers({ search: userSearch.trim(), limit: 8 })
        .then(res => { if (!cancelled) setUserOptions(res.users.map(u => ({ id: u.id, fullName: u.fullName, email: u.email }))); })
        .catch(err => console.error(err));
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [userSearch]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!selectedUser) next.user = 'Select a user.';
    if (!skillId && !selectedSkillId) next.skill = 'Select a competency.';
    const scoreNum = Number(score);
    const maxNum = Number(maxScore);
    if (score === '' || !Number.isInteger(scoreNum) || scoreNum < 0) next.score = 'Score must be a non-negative integer.';
    if (maxScore === '' || !Number.isInteger(maxNum) || maxNum <= 0) next.maxScore = 'Max score must be a positive integer.';
    if (!next.score && !next.maxScore && scoreNum > maxNum) next.score = 'Score cannot exceed max score.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validate() || !selectedUser) return;

    const finalSkillId = skillId ?? selectedSkillId;
    setSubmitting(true);
    try {
      await createAssessment({
        userId: selectedUser.id,
        skillId: finalSkillId,
        score: Number(score),
        maxScore: Number(maxScore),
        type,
      });
      invalidateFor(appQueryClient, 'assessment.create', { userId: selectedUser.id });
      showToast('success', `Assessment recorded for ${selectedUser.fullName}.`);
      onSuccess();
    } catch (err) {
      const msg = err instanceof CompetenciesApiError ? err.message : 'Something went wrong. Please try again.';
      setServerError(msg);
      showToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={!submitting ? onClose : undefined} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Record Assessment</h3>
          <button type="button" onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {serverError && (
            <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#b91c1c' }}>{serverError}</div>
          )}

          <div style={{ position: 'relative' }}>
            <label style={LABEL}>User *</label>
            {selectedUser ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}>
                <span>{selectedUser.fullName} <span style={{ color: '#94a3b8' }}>({selectedUser.email})</span></span>
                <button type="button" onClick={() => { setSelectedUser(null); setUserSearch(''); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>Change</button>
              </div>
            ) : (
              <>
                <input id="assessment-user-search" style={INPUT} value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search by name or email…" />
                {userOptions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, marginTop: 2, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 180, overflowY: 'auto' }}>
                    {userOptions.map(u => (
                      <button key={u.id} type="button" onClick={() => { setSelectedUser(u); setUserOptions([]); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#374151' }}>
                        {u.fullName} <span style={{ color: '#94a3b8' }}>({u.email})</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {errors.user && <div style={ERR}>{errors.user}</div>}
          </div>

          {skillId ? (
            <div>
              <label style={LABEL}>Competency</label>
              <div style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, color: '#374151', background: '#f8fafc' }}>{skillName}</div>
            </div>
          ) : (
            <div>
              <label style={LABEL} htmlFor="assessment-skill">Competency *</label>
              <select id="assessment-skill" style={INPUT} value={selectedSkillId} onChange={e => setSelectedSkillId(e.target.value)}>
                <option value="">Select a competency</option>
                {skills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {errors.skill && <div style={ERR}>{errors.skill}</div>}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={LABEL} htmlFor="assessment-score">Score *</label>
              <input id="assessment-score" style={INPUT} type="number" min={0} value={score} onChange={e => setScore(e.target.value)} />
              {errors.score && <div style={ERR}>{errors.score}</div>}
            </div>
            <div>
              <label style={LABEL} htmlFor="assessment-maxscore">Max Score *</label>
              <input id="assessment-maxscore" style={INPUT} type="number" min={1} value={maxScore} onChange={e => setMaxScore(e.target.value)} />
              {errors.maxScore && <div style={ERR}>{errors.maxScore}</div>}
            </div>
            <div>
              <label style={LABEL}>Type</label>
              <select style={INPUT} value={type} onChange={e => { typeTouchedRef.current = true; setType(e.target.value as AssessmentType); }}>
                {ASSESSMENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
            <button type="button" onClick={onClose} disabled={submitting} style={{ padding: '9px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} style={{ padding: '9px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Saving…' : 'Record Assessment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
