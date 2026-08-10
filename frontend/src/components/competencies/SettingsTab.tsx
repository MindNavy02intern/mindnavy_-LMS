// Settings tab — CompetencySettings, single row per organization (was a
// "coming soon" stub). Mirrors the Organization module's Hierarchy Settings
// screen (GET on mount, PATCH on Save, one row, lazily created server-side).

import { useEffect, useState } from 'react';
import { getCompetencySettings, updateCompetencySettings } from '../../services/competenciesApi';
import { CompetenciesApiError, ASSESSMENT_TYPES } from '../../types/competencies';
import type { AssessmentType, CompetencySettings } from '../../types/competencies';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
}

const CARD: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '18px 20px' };
const SECTION_TITLE: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 };
const SECTION_HELP: React.CSSProperties = { fontSize: 12, color: '#6b7280', marginBottom: 14 };
const LABEL: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };
const INPUT: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 6, color: '#374151', background: '#fff',
};

type FormState = Omit<CompetencySettings, 'id' | 'createdAt' | 'updatedAt'>;

function ToggleRow({ label, help, checked, onChange }: { label: string; help: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ marginTop: 2, width: 15, height: 15, accentColor: '#2563eb', cursor: 'pointer' }} />
      <span>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{help}</div>
      </span>
    </label>
  );
}

export default function SettingsTab({ showToast }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCompetencySettings()
      .then(s => { if (!cancelled) setForm(s); })
      .catch(err => { if (!cancelled) setError(err instanceof CompetenciesApiError ? err.message : 'Failed to load settings.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => (f ? { ...f, [key]: value } : f));
  }

  const severityValid = !form || (form.gapSeverityCritical > form.gapSeverityHigh && form.gapSeverityHigh > form.gapSeverityMedium);

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateCompetencySettings(form);
      setForm(updated);
      invalidateFor(appQueryClient, 'competencySettings.update');
      showToast('success', 'Settings saved.');
    } catch (err) {
      const msg = err instanceof CompetenciesApiError ? err.message : 'Failed to save settings.';
      setError(msg);
      showToast('error', msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ ...CARD, color: '#9ca3af', fontSize: 13 }}>Loading settings…</div>;
  }
  if (!form) {
    return <div style={{ ...CARD, color: '#b91c1c', fontSize: 13 }}>{error ?? 'Could not load settings.'}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#b91c1c' }}>{error}</div>
      )}

      <div style={CARD}>
        <div style={SECTION_TITLE}>Assessment Passing Threshold</div>
        <div style={SECTION_HELP}>Minimum score percentage for an assessment to count as "passed".</div>
        <div style={{ maxWidth: 160 }}>
          <label style={LABEL} htmlFor="settings-passing-threshold">Passing threshold (%)</label>
          <input
            id="settings-passing-threshold"
            type="number" min={1} max={100} style={INPUT}
            value={form.passingThresholdPercent}
            onChange={e => set('passingThresholdPercent', Number(e.target.value))}
          />
        </div>
      </div>

      <div style={CARD}>
        <div style={SECTION_TITLE}>Skill Gap Severity Thresholds</div>
        <div style={SECTION_HELP}>
          Minimum level-gap size (1–4) mapped to each severity label. Below "Medium" is always labeled Low.
          Must be strictly descending: Critical &gt; High &gt; Medium.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 420 }}>
          <div>
            <label style={LABEL} htmlFor="settings-gap-critical">Critical ≥</label>
            <input id="settings-gap-critical" type="number" min={1} max={4} style={INPUT} value={form.gapSeverityCritical} onChange={e => set('gapSeverityCritical', Number(e.target.value))} />
          </div>
          <div>
            <label style={LABEL} htmlFor="settings-gap-high">High ≥</label>
            <input id="settings-gap-high" type="number" min={1} max={4} style={INPUT} value={form.gapSeverityHigh} onChange={e => set('gapSeverityHigh', Number(e.target.value))} />
          </div>
          <div>
            <label style={LABEL} htmlFor="settings-gap-medium">Medium ≥</label>
            <input id="settings-gap-medium" type="number" min={1} max={4} style={INPUT} value={form.gapSeverityMedium} onChange={e => set('gapSeverityMedium', Number(e.target.value))} />
          </div>
        </div>
        {!severityValid && (
          <div style={{ fontSize: 11, color: '#dc2626', marginTop: 8 }}>Thresholds must be strictly descending: Critical &gt; High &gt; Medium.</div>
        )}
      </div>

      <div style={CARD}>
        <div style={SECTION_TITLE}>Assessment Behavior</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
          <ToggleRow
            label="Auto-update skill level after assessment"
            help="When on, recording an assessment immediately updates the user's tracked proficiency level. When off, only the assessment attempt is recorded."
            checked={form.autoUpdateLevelOnAssess}
            onChange={v => set('autoUpdateLevelOnAssess', v)}
          />
          <div style={{ maxWidth: 220 }}>
            <label style={LABEL} htmlFor="settings-default-type">Default assessment type</label>
            <select id="settings-default-type" style={INPUT} value={form.defaultAssessmentType} onChange={e => set('defaultAssessmentType', e.target.value as AssessmentType)}>
              {ASSESSMENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !severityValid}
          style={{
            padding: '9px 20px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            background: (saving || !severityValid) ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
            cursor: (saving || !severityValid) ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
