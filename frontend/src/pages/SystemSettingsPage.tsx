import { useEffect, useState } from 'react';
import AdminLayout from '../layouts/AdminLayout';

const TABS = [
  { key: 'general',       label: 'General Settings' },
  { key: 'email',         label: 'Email Configuration' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'security',      label: 'Security' },
  { key: 'integrations',  label: 'Integrations' },
  { key: 'billing',       label: 'Billing & Payments' },
  { key: 'branding',      label: 'Branding & Customization' },
  { key: 'advanced',      label: 'Advanced' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Riyadh',
  'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'zh', label: 'Chinese (Simplified)' },
  { value: 'ja', label: 'Japanese' },
];

const DATE_FORMATS = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
  { value: 'DD MMM YYYY', label: 'DD MMM YYYY' },
];

const CURRENCIES = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'SAR', label: 'SAR — Saudi Riyal' },
  { value: 'AED', label: 'AED — UAE Dirham' },
  { value: 'EGP', label: 'EGP — Egyptian Pound' },
];

const LS_KEY = 'mindnavy_general_settings';

interface GeneralSettings {
  platformName:    string;
  description:     string;
  timezone:        string;
  language:        string;
  dateFormat:      string;
  currency:        string;
  adminEmail:      string;
  supportEmail:    string;
  maxUploadMb:     string;
  sessionTimeout:  string;
}

const DEFAULT_SETTINGS: GeneralSettings = {
  platformName:   'MindNavy LMS',
  description:    'A modern learning management system for your organization.',
  timezone:       'UTC',
  language:       'en',
  dateFormat:     'MM/DD/YYYY',
  currency:       'USD',
  adminEmail:     '',
  supportEmail:   '',
  maxUploadMb:    '50',
  sessionTimeout: '60',
};

function loadSettings(): GeneralSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // Corrupted or unparseable localStorage data — fall back to defaults below.
  }
  return { ...DEFAULT_SETTINGS };
}

// ── Toast ─────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error';
interface Toast { id: number; type: ToastType; message: string; }

