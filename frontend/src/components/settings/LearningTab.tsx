// Learning tab (?tab=learning).

import { useCallback, useState } from 'react';
import { updateSystemSettings } from '../../services/settingsApi';
import { SettingsApiError, COURSE_VISIBILITIES, type CourseVisibility } from '../../types/settings';
import type { SystemSettings } from '../../types/settings';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { Card, FormGrid, Field, FULL_INPUT, SaveBar, ToggleRow, ComingSoonBadge, useSaveAllListener } from './_shared';

const VISIBILITY_LABEL: Record<CourseVisibility, string> = { PUBLIC: 'Public', PRIVATE: 'Private', ENROLLED_ONLY: 'Enrolled Only' };

interface Props {
  settings: SystemSettings;
  onSaved: (s: SystemSettings) => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export default function LearningTab({ settings, onSaved, showToast }: Props) {
  const [defaultCourseVisibility, setDefaultCourseVisibility] = useState<CourseVisibility>(settings.defaultCourseVisibility);
  const [autoEnrollmentEnabled, setAutoEnrollmentEnabled] = useState(settings.autoEnrollmentEnabled);
  const [certificatesEnabled, setCertificatesEnabled] = useState(settings.certificatesEnabled);
  const [quizPassingScore, setQuizPassingScore] = useState(String(settings.quizPassingScore));
  const [maxQuizAttempts, setMaxQuizAttempts] = useState(String(settings.maxQuizAttempts));
  const [progressTrackingEnabled, setProgressTrackingEnabled] = useState(settings.progressTrackingEnabled);
  const [submitting, setSubmitting] = useState(false);

  const handleSave = useCallback(async () => {
    setSubmitting(true);
    try {
      const updated = await updateSystemSettings({
        defaultCourseVisibility, autoEnrollmentEnabled, certificatesEnabled,
        quizPassingScore: Number(quizPassingScore) || 0,
        maxQuizAttempts: Number(maxQuizAttempts) || 1,
        progressTrackingEnabled,
      });
      invalidateFor(appQueryClient, 'settings.update', { domain: 'learning' });
      onSaved(updated);
      showToast('success', 'Learning settings saved.');
    } catch (err) {
      showToast('error', err instanceof SettingsApiError ? err.message : 'Failed to save learning settings.');
    } finally {
      setSubmitting(false);
    }
  }, [defaultCourseVisibility, autoEnrollmentEnabled, certificatesEnabled, quizPassingScore, maxQuizAttempts, progressTrackingEnabled, onSaved, showToast]);

  useSaveAllListener(handleSave);

  return (
    <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
      <Card title="Course Defaults">
        <FormGrid>
          <Field label="Default Course Visibility">
            <select style={FULL_INPUT} value={defaultCourseVisibility} onChange={e => setDefaultCourseVisibility(e.target.value as CourseVisibility)}>
              {COURSE_VISIBILITIES.map(v => <option key={v} value={v}>{VISIBILITY_LABEL[v]}</option>)}
            </select>
          </Field>
        </FormGrid>
      </Card>

      <Card title="Enrollment & Progress">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ToggleRow label="Auto Enrollment" description="Automatically enroll learners in assigned learning paths." checked={autoEnrollmentEnabled} onChange={setAutoEnrollmentEnabled} />
          <ToggleRow label="Certificates Enabled" description="Award certificates on course completion." checked={certificatesEnabled} onChange={setCertificatesEnabled} />
          <ToggleRow label="Progress Tracking" description="Track per-lesson learner progress." checked={progressTrackingEnabled} onChange={setProgressTrackingEnabled} />
          <ToggleRow label={<>SCORM Compatibility <ComingSoonBadge /></>} description="Import/track SCORM packages." checked={false} onChange={() => {}} disabled disabledHint="Coming soon" />
        </div>
      </Card>

      <Card title="Assessment Rules">
        <FormGrid>
          <Field label="Quiz Passing Score (%)">
            <input style={FULL_INPUT} type="number" min={0} max={100} value={quizPassingScore} onChange={e => setQuizPassingScore(e.target.value)} />
          </Field>
          <Field label="Max Quiz Attempts">
            <input style={FULL_INPUT} type="number" min={1} max={20} value={maxQuizAttempts} onChange={e => setMaxQuizAttempts(e.target.value)} />
          </Field>
        </FormGrid>
      </Card>

      <SaveBar submitting={submitting} label="Save Learning Settings" savedAt={settings.updatedAt} />
    </form>
  );
}
