import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import InstructorLayout from './InstructorLayout';
import { LABEL, INPUT, BTN_PRIMARY, BTN_SECONDARY, ERROR_BANNER, TH, TD, disabledStyle, statusBadgeStyle } from './instructorUiKit';
import { listMyCourses, createMyCourse, submitMyCourse, archiveMyCourse } from '../../api/instructorCoursesApi';
import { CourseApiError, type CourseListRow, type CourseStatusFilter, type CourseStatusCounts } from '../../types/courses';
import { listMyLearningPaths, getMyLearningPath, InstructorLearningPathsApiError } from '../../api/instructorLearningPathsApi';
import type { MyLearningPathRow, MyLearningPathDetail } from '../../types/instructorLearningPaths';

type TabKey = 'All' | 'Draft' | 'Pending' | 'Published' | 'Archived' | 'Rejected';
const TABS: { key: TabKey; label: string; status: CourseStatusFilter; countKey: keyof CourseStatusCounts }[] = [
  { key: 'All', label: 'All', status: 'All', countKey: 'all' },
  { key: 'Draft', label: 'Draft', status: 'Draft', countKey: 'draft' },
  { key: 'Pending', label: 'Pending Approval', status: 'Pending', countKey: 'pending' },
  { key: 'Published', label: 'Published', status: 'Published', countKey: 'published' },
  { key: 'Archived', label: 'Archived', status: 'Archived', countKey: 'archived' },
  { key: 'Rejected', label: 'Rejected', status: 'Rejected', countKey: 'rejected' },
];

// Mirrors the backend's SELF_ARCHIVABLE_STATUSES (instructorCourses.service.js)
// — a Published course cannot be archived from this page (admin-only,
// Unpublish first) — kept in sync manually since it's a UI-only convenience
// gate; the backend is the real enforcement point either way.
const SELF_ARCHIVABLE = new Set<CourseListRow['status']>(['Draft', 'Pending']);

type PageView = 'courses' | 'paths';

