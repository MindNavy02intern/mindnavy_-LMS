// Course Settings — Step 4 of the Course Wizard.
// Prefills from GET /courses/:id.settings. PATCHes only changed fields.
// Cross-field rule: isFree:false requires positive price.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { getCourse, listCourses } from '../../services/coursesApi';
import { updateSettings } from '../../services/courseWizardApi';
import { groupsAPI } from '../../api/groups';
import { CourseApiError } from '../../types/courses';
import type {
  AccessRules,
  CourseListRow,
  CourseSettings,
  CourseVisibility,
  UpdateSettingsPayload,
} from '../../types/courses';
import type { Group } from '../../types/groups';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  courseId: string;
  onBack:   () => void;
  onNext:   () => void;
}

interface FormState {
  isFree:             boolean;
  priceStr:           string;          // decimal dollars, e.g. "19.99"
  currency:           string;          // 3-letter ISO
  enrollmentLimitStr: string;
  visibility:         CourseVisibility;
  certificateEnabled: boolean;
  dripContentEnabled: boolean;
  requiresEnrollment: boolean;
  startDate:          string;
  endDate:            string;
  allowedGroupIds:    string[];        // UUIDs from group multi-select, max 50
  prereqCourseIds:    string[];        // UUIDs from course multi-select, max 50
  seoTitle:           string;          // max 70
  seoDescription:     string;          // max 200
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function settingsToForm(s: CourseSettings): FormState {
  return {
    isFree:             s.isFree,
    priceStr:           s.price != null ? (s.price / 100).toFixed(2) : '',
    currency:           s.currency ?? 'USD',
    enrollmentLimitStr: s.enrollmentLimit != null ? String(s.enrollmentLimit) : '',
    visibility:         s.visibility,
    certificateEnabled: s.certificateEnabled,
    dripContentEnabled: s.dripContentEnabled,
    requiresEnrollment: s.accessRules?.requiresEnrollment ?? false,
    startDate:          s.accessRules?.startDate ?? '',
    endDate:            s.accessRules?.endDate ?? '',
    allowedGroupIds:    s.accessRules?.allowedGroupIds ?? [],
    prereqCourseIds:    s.accessRules?.prerequisiteCourseIds ?? [],
    seoTitle:           s.seoTitle ?? '',
    seoDescription:     s.seoDescription ?? '',
  };
}

function formToEffective(f: FormState) {
  const price = f.isFree
    ? null
    : (f.priceStr.trim() ? Math.round(parseFloat(f.priceStr) * 100) : null);
  const currency = f.isFree ? null : (f.currency.trim().toUpperCase() || null);
  const limitRaw = f.enrollmentLimitStr.trim() ? parseInt(f.enrollmentLimitStr, 10) : null;
  const enrollmentLimit = limitRaw != null && !isNaN(limitRaw) ? limitRaw : null;

  const allowedGroupIds = f.allowedGroupIds;
  const prereqCourseIds = f.prereqCourseIds;
  const hasRules =
    f.requiresEnrollment ||
    !!f.startDate ||
    !!f.endDate ||
    allowedGroupIds.length > 0 ||
    prereqCourseIds.length > 0;

  const accessRules: AccessRules | null = hasRules
    ? {
        ...(f.requiresEnrollment          ? { requiresEnrollment: true }                    : {}),
        ...(f.startDate                    ? { startDate: f.startDate }                      : {}),
        ...(f.endDate                      ? { endDate: f.endDate }                          : {}),
        ...(allowedGroupIds.length > 0     ? { allowedGroupIds }                             : {}),
        ...(prereqCourseIds.length > 0     ? { prerequisiteCourseIds: prereqCourseIds }      : {}),
      }
    : null;

  return {
    isFree:             f.isFree,
    price,
    currency,
    enrollmentLimit,
    visibility:         f.visibility,
    certificateEnabled: f.certificateEnabled,
    dripContentEnabled: f.dripContentEnabled,
    accessRules,
    seoTitle:           f.seoTitle.trim() || null,
    seoDescription:     f.seoDescription.trim() || null,
  };
}

function buildPatch(form: FormState, orig: CourseSettings): UpdateSettingsPayload {
  const eff = formToEffective(form);
  const p: UpdateSettingsPayload = {};
  if (eff.isFree             !== orig.isFree)             p.isFree             = eff.isFree;
  if (eff.price              !== orig.price)              p.price              = eff.price;
  // Currency is moot while free — skip it entirely rather than compare.
  // Course.currency defaults to "USD" in the DB (schema) even though isFree
  // defaults true, but formToEffective always nulls currency when isFree, so
  // an untouched free course's eff.currency (null) would otherwise always
  // mismatch its own fetched orig.currency ("USD") and fire a spurious PATCH.
  if (!eff.isFree && eff.currency !== orig.currency)      p.currency           = eff.currency;
  if (eff.enrollmentLimit    !== orig.enrollmentLimit)    p.enrollmentLimit    = eff.enrollmentLimit;
  if (eff.visibility         !== orig.visibility)         p.visibility         = eff.visibility;
  if (eff.certificateEnabled !== orig.certificateEnabled) p.certificateEnabled = eff.certificateEnabled;
  if (eff.dripContentEnabled !== orig.dripContentEnabled) p.dripContentEnabled = eff.dripContentEnabled;
  if (JSON.stringify(eff.accessRules) !== JSON.stringify(orig.accessRules)) {
    p.accessRules = eff.accessRules;
  }
  if (eff.seoTitle           !== orig.seoTitle)           p.seoTitle           = eff.seoTitle;
  if (eff.seoDescription     !== orig.seoDescription)     p.seoDescription     = eff.seoDescription;
  return p;
}

function clientValidate(form: FormState): string | null {
  if (!form.isFree) {
    const v = parseFloat(form.priceStr);
    if (!form.priceStr.trim() || isNaN(v) || v <= 0) {
      return 'Price must be a positive number when the course is not free.';
    }
  }
  if (form.seoTitle.length > 70)        return 'SEO title must be ≤ 70 characters.';
  if (form.seoDescription.length > 200) return 'SEO description must be ≤ 200 characters.';
  if (form.allowedGroupIds.length > 50)  return 'Allowed groups: max 50 entries.';
  if (form.prereqCourseIds.length > 50)  return 'Prerequisite courses: max 50 entries.';
  return null;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ToastBanner({ message }: { message: string }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9000,
      background: '#16a34a', color: '#fff', padding: '10px 18px', borderRadius: 8,
      fontSize: 13, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
    }}>
      {message}
    </div>
  );
}

