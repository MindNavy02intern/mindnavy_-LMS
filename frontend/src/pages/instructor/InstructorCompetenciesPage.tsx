import { useEffect, useState } from 'react';
import InstructorLayout from './InstructorLayout';
import { ERROR_BANNER, TH, TD } from './instructorUiKit';
import { getMySkillsInCourses, getMyCompetencyCertifications, InstructorCompetenciesApiError } from '../../api/instructorCompetenciesApi';
import type { MySkillRow, MyCompetencyCertification, CompetencyCertStatus } from '../../types/instructorCompetencies';

// Two distinct sub-tabs (blueprint 2.8): skills linked to the courses this
// instructor teaches, and CompetencyCertification rows they personally hold.
// Both read-only — skill<->course mapping and certification issuance stay
// admin-only actions.

type Tab = 'skills' | 'certifications';

const CERT_STATUS_COLOR: Record<CompetencyCertStatus, { bg: string; fg: string }> = {
  VERIFIED: { bg: '#dcfce7', fg: '#15803d' },
  PENDING:  { bg: '#fef9c3', fg: '#a16207' },
  REJECTED: { bg: '#fee2e2', fg: '#b91c1c' },
  EXPIRED:  { bg: '#f1f5f9', fg: '#64748b' },
};

export default function InstructorCompetenciesPage() {
  const [tab, setTab] = useState<Tab>('skills');
  const [skills, setSkills] = useState<MySkillRow[]>([]);
  const [certs, setCerts] = useState<MyCompetencyCertification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const load = tab === 'skills'
      ? getMySkillsInCourses().then(setSkills)
      : getMyCompetencyCertifications().then(setCerts);
    load
      .catch((err: unknown) => setError(err instanceof InstructorCompetenciesApiError ? err.message : 'Failed to load.'))
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <InstructorLayout>
      <div className="mn-db-welcome">
        <div>
          <h1 className="mn-db-welcome-title">My Competencies</h1>
          <p className="mn-db-welcome-sub">Skills taught in your courses and your own competency certifications</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid #e2e8f0' }}>
        {([
          { key: 'skills' as Tab, label: 'Skills in My Courses' },
          { key: 'certifications' as Tab, label: 'My Certifications' },
        ]).map((t) => (
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
            {t.label}
          </button>
        ))}
      </div>

      {error && <div style={{ ...ERROR_BANNER, marginBottom: 14 }}>{error}</div>}

      <div className="mn-db-card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><div className="mn-spinner" /></div>
        ) : tab === 'skills' ? (
          skills.length === 0 ? (
            <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>
              None of your courses have skills mapped to them yet.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={TH}>Skill</th>
                  <th style={TH}>Level</th>
                  <th style={TH}>Course</th>
                  <th style={TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {skills.map((s) => (
                  <tr key={s.mappingId}>
                    <td style={TD}>
                      <div style={{ fontWeight: 600 }}>{s.skillName}</div>
                      {s.description && <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.description}</div>}
                    </td>
                    <td style={TD}>{s.level}</td>
                    <td style={TD}>{s.courseTitle ?? '—'}</td>
                    <td style={TD}>{s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : certs.length === 0 ? (
          <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>
            You have no competency certifications yet.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={TH}>Skill</th>
                <th style={TH}>Framework</th>
                <th style={TH}>Status</th>
                <th style={TH}>Issued</th>
                <th style={TH}>Expires</th>
              </tr>
            </thead>
            <tbody>
              {certs.map((c) => (
                <tr key={c.id}>
                  <td style={TD}>{c.skillName ?? '—'}</td>
                  <td style={TD}>{c.frameworkName ?? '—'}</td>
                  <td style={TD}>
                    <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: CERT_STATUS_COLOR[c.effectiveStatus].bg, color: CERT_STATUS_COLOR[c.effectiveStatus].fg }}>
                      {c.effectiveStatus}
                    </span>
                  </td>
                  <td style={TD}>{new Date(c.issuedAt).toLocaleDateString()}</td>
                  <td style={TD}>{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </InstructorLayout>
  );
}