export default function InstructorCoursesPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<PageView>('courses');
  const [tab, setTab] = useState<TabKey>('All');
  const [search, setSearch] = useState('');
  const [courses, setCourses] = useState<CourseListRow[]>([]);
  const [counts, setCounts] = useState<CourseStatusCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    (() => setLoading(true))();
    const status = TABS.find((t) => t.key === tab)?.status ?? 'All';
    listMyCourses({ status, search: search || undefined })
      .then((res) => { setCourses(res.courses); setCounts(res.statusCounts); setError(null); })
      .catch((err: unknown) => setError(err instanceof CourseApiError ? err.message : 'Failed to load courses.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0); // debounce search only
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, search]);

  const handleSubmitForReview = async (course: CourseListRow) => {
    if (!confirm(`Submit "${course.title}" for admin review?`)) return;
    setBusyId(course.id);
    try {
      await submitMyCourse(course.id);
      load();
    } catch (err) {
      alert(err instanceof CourseApiError ? err.message : 'Submit failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleArchive = async (course: CourseListRow) => {
    if (!confirm(`Archive "${course.title}"? It will move to your Archived tab.`)) return;
    setBusyId(course.id);
    try {
      await archiveMyCourse(course.id);
      load();
    } catch (err) {
      alert(err instanceof CourseApiError ? err.message : 'Archive failed.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <InstructorLayout>
      <div className="mn-db-welcome">
        <div>
          <h1 className="mn-db-welcome-title">My Courses</h1>
          <p className="mn-db-welcome-sub">Author, submit, and manage the courses you teach</p>
        </div>
        {view === 'courses' && <button type="button" style={BTN_PRIMARY} onClick={() => setShowCreate(true)}>+ Create Course</button>}
      </div>

      {/* View toggle — Learning Paths is read-only visibility, not a course sub-tab */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button
          type="button"
          onClick={() => setView('courses')}
          style={view === 'courses' ? BTN_PRIMARY : BTN_SECONDARY}
        >
          My Courses
        </button>
        <button
          type="button"
          onClick={() => setView('paths')}
          style={view === 'paths' ? BTN_PRIMARY : BTN_SECONDARY}
        >
          Learning Paths
        </button>
      </div>

      {view === 'paths' ? (
        <LearningPathsSection />
      ) : (
      <>
      {error && <div style={{ ...ERROR_BANNER, marginBottom: 14 }}>{error}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              padding: '7px 14px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
              color: tab === t.key ? '#2563eb' : '#64748b',
              borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
            }}
          >
            {t.label}{counts ? ` (${counts[t.countKey]})` : ''}
          </button>
        ))}
      </div>

      <div className="mn-db-card">
        <div style={{ marginBottom: 10 }}>
          <input
            style={{ ...INPUT, maxWidth: 280 }}
            placeholder="Search by title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><div className="mn-spinner" /></div>
        ) : courses.length === 0 ? (
          <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>
            No courses in this tab yet.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={TH}>Title</th>
                <th style={TH}>Category</th>
                <th style={TH}>Students</th>
                <th style={TH}>Status</th>
                <th style={TH}>Updated</th>
                <th style={TH}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => {
                const busy = busyId === c.id;
                return (
                  <tr key={c.id} style={busy ? { opacity: 0.5 } : undefined}>
                    <td style={TD}>
                      {c.title}
                      {c.isRejected && c.rejectionReason && (
                        <div style={{ fontSize: 10, color: '#b91c1c', marginTop: 2 }} title={c.rejectionReason}>
                          Rejected: {c.rejectionReason.length > 60 ? `${c.rejectionReason.slice(0, 60)}…` : c.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td style={TD}>{c.category ?? '—'}</td>
                    <td style={TD}>{c.enrolledCount}</td>
                    <td style={TD}><span style={statusBadgeStyle(c.isRejected ? 'Rejected' : c.status)}>{c.isRejected ? 'REJECTED' : c.status.toUpperCase()}</span></td>
                    <td style={TD}>{new Date(c.updatedAt).toLocaleDateString()}</td>
                    <td style={TD}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button type="button" disabled={busy} style={disabledStyle(BTN_SECONDARY, busy)} onClick={() => navigate(`/instructor/courses/${c.id}/builder`)}>
                          Edit
                        </button>
                        {c.status === 'Draft' && (
                          <button type="button" disabled={busy} style={disabledStyle(BTN_PRIMARY, busy)} onClick={() => handleSubmitForReview(c)}>
                            Submit for Review
                          </button>
                        )}
                        {SELF_ARCHIVABLE.has(c.status) && (
                          <button type="button" disabled={busy} style={disabledStyle({ padding: '7px 14px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 7, cursor: 'pointer' }, busy)} onClick={() => handleArchive(c)}>
                            Archive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && <CreateCourseModal onClose={() => setShowCreate(false)} onCreated={(id) => navigate(`/instructor/courses/${id}/builder`)} />}
      </>
      )}
    </InstructorLayout>
  );
}

// ── Learning Paths (read-only visibility) ───────────────────────────────────────
// Not in the instructor blueprint — built per explicit task spec. Instructors
// don't create/edit paths (admin-only concept); this only shows which paths
// contain their own courses, and where.

function LearningPathsSection() {
  const [paths, setPaths] = useState<MyLearningPathRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openPathId, setOpenPathId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listMyLearningPaths()
      .then((rows) => { setPaths(rows); setError(null); })
      .catch((err: unknown) => setError(err instanceof InstructorLearningPathsApiError ? err.message : 'Failed to load learning paths.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
    <div className="mn-db-card">
      {error && <div style={{ ...ERROR_BANNER, marginBottom: 12 }}>{error}</div>}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><div className="mn-spinner" /></div>
      ) : paths.length === 0 ? (
        <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>
          None of your courses are in a learning path yet.
        </p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={TH}>Path Name</th>
              <th style={TH}>Total Items</th>
              <th style={TH}>Your Course(s)</th>
              <th style={TH}>Position</th>
              <th style={TH} />
            </tr>
          </thead>
          <tbody>
            {paths.map((p) => (
              <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => setOpenPathId(p.id)}>
                <td style={TD}>{p.title}</td>
                <td style={TD}>{p.itemCount}</td>
                <td style={TD}>{p.myCourses.map((c) => c.courseTitle ?? '—').join(', ')}</td>
                <td style={TD}>{p.myCourses.map((c) => `#${c.position}`).join(', ')}</td>
                <td style={TD}><button type="button" style={BTN_SECONDARY} onClick={() => setOpenPathId(p.id)}>View sequence</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>

    {/* Rendered as a sibling, NOT a child, of .mn-db-card — that card's entrance
        animation ends on `transform: translateY(0)` (fill-mode "both" keeps it
        applied forever), which makes the card a CSS containing block for any
        `position: fixed` descendant, trapping this modal inside the card's
        small box instead of the viewport. Same bug/fix as QuestionEditor in
        InstructorQuizStep.tsx and LessonModal in InstructorCourseBuilderPage.tsx. */}
    {openPathId && <LearningPathDetailModal pathId={openPathId} onClose={() => setOpenPathId(null)} />}
    </>
  );
}

function LearningPathDetailModal({ pathId, onClose }: { pathId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<MyLearningPathDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getMyLearningPath(pathId)
      .then((d) => { setDetail(d); setError(null); })
      .catch((err: unknown) => setError(err instanceof InstructorLearningPathsApiError ? err.message : 'Failed to load path.'))
      .finally(() => setLoading(false));
  }, [pathId]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />
      <div role="dialog" aria-label="Learning path sequence" style={{ position: 'relative', width: '100%', maxWidth: 520, maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>{detail?.title ?? 'Learning Path'}</h3>
          <button type="button" style={BTN_SECONDARY} onClick={onClose}>Close</button>
        </div>
        <div style={{ padding: '14px 18px', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><div className="mn-spinner" /></div>
          ) : error ? (
            <div style={ERROR_BANNER}>{error}</div>
          ) : detail ? (
            <>
              {detail.description && <p style={{ fontSize: 12, color: '#64748b', marginTop: 0 }}>{detail.description}</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {detail.items.map((it, idx) => (
                  <div
                    key={it.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                      border: it.isMine ? '2px solid #2563eb' : '1px solid #e5e7eb',
                      background: it.isMine ? '#eff6ff' : '#fff',
                      borderRadius: 8,
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', minWidth: 20 }}>{idx + 1}.</span>
                    <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: '#eef2ff', color: '#4338ca' }}>
                      {it.itemType === 'COURSE' ? 'COURSE' : it.itemType === 'LIVE_SESSION' ? 'LIVE SESSION' : 'QUIZ'}
                    </span>
                    <span style={{ flex: 1, fontSize: 13, color: it.missing ? '#94a3b8' : '#374151', fontStyle: it.missing ? 'italic' : 'normal' }}>
                      {it.missing ? 'Item no longer exists' : (it.title ?? '—')}
                    </span>
                    {it.isMine && <span style={{ fontSize: 10, fontWeight: 700, color: '#2563eb' }}>YOUR COURSE</span>}
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CreateCourseModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!title.trim()) { setErr('Title is required.'); return; }
    setSaving(true);
    setErr(null);
    try {
      const course = await createMyCourse({ title: title.trim(), category: category.trim() || undefined, description: description.trim() || undefined });
      onCreated(course.id);
    } catch (e) {
      setErr(e instanceof CourseApiError ? e.message : 'Failed to create course.');
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={!saving ? onClose : undefined} />
      <div role="dialog" aria-label="Create Course" style={{ position: 'relative', width: '100%', maxWidth: 420, background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Create Course</h3>
        </div>
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {err && <div style={ERROR_BANNER}>{err}</div>}
          <div>
            <label style={LABEL}>Title *</label>
            <input style={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoFocus />
          </div>
          <div>
            <label style={LABEL}>Category</label>
            <input style={INPUT} value={category} onChange={(e) => setCategory(e.target.value)} maxLength={100} />
          </div>
          <div>
            <label style={LABEL}>Description</label>
            <textarea style={{ ...INPUT, resize: 'vertical' }} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid #f1f5f9' }}>
          <button type="button" style={BTN_SECONDARY} onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" style={disabledStyle(BTN_PRIMARY, saving)} onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating…' : 'Create & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
