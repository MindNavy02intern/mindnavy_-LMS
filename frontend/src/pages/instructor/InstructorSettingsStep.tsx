// Instructor Settings step — Course Wizard step 4. Mirrors admin's
// CourseSettings.tsx (components/learningManagement/CourseSettings.tsx) for
// the fields that are safe for self-service: pricing, enrollment limit,
// visibility, certificate/drip toggles, SEO.
//
// KNOWN GAP (flagged, not silently dropped): admin's Settings step also has
// an Access Rules section (requiresEnrollment/startDate/endDate/
// allowedGroupIds/prerequisiteCourseIds) backed by groupsAPI.listGroups() and
// admin coursesApi.listCourses() — both are /api/admin/* endpoints an
// instructor has no access to (listing all org groups or every other
// instructor's course titles would leak cross-instructor data). No
// instructor-scoped equivalents exist yet, so Access Rules is out of scope
// for this pass; UpdateSettingsPayload.accessRules is simply never sent by
// this form, leaving whatever value the course already has untouched.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyCourse, updateMyCourseSettings } from '../../api/instructorCoursesApi';
import { CourseApiError, type CourseSettings, type CourseVisibility, type UpdateSettingsPayload } from '../../types/courses';
import { LABEL, INPUT, BTN_PRIMARY, BTN_SECONDARY, ERROR_BANNER, disabledStyle } from './instructorUiKit';

interface Props {
  courseId: string;
  onBack: () => void;
  onNext: () => void;
}

interface FormState {
  isFree: boolean;
  priceStr: string;
  currency: string;
  enrollmentLimitStr: string;
  visibility: CourseVisibility;
  certificateEnabled: boolean;
  dripContentEnabled: boolean;
  seoTitle: string;
  seoDescription: string;
}

function settingsToForm(s: CourseSettings): FormState {
  return {
    isFree: s.isFree,
    priceStr: s.price != null ? (s.price / 100).toFixed(2) : '',
    currency: s.currency ?? 'USD',
    enrollmentLimitStr: s.enrollmentLimit != null ? String(s.enrollmentLimit) : '',
    visibility: s.visibility,
    certificateEnabled: s.certificateEnabled,
    dripContentEnabled: s.dripContentEnabled,
    seoTitle: s.seoTitle ?? '',
    seoDescription: s.seoDescription ?? '',
  };
}

function buildPatch(form: FormState, orig: CourseSettings): UpdateSettingsPayload {
  const price = form.isFree ? null : (form.priceStr.trim() ? Math.round(parseFloat(form.priceStr) * 100) : null);
  const currency = form.isFree ? null : (form.currency.trim().toUpperCase() || null);
  const limitRaw = form.enrollmentLimitStr.trim() ? parseInt(form.enrollmentLimitStr, 10) : null;
  const enrollmentLimit = limitRaw != null && !isNaN(limitRaw) ? limitRaw : null;
  const seoTitle = form.seoTitle.trim() || null;
  const seoDescription = form.seoDescription.trim() || null;

  const p: UpdateSettingsPayload = {};
  if (form.isFree !== orig.isFree) p.isFree = form.isFree;
  if (price !== orig.price) p.price = price;
  if (!form.isFree && currency !== orig.currency) p.currency = currency;
  if (enrollmentLimit !== orig.enrollmentLimit) p.enrollmentLimit = enrollmentLimit;
  if (form.visibility !== orig.visibility) p.visibility = form.visibility;
  if (form.certificateEnabled !== orig.certificateEnabled) p.certificateEnabled = form.certificateEnabled;
  if (form.dripContentEnabled !== orig.dripContentEnabled) p.dripContentEnabled = form.dripContentEnabled;
  if (seoTitle !== orig.seoTitle) p.seoTitle = seoTitle;
  if (seoDescription !== orig.seoDescription) p.seoDescription = seoDescription;
  return p;
}

function clientValidate(form: FormState): string | null {
  if (!form.isFree) {
    const v = parseFloat(form.priceStr);
    if (!form.priceStr.trim() || isNaN(v) || v <= 0) return 'Price must be a positive number when the course is not free.';
  }
  if (form.seoTitle.length > 70) return 'SEO title must be ≤ 70 characters.';
  if (form.seoDescription.length > 200) return 'SEO description must be ≤ 200 characters.';
  return null;
}

