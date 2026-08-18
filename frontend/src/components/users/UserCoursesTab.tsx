// User Details Drawer — Courses tab. Real GET /users/:id/courses (Fix 1,
// DEFERRED_ITEMS.md Users item). "Assign Course" reuses EnrollLearnerModal
// as-is and is gated to role === 'learner': the backend enroll path
// (POST /learners/:id/enrollments) hard-asserts role=LEARNER
// (learners.service.assertIsLearner) — reusing the modal for any other role
// would 404. Unenroll is role-agnostic (delegates straight to
// enrollments.service.deleteEnrollment via users.service).

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserCourses, unenrollUserCourse } from '../../api/users';
import type { UserCourseEnrollment, EnrollmentStatus } from '../../types/users';
import EnrollLearnerModal from '../learners/EnrollLearnerModal';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import type { ToastType } from './Toast';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusMeta(status: EnrollmentStatus): { label: string; color: string; bg: string } {
  if (status === 'COMPLETED')   return { label: 'Completed',   color: '#16a34a', bg: '#f0fdf4' };
  if (status === 'IN_PROGRESS') return { label: 'In Progress', color: '#2563eb', bg: '#eff6ff' };
  if (status === 'OVERDUE')     return { label: 'Overdue',     color: '#dc2626', bg: '#fef2f2' };
  return                               { label: 'Not Started', color: '#6b7280', bg: '#f9fafb' };
}

function progressColor(pct: number): string {
  if (pct >= 80) return '#16a34a';
  if (pct >= 40) return '#d97706';
  return '#dc2626';
}

interface Props {
  userId:    string;
  userRole:  string;
  fullName:  string;
  showToast: (type: ToastType, message: string) => void;
  onChanged: () => void;
}

export default function UserCoursesTab({ userId, userRole, fullName, showToast, onChanged }: Props) {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<UserCourseEnrollment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getUserCourses(userId)
      .then(setCourses)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load courses.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [userId]);

  const handleUnenroll = async (row: UserCourseEnrollment) => {
    const confirmed = window.confirm(`Unenroll ${fullName} from "${row.title}"?`);
    if (!confirmed) return;
    setBusyId(row.enrollmentId);
    try {
      await unenrollUserCourse(userId, row.enrollmentId);
      invalidateFor(appQueryClient, 'user.courseUnenroll', { id: userId, courseId: row.courseId ?? undefined });
      showToast('success', `${fullName} unenrolled from "${row.title}".`);
      onChanged();
      load();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Failed to unenroll user.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13 }}>Loading courses…</div>;
  }

  if (error) {
    return <div style={{ textAlign: 'center', padding: '32px 0', color: '#b91c1c', fontSize: 13 }}>{error}</div>;
  }

  const canAssign = userRole === 'learner';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          onClick={() => setAssignOpen(true)}
          disabled={!canAssign}
          title={canAssign ? 'Assign Course' : 'Course assignment is only available for learner accounts.'}
          style={{
            padding: '7px 14px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
            background: canAssign ? '#2563eb' : '#e5e7eb', color: canAssign ? '#fff' : '#9ca3af',
            border: 'none', borderRadius: 7, cursor: canAssign ? 'pointer' : 'not-allowed',
          }}
        >
          + Assign Course
        </button>
      </div>

      {(!courses || courses.length === 0) ? (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>No courses enrolled yet</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {courses.map(row => {
            const sm = statusMeta(row.status);
            return (
              <div key={row.enrollmentId} style={{ padding: '12px 14px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', flex: 1 }}>{row.title}</span>
                  <span style={{ background: sm.bg, color: sm.color, borderRadius: 100, fontSize: 10, fontWeight: 600, padding: '2px 8px', flexShrink: 0 }}>
                    {sm.label}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1, height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${row.progress}%`, background: progressColor(row.progress), borderRadius: 3, transition: 'width 0.4s ease' }} />
                  </div>
                  <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, minWidth: 34, textAlign: 'right' }}>{row.progress}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#9ca3af' }}>
                  <span>
                    Enrolled {formatDate(row.enrolledAt)}
                    {row.completedAt && <> · Completed {formatDate(row.completedAt)}</>}
                  </span>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => navigate('/learning-management?tab=courses')}
                      style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                    >
                      View Course
                    </button>
                    <button
                      onClick={() => handleUnenroll(row)}
                      disabled={busyId === row.enrollmentId}
                      style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 11, fontWeight: 600, cursor: busyId === row.enrollmentId ? 'not-allowed' : 'pointer', fontFamily: 'inherit', padding: 0, opacity: busyId === row.enrollmentId ? 0.6 : 1 }}
                    >
                      {busyId === row.enrollmentId ? 'Unenrolling…' : 'Unenroll'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {assignOpen && (
        <EnrollLearnerModal
          mode="course"
          learnerId={userId}
          fullName={fullName}
          onClose={() => setAssignOpen(false)}
          onSuccess={() => {
            setAssignOpen(false);
            onChanged();
            load();
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
}
