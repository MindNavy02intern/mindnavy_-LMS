// Assessments tab — GET /api/admin/competencies/assessments.

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { listAssessments } from '../../services/competenciesApi';
import { ASSESSMENT_TYPES, CompetenciesApiError } from '../../types/competencies';
import type { Assessment, AssessmentType } from '../../types/competencies';
import RecordAssessmentModal from './RecordAssessmentModal';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
  refreshSignal: number;
}

const SELECT: React.CSSProperties = {
  padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  border: '1px solid #d1d5db', borderRadius: 6, color: '#374151', background: '#fff',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AssessmentsTab({ showToast, refreshSignal }: Props) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<AssessmentType | ''>('');
  const [passed, setPassed] = useState<'' | 'true' | 'false'>('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchList = useCallback(() => {
    setLoading(true);
    setError(null);
    listAssessments({
      page, limit: 10,
      type: type || undefined,
      passed: passed === '' ? undefined : passed === 'true',
    })
      .then(res => { setAssessments(res.assessments); setPagination(res.pagination); })
      .catch(err => setError(err instanceof CompetenciesApiError ? err.message : 'Failed to load assessments.'))
      .finally(() => setLoading(false));
  }, [page, type, passed]);

  useEffect(() => { fetchList(); }, [fetchList, refreshSignal]);
  useEffect(() => { setPage(1); }, [type, passed]);
  useEffect(() => {
    window.addEventListener('analyticsUpdated', fetchList);
    return () => window.removeEventListener('analyticsUpdated', fetchList);
  }, [fetchList]);

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 16, borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
        <select style={SELECT} value={type} onChange={e => setType(e.target.value as AssessmentType | '')}>
          <option value="">All types</option>
          {ASSESSMENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <select style={SELECT} value={passed} onChange={e => setPassed(e.target.value as '' | 'true' | 'false')}>
          <option value="">Passed &amp; Failed</option>
          <option value="true">Passed only</option>
          <option value="false">Failed only</option>
        </select>
        <button
          type="button" onClick={() => setCreateOpen(true)}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          <Plus size={15} strokeWidth={2.5} /> New Assessment
        </button>
      </div>

      {error && <div style={{ margin: 16, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#b91c1c' }}>{error}</div>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              {['User', 'Skill', 'Type', 'Score', 'Passed', 'Date'].map(h => (
                <th key={h} style={{ textAlign: h === 'User' || h === 'Skill' ? 'left' : 'center', padding: '10px 12px', color: '#94a3b8', fontWeight: 600, fontSize: 11.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Loading…</td></tr>
            ) : assessments.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No assessments recorded yet.</td></tr>
            ) : assessments.map(a => (
              <tr key={a.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>{a.userName ?? '—'}</td>
                <td style={{ padding: '10px 12px', color: '#374151' }}>{a.skillName ?? '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>{a.type.replace(/_/g, ' ')}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', color: '#0f172a' }}>{a.score}/{a.maxScore}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: a.passed ? '#dcfce7' : '#fee2e2', color: a.passed ? '#15803d' : '#b91c1c' }}>{a.passed ? 'Passed' : 'Failed'}</span>
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b', fontSize: 12 }}>{formatDate(a.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination.pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 14, borderTop: '1px solid #f1f5f9' }}>
          <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>Prev</button>
          <span style={{ fontSize: 12, color: '#64748b' }}>Page {pagination.page} of {pagination.pages}</span>
          <button type="button" disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: page >= pagination.pages ? 'default' : 'pointer', opacity: page >= pagination.pages ? 0.5 : 1 }}>Next</button>
        </div>
      )}

      {createOpen && (
        <RecordAssessmentModal
          onClose={() => setCreateOpen(false)}
          onSuccess={() => { setCreateOpen(false); fetchList(); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}