function Toggle({
  checked, onChange, label,
}: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="tw:flex tw:cursor-pointer tw:items-center tw:gap-2.5">
      <div
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={
          'tw:relative tw:h-5 tw:w-9 tw:flex-shrink-0 tw:rounded-full tw:cursor-pointer tw:transition-colors' +
          (checked ? ' tw:bg-blue-600' : ' tw:bg-slate-300')
        }
      >
        <span className={
          'tw:absolute tw:top-0.5 tw:h-4 tw:w-4 tw:rounded-full tw:bg-white tw:shadow tw:transition-all' +
          (checked ? ' tw:left-[18px]' : ' tw:left-0.5')
        } />
      </div>
      <span className="tw:text-[13px] tw:text-slate-700">{label}</span>
    </label>
  );
}

// ── MultiSelectPicker ─────────────────────────────────────────────────────────
// Scrollable checkbox list with search. Selected IDs stored as string[].

interface PickerItem { id: string; label: string }

function MultiSelectPicker({
  ariaLabel, items, selected, onChange, max = 50, loading,
}: {
  ariaLabel:  string;
  items:      PickerItem[];
  selected:   string[];
  onChange:   (ids: string[]) => void;
  max?:       number;
  loading?:   boolean;
}) {
  const [search, setSearch] = useState('');
  const filtered = search.trim()
    ? items.filter(i => i.label.toLowerCase().includes(search.toLowerCase()))
    : items;

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id));
    } else if (selected.length < max) {
      onChange([...selected, id]);
    }
  }

  return (
    <div className="tw:rounded-lg tw:border tw:border-slate-200 tw:overflow-hidden">
      {/* Search */}
      <div className="tw:border-b tw:border-slate-100 tw:px-3 tw:py-1.5 tw:flex tw:items-center tw:gap-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search…"
          aria-label={`Search ${ariaLabel}`}
          className="tw:flex-1 tw:bg-transparent tw:text-[12px] tw:text-slate-700 tw:outline-none"
        />
        <span className="tw:flex-shrink-0 tw:text-[11px] tw:text-slate-400">
          {selected.length}/{max}
        </span>
      </div>

      {/* List */}
      <div className="tw:max-h-40 tw:overflow-y-auto">
        {loading ? (
          <div className="tw:px-3 tw:py-3 tw:text-[12px] tw:text-slate-400">Loading…</div>
        ) : items.length === 0 ? (
          <div className="tw:px-3 tw:py-3 tw:text-[12px] tw:text-slate-400">No items available.</div>
        ) : filtered.length === 0 ? (
          <div className="tw:px-3 tw:py-2 tw:text-[12px] tw:text-slate-400">No matches.</div>
        ) : (
          filtered.map(item => {
            const checked = selected.includes(item.id);
            const atMax   = !checked && selected.length >= max;
            return (
              <label
                key={item.id}
                className={
                  'tw:flex tw:items-center tw:gap-2.5 tw:px-3 tw:py-1.5 tw:cursor-pointer tw:select-none' +
                  (atMax ? ' tw:opacity-40 tw:cursor-not-allowed' : ' tw:hover:bg-slate-50')
                }
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={atMax}
                  onChange={() => toggle(item.id)}
                  aria-label={item.label}
                  className="tw:h-3.5 tw:w-3.5 tw:rounded tw:accent-blue-600"
                />
                <span className="tw:text-[12px] tw:text-slate-800 tw:truncate">{item.label}</span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CourseSettings({ courseId, onBack, onNext }: Props) {
  const navigate = useNavigate();

  const [loading,       setLoading]       = useState(true);
  const [fetchError,    setFetchError]    = useState<string | null>(null);
  const [form,          setForm]          = useState<FormState | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [fieldError,    setFieldError]    = useState<string | null>(null);
  const [toastMsg,      setToastMsg]      = useState<string | null>(null);
  const [groups,        setGroups]        = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [availCourses,  setAvailCourses]  = useState<CourseListRow[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);

  const origSettings = useRef<CourseSettings | null>(null);
  const toastTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped on every load() call so a stale in-flight fetch (StrictMode's
  // double-invoked mount effect, or a fast courseId change) can't clobber
  // form state — and any in-progress user edits — after a newer load has
  // already started.
  const loadSeq = useRef(0);

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3500);
  }

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setFetchError(null);
    try {
      const course = await getCourse(courseId);
      if (loadSeq.current !== seq) return; // superseded by a newer load — discard
      origSettings.current = { ...course.settings };
      setForm(settingsToForm(course.settings));
    } catch (err) {
      if (loadSeq.current !== seq) return;
      if (err instanceof CourseApiError && err.status === 401) { navigate('/login'); return; }
      setFetchError(err instanceof Error ? err.message : 'Failed to load settings.');
    } finally {
      if (loadSeq.current === seq) setLoading(false);
    }
  }, [courseId, navigate]);

  useEffect(() => { load(); }, [load]);

  // Load groups for the allowedGroupIds multi-select.
  useEffect(() => {
    setGroupsLoading(true);
    groupsAPI.listGroups({ limit: 100 })
      .then(res => setGroups(res.data))
      .catch(() => { /* non-fatal — multi-select shows empty */ })
      .finally(() => setGroupsLoading(false));
  }, []);

  // Load courses for the prerequisiteCourseIds multi-select (exclude current course).
  useEffect(() => {
    setCoursesLoading(true);
    listCourses({ limit: 100 })
      .then(res => setAvailCourses(res.courses.filter(c => c.id !== courseId)))
      .catch(() => { /* non-fatal */ })
      .finally(() => setCoursesLoading(false));
  }, [courseId]);

  // ── Field setter ──────────────────────────────────────────────────────────

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm(f => f ? { ...f, [key]: val } : f);
    setFieldError(null);
  }

  // ── Save (shared by "Save Settings" and "Next: Preview") ─────────────────

  async function doSave(): Promise<boolean> {
    if (!form || !origSettings.current) return false;

    const vErr = clientValidate(form);
    if (vErr) { setFieldError(vErr); return false; }

    const patch = buildPatch(form, origSettings.current);
    if (Object.keys(patch).length === 0) return true;   // nothing changed

    setSaving(true);
    setFieldError(null);
    try {
      await updateSettings(courseId, patch);
      origSettings.current = { ...origSettings.current, ...patch } as CourseSettings;
      return true;
    } catch (err) {
      if (err instanceof CourseApiError && err.status === 401) { navigate('/login'); return false; }
      if (err instanceof CourseApiError && err.status === 429) {
        showToast('Too many requests — please slow down.');
        return false;
      }
      setFieldError(err instanceof Error ? err.message : 'Failed to save settings.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    const ok = await doSave();
    if (ok) showToast('Settings saved.');
  }

  async function handleNext() {
    const ok = await doSave();
    if (ok) onNext();
  }

  // ── Render: loading / error ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="tw:flex tw:flex-col tw:gap-4">
        <div className="tw:flex tw:items-center tw:gap-3">
          <div className="tw:h-5 tw:w-16 tw:animate-pulse tw:rounded tw:bg-slate-100" />
          <div className="tw:h-6 tw:w-48 tw:animate-pulse tw:rounded tw:bg-slate-100" />
        </div>
        <div className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-6 tw:flex tw:flex-col tw:gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="tw:h-10 tw:w-full tw:animate-pulse tw:rounded tw:bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="tw:flex tw:flex-col tw:gap-4">
        <div className="tw:rounded-xl tw:border tw:border-red-100 tw:bg-red-50 tw:p-5 tw:text-center">
          <p className="tw:text-[13px] tw:text-red-500">{fetchError}</p>
          <button type="button" onClick={load}
            className="tw:mt-2 tw:text-[13px] tw:font-medium tw:text-blue-600 tw:hover:text-blue-700">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!form) return null;

  const inputCls =
    'tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 ' +
    'tw:outline-none focus:tw:border-blue-400 focus:tw:ring-2 focus:tw:ring-blue-100';

  const pricingToggleBase =
    'tw:rounded-lg tw:border tw:px-4 tw:py-2 tw:text-[13px] tw:font-medium tw:transition-colors';

  return (
    <div className="tw:flex tw:flex-col tw:gap-5">

      {/* Header */}
      <div className="tw:flex tw:items-center tw:gap-3">
        <button type="button" onClick={onBack}
          className="tw:flex tw:items-center tw:gap-1 tw:text-[13px] tw:font-medium tw:text-slate-500 tw:hover:text-slate-700">
          <ChevronLeft className="tw:h-4 tw:w-4" strokeWidth={2} />
          Back
        </button>
        <div>
          <h2 className="tw:m-0 tw:text-[17px] tw:font-semibold tw:text-slate-900">Course Settings</h2>
          <p className="tw:m-0 tw:text-[11px] tw:text-slate-400">Step 4 — Pricing, access &amp; SEO</p>
        </div>
      </div>

      {/* Validation / API error banner */}
      {fieldError && (
        <div className="tw:rounded-lg tw:border tw:border-red-100 tw:bg-red-50 tw:px-4 tw:py-2.5 tw:text-[13px] tw:text-red-600">
          {fieldError}
        </div>
      )}

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <section className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5 tw:flex tw:flex-col tw:gap-4">
        <h3 className="tw:m-0 tw:text-[13px] tw:font-semibold tw:text-slate-800">Pricing</h3>

        <div className="tw:flex tw:gap-2">
          <button
            type="button"
            aria-label="Free"
            onClick={() => { setField('isFree', true); setField('priceStr', ''); }}
            className={
              pricingToggleBase +
              (form.isFree
                ? ' tw:border-blue-400 tw:bg-blue-50 tw:text-blue-700'
                : ' tw:border-slate-200 tw:text-slate-500 tw:hover:border-slate-300 tw:hover:text-slate-700')
            }
          >
            Free
          </button>
          <button
            type="button"
            aria-label="Paid"
            onClick={() => setField('isFree', false)}
            className={
              pricingToggleBase +
              (!form.isFree
                ? ' tw:border-blue-400 tw:bg-blue-50 tw:text-blue-700'
                : ' tw:border-slate-200 tw:text-slate-500 tw:hover:border-slate-300 tw:hover:text-slate-700')
            }
          >
            Paid
          </button>
        </div>

        {!form.isFree && (
          <div className="tw:flex tw:gap-3">
            <div className="tw:flex-1">
              <label className="tw:block tw:text-[12px] tw:font-semibold tw:text-slate-700">
                Price <span className="tw:text-red-500">*</span>
              </label>
              <p className="tw:mt-0.5 tw:text-[11px] tw:text-slate-400">Enter the price in your selected currency (e.g. 19.99).</p>
              <div className="tw:relative tw:mt-1">
                <span className="tw:pointer-events-none tw:absolute tw:left-3 tw:top-1/2 tw:-translate-y-1/2 tw:text-[13px] tw:text-slate-400">
                  $
                </span>
                <input
                  aria-label="Price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.priceStr}
                  onChange={e => setField('priceStr', e.target.value)}
                  placeholder="0.00"
                  className={`${inputCls} tw:pl-7`}
                />
              </div>
            </div>
            <div className="tw:w-28">
              <label className="tw:block tw:text-[12px] tw:font-semibold tw:text-slate-700">Currency</label>
              <input
                aria-label="Currency"
                type="text"
                maxLength={3}
                value={form.currency}
                onChange={e => setField('currency', e.target.value.toUpperCase())}
                placeholder="USD"
                className={`${inputCls} tw:mt-1`}
              />
            </div>
          </div>
        )}
      </section>

      {/* ── Enrollment ──────────────────────────────────────────────────── */}
      <section className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5 tw:flex tw:flex-col tw:gap-4">
        <h3 className="tw:m-0 tw:text-[13px] tw:font-semibold tw:text-slate-800">Enrollment</h3>
        <div className="tw:grid tw:grid-cols-2 tw:gap-4">
          <div>
            <label className="tw:block tw:text-[12px] tw:font-semibold tw:text-slate-700">Enrollment Limit</label>
            <p className="tw:mt-0.5 tw:text-[11px] tw:text-slate-400">Leave blank for unlimited.</p>
            <input
              aria-label="Enrollment Limit"
              type="number"
              min="1"
              step="1"
              value={form.enrollmentLimitStr}
              onChange={e => setField('enrollmentLimitStr', e.target.value)}
              placeholder="Unlimited"
              className={`${inputCls} tw:mt-1`}
            />
          </div>
          <div>
            <label className="tw:block tw:text-[12px] tw:font-semibold tw:text-slate-700">Visibility</label>
            <select
              aria-label="Visibility"
              value={form.visibility}
              onChange={e => setField('visibility', e.target.value as CourseVisibility)}
              className={`${inputCls} tw:mt-1`}
            >
              <option value="Public">Public</option>
              <option value="Private">Private</option>
              <option value="Unlisted">Unlisted</option>
            </select>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5 tw:flex tw:flex-col tw:gap-3">
        <h3 className="tw:m-0 tw:text-[13px] tw:font-semibold tw:text-slate-800">Features</h3>
        <Toggle
          checked={form.certificateEnabled}
          onChange={v => setField('certificateEnabled', v)}
          label="Issue completion certificates"
        />
        <Toggle
          checked={form.dripContentEnabled}
          onChange={v => setField('dripContentEnabled', v)}
          label="Enable drip content (release lessons sequentially)"
        />
      </section>

      {/* ── Access Rules ─────────────────────────────────────────────────── */}
      <section className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5 tw:flex tw:flex-col tw:gap-4">
        <h3 className="tw:m-0 tw:text-[13px] tw:font-semibold tw:text-slate-800">Access Rules</h3>

        <Toggle
          checked={form.requiresEnrollment}
          onChange={v => setField('requiresEnrollment', v)}
          label="Require enrollment to access content"
        />

        <div className="tw:grid tw:grid-cols-2 tw:gap-4">
          <div>
            <label className="tw:block tw:text-[12px] tw:font-semibold tw:text-slate-700">Start Date</label>
            <p className="tw:mt-0.5 tw:text-[11px] tw:text-slate-400">Access opens from this date (optional).</p>
            <input
              aria-label="Start Date"
              type="date"
              value={form.startDate}
              onChange={e => setField('startDate', e.target.value)}
              className={`${inputCls} tw:mt-1`}
            />
          </div>
          <div>
            <label className="tw:block tw:text-[12px] tw:font-semibold tw:text-slate-700">End Date</label>
            <p className="tw:mt-0.5 tw:text-[11px] tw:text-slate-400">Access closes after this date (optional).</p>
            <input
              aria-label="End Date"
              type="date"
              value={form.endDate}
              onChange={e => setField('endDate', e.target.value)}
              className={`${inputCls} tw:mt-1`}
            />
          </div>
        </div>

        <div>
          <div className="tw:flex tw:items-baseline tw:justify-between tw:mb-1">
            <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">
              Allowed Groups
            </label>
            <p className="tw:text-[11px] tw:text-slate-400 tw:m-0">Max 50. Leave empty to allow all.</p>
          </div>
          <MultiSelectPicker
            ariaLabel="Allowed Groups"
            items={groups.map(g => ({ id: g.id, label: g.name }))}
            selected={form.allowedGroupIds}
            onChange={ids => setField('allowedGroupIds', ids)}
            max={50}
            loading={groupsLoading}
          />
        </div>

        <div>
          <div className="tw:flex tw:items-baseline tw:justify-between tw:mb-1">
            <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">
              Prerequisite Courses
            </label>
            <p className="tw:text-[11px] tw:text-slate-400 tw:m-0">Max 50. Leave empty for none.</p>
          </div>
          <MultiSelectPicker
            ariaLabel="Prerequisite Courses"
            items={availCourses.map(c => ({ id: c.id, label: c.title }))}
            selected={form.prereqCourseIds}
            onChange={ids => setField('prereqCourseIds', ids)}
            max={50}
            loading={coursesLoading}
          />
        </div>
      </section>

      {/* ── SEO ─────────────────────────────────────────────────────────── */}
      <section className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5 tw:flex tw:flex-col tw:gap-4">
        <h3 className="tw:m-0 tw:text-[13px] tw:font-semibold tw:text-slate-800">SEO</h3>

        <div>
          <div className="tw:flex tw:items-end tw:justify-between">
            <div>
              <label className="tw:block tw:text-[12px] tw:font-semibold tw:text-slate-700">SEO Title</label>
              <p className="tw:mt-0.5 tw:text-[11px] tw:text-slate-400">Shown in search engine results. Max 70 characters.</p>
            </div>
            <span className={
              'tw:text-[11px] tw:font-mono tw:flex-shrink-0 tw:ml-2' +
              (form.seoTitle.length > 70 ? ' tw:text-red-500' : ' tw:text-slate-400')
            }>
              {form.seoTitle.length}/70
            </span>
          </div>
          <input
            aria-label="SEO Title"
            type="text"
            maxLength={70}
            value={form.seoTitle}
            onChange={e => setField('seoTitle', e.target.value)}
            placeholder="e.g. Learn React from Scratch — Beginner to Advanced"
            className={`${inputCls} tw:mt-1`}
          />
        </div>

        <div>
          <div className="tw:flex tw:items-end tw:justify-between">
            <div>
              <label className="tw:block tw:text-[12px] tw:font-semibold tw:text-slate-700">SEO Description</label>
              <p className="tw:mt-0.5 tw:text-[11px] tw:text-slate-400">Brief description for search results. Max 200 characters.</p>
            </div>
            <span className={
              'tw:text-[11px] tw:font-mono tw:flex-shrink-0 tw:ml-2' +
              (form.seoDescription.length > 200 ? ' tw:text-red-500' : ' tw:text-slate-400')
            }>
              {form.seoDescription.length}/200
            </span>
          </div>
          <textarea
            aria-label="SEO Description"
            maxLength={200}
            value={form.seoDescription}
            onChange={e => setField('seoDescription', e.target.value)}
            placeholder="A concise description of what students will learn…"
            rows={3}
            className={`${inputCls} tw:mt-1 tw:resize-y`}
          />
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="tw:flex tw:items-center tw:justify-between tw:py-2">
        <button type="button" onClick={onBack} disabled={saving}
          className="tw:flex tw:items-center tw:gap-1 tw:rounded-lg tw:border tw:border-slate-200 tw:px-4 tw:py-2 tw:text-[13px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50 tw:disabled:opacity-40">
          <ChevronLeft className="tw:h-4 tw:w-4" strokeWidth={2} />
          Back to Builder
        </button>

        <div className="tw:flex tw:gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            aria-label="Save Settings"
            className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:border tw:border-slate-200 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-slate-700 tw:hover:bg-slate-50 tw:disabled:opacity-40"
          >
            <Save className="tw:h-4 tw:w-4" strokeWidth={2} />
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={saving}
            aria-label="Next: Preview"
            className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700 tw:disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Next: Preview'}
            <ChevronRight className="tw:h-4 tw:w-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      {toastMsg && <ToastBanner message={toastMsg} />}
    </div>
  );
}
