import { useState } from 'react';
import { X } from 'lucide-react';
import { previewTemplate } from '../../services/notificationsApi';
import type { NotificationTemplate, TemplatePreviewResponse } from '../../types/notifications';
import { INPUT, LABEL, BTN_PRIMARY, BTN_SECONDARY } from './shared';

interface Props {
  template: NotificationTemplate;
  onClose: () => void;
}

export default function TemplatePreviewModal({ template, onClose }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(template.variables.map(v => [v, ''])));
  const [result, setResult] = useState<TemplatePreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePreview() {
    setLoading(true);
    try {
      const res = await previewTemplate(template.id, values);
      setResult(res);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Preview: {template.name}</h3>
          <button type="button" onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}><X size={14} /></button>
        </div>

        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {template.variables.length === 0 ? (
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>This template has no variables — the body renders as-is.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {template.variables.map(v => (
                <div key={v}>
                  <label style={LABEL} htmlFor={`var-${v}`}>{'{{'}{v}{'}}'}</label>
                  <input id={`var-${v}`} style={{ ...INPUT, width: '100%', boxSizing: 'border-box' }} value={values[v] ?? ''} onChange={e => setValues(prev => ({ ...prev, [v]: e.target.value }))} />
                </div>
              ))}
            </div>
          )}

          <button type="button" onClick={handlePreview} disabled={loading} style={{ ...BTN_PRIMARY, alignSelf: 'flex-start' }}>
            {loading ? 'Rendering…' : 'Render Preview'}
          </button>

          {result && (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 14, background: '#f8fafc' }}>
              {result.subject && <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Subject: {result.subject}</div>}
              <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap' }}>{result.body}</div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={BTN_SECONDARY}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