function ToastList({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderRadius: 8,
          background: t.type === 'success' ? '#dcfce7' : '#fee2e2',
          border: `1px solid ${t.type === 'success' ? '#86efac' : '#fca5a5'}`,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          minWidth: 220, maxWidth: 340,
        }}>
          <span style={{ fontSize: '0.82rem', color: t.type === 'success' ? '#15803d' : '#dc2626', flex: 1 }}>{t.message}</span>
          <button onClick={() => onRemove(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1rem', lineHeight: 1, padding: 0 }}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ── Coming Soon placeholder ────────────────────────────────────────────────────

function ComingSoonTab({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#374151', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>This section is coming soon. Configuration options will appear here.</div>
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f1f5f9' }}>
        {title}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {children}
      </div>
    </div>
  );
}

// ── Field wrapper ──────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '7px 10px', fontSize: '0.85rem',
  border: '1px solid #e2e8f0', borderRadius: 6,
  color: '#0f172a', background: '#fff',
  outline: 'none',
};

const selectStyle: React.CSSProperties = { ...inputStyle };

// ── General Settings tab ───────────────────────────────────────────────────────

function GeneralSettingsTab() {
  const [form, setForm]       = useState<GeneralSettings>(loadSettings);
  const [saving, setSaving]   = useState(false);
  const [dirty, setDirty]     = useState(false);
  const [saved, setSaved]     = useState(false);

  function set(key: keyof GeneralSettings) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm(f => ({ ...f, [key]: e.target.value }));
      setDirty(true);
      setSaved(false);
    };
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(form));
        setSaved(true);
        setDirty(false);
      } finally {
        setSaving(false);
      }
    }, 400);
  }

  function handleReset() {
    if (!window.confirm('Reset all General Settings to defaults?')) return;
    localStorage.removeItem(LS_KEY);
    setForm({ ...DEFAULT_SETTINGS });
    setDirty(false);
    setSaved(false);
  }

  return (
    <form onSubmit={handleSave}>
      <Section title="Platform Identity">
        <Field label="Platform Name" hint="Displayed in the browser tab and email headers.">
          <input style={inputStyle} value={form.platformName} onChange={set('platformName')} required maxLength={80} />
        </Field>
        <Field label="Platform Description">
          <textarea
            style={{ ...inputStyle, resize: 'vertical', minHeight: 68 }}
            value={form.description}
            onChange={set('description')}
            maxLength={300}
          />
        </Field>
      </Section>

      <Section title="Locale & Formatting">
        <Field label="Timezone">
          <select style={selectStyle} value={form.timezone} onChange={set('timezone')}>
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </Field>
        <Field label="Default Language">
          <select style={selectStyle} value={form.language} onChange={set('language')}>
            {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </Field>
        <Field label="Date Format">
          <select style={selectStyle} value={form.dateFormat} onChange={set('dateFormat')}>
            {DATE_FORMATS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </Field>
        <Field label="Currency">
          <select style={selectStyle} value={form.currency} onChange={set('currency')}>
            {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
      </Section>

      <Section title="Contact Information">
        <Field label="Admin Email" hint="Receives system alerts and admin notifications.">
          <input style={inputStyle} type="email" value={form.adminEmail} onChange={set('adminEmail')} placeholder="admin@example.com" />
        </Field>
        <Field label="Support Email" hint="Shown to learners needing help.">
          <input style={inputStyle} type="email" value={form.supportEmail} onChange={set('supportEmail')} placeholder="support@example.com" />
        </Field>
      </Section>

      <Section title="Limits & Sessions">
        <Field label="Max Upload Size (MB)" hint="Maximum file size for content uploads.">
          <input style={inputStyle} type="number" min="1" max="500" value={form.maxUploadMb} onChange={set('maxUploadMb')} />
        </Field>
        <Field label="Session Timeout (minutes)" hint="Idle users are logged out after this period.">
          <input style={inputStyle} type="number" min="5" max="1440" value={form.sessionTimeout} onChange={set('sessionTimeout')} />
        </Field>
      </Section>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 8 }}>
        <button type="submit" disabled={saving || !dirty}
          style={{
            padding: '8px 20px', fontSize: '0.85rem', fontWeight: 600,
            background: dirty ? '#2563eb' : '#93c5fd', color: '#fff',
            border: 'none', borderRadius: 6,
            cursor: dirty ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s',
          }}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <button type="button" onClick={handleReset}
          style={{ padding: '8px 16px', fontSize: '0.85rem', fontWeight: 600, background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer' }}>
          Reset to Defaults
        </button>
        {saved && !dirty && (
          <span style={{ fontSize: '0.82rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Settings saved
          </span>
        )}
      </div>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SystemSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [toasts, setToasts]       = useState<Toast[]>([]);
  let toastId = 0;

  function addToast(type: ToastType, message: string) {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }
  void addToast; // referenced via GeneralSettingsTab in future — silence unused warning

  useEffect(() => { document.title = 'System Settings — MindNavy'; }, []);

  return (
    <AdminLayout pageTitle="System Settings">
      <ToastList toasts={toasts} onRemove={id => setToasts(prev => prev.filter(t => t.id !== id))} />

      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>System Settings</h1>
        <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 0' }}>Configure platform-wide settings and preferences.</p>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0', marginBottom: 24 }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 14px', fontSize: '0.82rem', fontWeight: 500,
              border: 'none', borderBottom: `2px solid ${activeTab === tab.key ? '#2563eb' : 'transparent'}`,
              background: 'none', color: activeTab === tab.key ? '#2563eb' : '#64748b',
              cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
              marginBottom: -1,
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '24px' }}>
        {activeTab === 'general'       && <GeneralSettingsTab />}
        {activeTab === 'email'         && <ComingSoonTab label="Email Configuration" />}
        {activeTab === 'notifications' && <ComingSoonTab label="Notification Settings" />}
        {activeTab === 'security'      && <ComingSoonTab label="Security Settings" />}
        {activeTab === 'integrations'  && <ComingSoonTab label="Integrations" />}
        {activeTab === 'billing'       && <ComingSoonTab label="Billing & Payments" />}
        {activeTab === 'branding'      && <ComingSoonTab label="Branding & Customization" />}
        {activeTab === 'advanced'      && <ComingSoonTab label="Advanced Settings" />}
      </div>
    </AdminLayout>
  );
}
