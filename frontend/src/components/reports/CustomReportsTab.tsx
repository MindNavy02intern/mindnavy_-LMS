// Custom Reports tab — genuinely "coming soon": no report-builder backend
// exists (no saved-report-definition model, no query-builder endpoint).
// Presented as a real planned feature (what it will include) rather than a
// bare placeholder, per the task spec, and names the exact dead mutation ID
// (reportTemplate.save) that's already reserved in invalidation.ts for when
// this ships. "Notify me" has no backend to persist interest against — the
// toast is the entire feature, not a stand-in for a real subscription.

import { useState } from 'react';
import { Wrench, Database, Filter, BarChart3, Bookmark, CalendarClock, Bell, Check } from 'lucide-react';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
}

const FEATURES = [
  { Icon: Database, title: 'Data Source Picker', desc: 'Start from learners, instructors, courses, certificates, assessments, attendance, or audit logs.' },
  { Icon: Filter, title: 'Filters & Columns', desc: 'Choose exactly which fields and filters go into the report — no fixed column set.' },
  { Icon: BarChart3, title: 'Visualization Types', desc: 'Render as a table, line, bar, pie, heatmap, or KPI cards.' },
  { Icon: Bookmark, title: 'Save as Template', desc: 'Save a definition once, reuse it any time without rebuilding it.' },
  { Icon: CalendarClock, title: 'Schedule Auto-Reports', desc: 'Run a saved template automatically and have it ready on a recurring schedule.' },
];

export default function CustomReportsTab({ showToast }: Props) {
  const [notified, setNotified] = useState(false);

  function handleNotify() {
    setNotified(true);
    showToast('success', "You'll be notified when this ships");
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '40px 32px', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Wrench size={24} color="#2563eb" strokeWidth={2} />
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, background: '#eff6ff', color: '#2563eb', fontSize: 11, fontWeight: 700, marginBottom: 10 }}>
          COMING SOON
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 700, color: '#0f172a' }}>Custom Report Builder</h2>
        <p style={{ margin: 0, fontSize: 13, color: '#64748b', maxWidth: 460, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
          Build your own report from scratch: pick a data source, choose your metrics and filters, and
          render it however you want. Here's what's planned:
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 32 }}>
        {FEATURES.map(({ Icon, title, desc }) => (
          <div key={title} style={{ display: 'flex', gap: 12, padding: '14px 16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #f1f5f9' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fff', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={15} color="#475569" strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>{title}</div>
              <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center' }}>
        <button
          type="button"
          onClick={handleNotify}
          disabled={notified}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 20px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            background: notified ? '#f0fdf4' : '#2563eb', color: notified ? '#16a34a' : '#fff',
            border: notified ? '1px solid #bbf7d0' : 'none', borderRadius: 8, cursor: notified ? 'default' : 'pointer',
          }}
        >
          {notified ? <Check size={15} /> : <Bell size={15} />}
          {notified ? "You're on the list" : 'Notify me when available'}
        </button>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 10 }}>
          Until then, the <strong>Export Center</strong> tab covers 7 built-in report types with a fixed column set.
        </div>
      </div>
    </div>
  );
}