export default function InstructorSettingsStep({ courseId, onBack, onNext }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const origSettings = useRef<CourseSettings | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setFetchError(null);
    getMyCourse(courseId)
      .then((c) => {
        origSettings.current = { ...c.settings };
        setForm(settingsToForm(c.settings));
      })
      .catch((err) => {
        if (err instanceof CourseApiError && err.status === 401) { navigate('/instructor/login'); return; }
        setFetchError(err instanceof Error ? err.message : 'Failed to load settings.');
      })
      .finally(() => setLoading(false));
  }, [courseId, navigate]);

  useEffect(load, [load]);

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: val } : f));
    setFieldError(null);
    setSavedMsg(null);
  }

  async function doSave(): Promise<boolean> {
    if (!form || !origSettings.current) return false;
    const vErr = clientValidate(form);
    if (vErr) { setFieldError(vErr); return false; }
    const patch = buildPatch(form, origSettings.current);
    if (Object.keys(patch).length === 0) return true;
    setSaving(true); setFieldError(null);
    try {
      await updateMyCourseSettings(courseId, patch);
      origSettings.current = { ...origSettings.current, ...patch } as CourseSettings;
      return true;
    } catch (err) {
      if (err instanceof CourseApiError && err.status === 401) { navigate('/instructor/login'); return false; }
      setFieldError(err instanceof Error ? err.message : 'Failed to save settings.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    const ok = await doSave();
    if (ok) setSavedMsg('Settings saved.');
  }

  async function handleNext() {
    const ok = await doSave();
    if (ok) onNext();
  }

  if (loading || !form) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="mn-spinner" /></div>;
  }
  if (fetchError) {
    return (
      <div style={ERROR_BANNER}>
        {fetchError}{' '}
        <button type="button" onClick={load} style={{ background: 'none', border: 'none', color: '#b91c1c', textDecoration: 'underline', cursor: 'pointer', fontSize: 12 }}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      <div className="mn-db-card">
        <div className="mn-db-card-header"><div className="mn-db-card-title">Settings</div></div>
        {fieldError && <div style={{ ...ERROR_BANNER, marginBottom: 12 }}>{fieldError}</div>}

        {/* Pricing */}
        <div style={{ marginBottom: 16 }}>
          <label style={LABEL}>Pricing</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: form.isFree ? 0 : 8 }}>
            <button type="button" style={form.isFree ? BTN_PRIMARY : BTN_SECONDARY} onClick={() => { setField('isFree', true); setField('priceStr', ''); }}>Free</button>
            <button type="button" style={!form.isFree ? BTN_PRIMARY : BTN_SECONDARY} onClick={() => setField('isFree', false)}>Paid</button>
          </div>
          {!form.isFree && (
            <div style={{ display: 'flex', gap: 10 }}>
              <div>
                <label style={LABEL}>Price ($) *</label>
                <input style={{ ...INPUT, maxWidth: 140 }} type="number" min="0.01" step="0.01" value={form.priceStr} onChange={(e) => setField('priceStr', e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label style={LABEL}>Currency</label>
                <input style={{ ...INPUT, maxWidth: 100 }} maxLength={3} value={form.currency} onChange={(e) => setField('currency', e.target.value.toUpperCase())} placeholder="USD" />
              </div>
            </div>
          )}
        </div>

        {/* Enrollment + Visibility */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={LABEL}>Enrollment Limit <span style={{ color: '#94a3b8', fontWeight: 400 }}>(blank = unlimited)</span></label>
            <input style={INPUT} type="number" min="1" step="1" value={form.enrollmentLimitStr} onChange={(e) => setField('enrollmentLimitStr', e.target.value)} placeholder="Unlimited" />
          </div>
          <div>
            <label style={LABEL}>Visibility</label>
            <select style={INPUT} value={form.visibility} onChange={(e) => setField('visibility', e.target.value as CourseVisibility)}>
              <option value="Public">Public</option>
              <option value="Private">Private</option>
              <option value="Unlisted">Unlisted</option>
            </select>
          </div>
        </div>

        {/* Features */}
        <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={LABEL}>Features</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#374151' }}>
            <input type="checkbox" checked={form.certificateEnabled} onChange={(e) => setField('certificateEnabled', e.target.checked)} />
            Issue completion certificates
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#374151' }}>
            <input type="checkbox" checked={form.dripContentEnabled} onChange={(e) => setField('dripContentEnabled', e.target.checked)} />
            Enable drip content (release lessons sequentially)
          </label>
        </div>

        {/* SEO */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={LABEL}>SEO Title <span style={{ color: '#94a3b8', fontWeight: 400 }}>({form.seoTitle.length}/70)</span></label>
            <input style={INPUT} maxLength={70} value={form.seoTitle} onChange={(e) => setField('seoTitle', e.target.value)} />
          </div>
          <div>
            <label style={LABEL}>SEO Description <span style={{ color: '#94a3b8', fontWeight: 400 }}>({form.seoDescription.length}/200)</span></label>
            <input style={INPUT} maxLength={200} value={form.seoDescription} onChange={(e) => setField('seoDescription', e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" style={disabledStyle(BTN_SECONDARY, saving)} disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
          {savedMsg && <span style={{ fontSize: 12, color: '#15803d' }}>{savedMsg}</span>}
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" style={BTN_SECONDARY} onClick={onBack}>← Back: Quiz</button>
        <button type="button" style={disabledStyle(BTN_PRIMARY, saving)} disabled={saving} onClick={handleNext}>
          {saving ? 'Saving…' : 'Next: Preview →'}
        </button>
      </div>
    </div>
  );
}
