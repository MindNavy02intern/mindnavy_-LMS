// Instructor Profile page (/instructors/:id/profile) — DEFERRED_ITEMS.md:
// "View Profile" in InstructorSidePanel.tsx was permanently disabled with
// "not built yet". Reuses the SAME data (getInstructor) and the SAME
// Courses/Documents/Reviews/Certifications tab components the side panel
// already uses (InstructorCoursesTab etc.) rather than forking a second
// implementation — this page just lays them out full-width instead of in a
// 460px sticky sidebar, which is what "a real page" actually needs.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AdminLayout from '../../layouts/AdminLayout';
import { useToast, ToastContainer } from '../../components/users/Toast';
import { useTabParam } from '../../hooks/useTabParam';
import { getInstructor } from '../../services/instructorsApi';
import { InstructorApiError } from '../../types/instructors';
import type { InstructorDetail } from '../../types/instructors';
import InstructorCoursesTab from '../../components/instructors/InstructorCoursesTab';
import InstructorDocumentsTab from '../../components/instructors/InstructorDocumentsTab';
import InstructorReviewsTab from '../../components/instructors/InstructorReviewsTab';
import InstructorCertificationsTab from '../../components/instructors/InstructorCertificationsTab';

type ProfileTab = 'courses' | 'reviews' | 'certifications' | 'documents';
const TABS: { key: ProfileTab; label: string }[] = [
  { key: 'courses',        label: 'Courses' },
  { key: 'reviews',        label: 'Reviews' },
  { key: 'certifications', label: 'Certifications' },
  { key: 'documents',      label: 'Documents' },
];

function initials(name: string): string {
  return (name || '?').split(' ').map(w => w[0] ?? '').slice(0, 2).join('').toUpperCase();
}

const STAT: React.CSSProperties = { background: '#f8fafc', borderRadius: 10, padding: '12px 16px', textAlign: 'center', minWidth: 100 };
const STAT_LABEL: React.CSSProperties = { fontSize: 11, color: '#64748b', marginBottom: 4 };
const STAT_VALUE: React.CSSProperties = { fontSize: 18, fontWeight: 700, color: '#0f172a' };

export default function InstructorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toasts, showToast, dismiss } = useToast();
  const [tabKey, setTabKey] = useTabParam('courses');
  const tab = (TABS.some(t => t.key === tabKey) ? tabKey : 'courses') as ProfileTab;

  const [detail, setDetail]   = useState<InstructorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchDetail = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getInstructor(id)
      .then(setDetail)
      .catch(err => setError(err instanceof InstructorApiError ? err.message : 'Failed to load instructor.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  return (
    <AdminLayout pageTitle="Instructor Profile">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1100, margin: '0 auto' }}>
        <button
          type="button" onClick={() => navigate('/instructors')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', fontSize: 13, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <ArrowLeft size={15} /> Back to Instructors
        </button>

        {loading ? (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
        ) : error || !detail ? (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 40, textAlign: 'center', color: '#b91c1c', fontSize: 13 }}>{error ?? 'Instructor not found.'}</div>
        ) : (
          <>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
              {detail.avatar ? (
                <img src={detail.avatar} alt="" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, flexShrink: 0 }}>
                  {initials(detail.fullName)}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 19, fontWeight: 700, color: '#0f172a' }}>{detail.fullName}</div>
                {detail.headline && <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{detail.headline}</div>}
                {detail.specialization && (
                  <div style={{ fontSize: 12.5, color: '#374151', marginTop: 6 }}>
                    <strong style={{ color: '#0f172a' }}>Specialization:</strong> {detail.specialization}
                  </div>
                )}
                {detail.bio && <div style={{ fontSize: 12.5, color: '#374151', marginTop: 6, lineHeight: 1.5 }}>{detail.bio}</div>}
                {detail.skills.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {detail.skills.map(s => (
                      <span key={s} style={{ fontSize: 11, fontWeight: 600, color: '#374151', background: '#f1f5f9', padding: '2px 8px', borderRadius: 999 }}>{s}</span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={STAT}><div style={STAT_LABEL}>Courses</div><div style={STAT_VALUE}>{detail.coursesCount}</div></div>
                <div style={STAT}><div style={STAT_LABEL}>Students</div><div style={STAT_VALUE}>{detail.studentsCount}</div></div>
                <div style={STAT}><div style={STAT_LABEL}>Rating</div><div style={STAT_VALUE}>{detail.rating ?? '—'}</div></div>
                <div style={STAT}><div style={STAT_LABEL}>Revenue</div><div style={STAT_VALUE}>{detail.revenue ?? '—'}</div></div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0' }}>
              {TABS.map(t => {
                const active = tab === t.key;
                return (
                  <button
                    key={t.key} type="button" onClick={() => setTabKey(t.key)}
                    style={{
                      padding: '10px 14px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: 'none', cursor: 'pointer',
                      border: 'none', borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
                      color: active ? '#2563eb' : '#64748b', marginBottom: -1,
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div>
              {tab === 'courses' ? (
                <InstructorCoursesTab instructorId={detail.id} onChanged={fetchDetail} showToast={showToast} />
              ) : tab === 'reviews' ? (
                <InstructorReviewsTab instructorId={detail.id} showToast={showToast} />
              ) : tab === 'certifications' ? (
                <InstructorCertificationsTab instructorId={detail.id} showToast={showToast} />
              ) : (
                <InstructorDocumentsTab instructorId={detail.id} showToast={showToast} />
              )}
            </div>
          </>
        )}
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </AdminLayout>
  );
}
