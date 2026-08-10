import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { createTemplate, updateTemplate } from '../../services/notificationsApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { CATEGORIES, CHANNEL_TYPES, type NotificationTemplate } from '../../types/notifications';
import { INPUT, LABEL, ERR, BTN_PRIMARY, BTN_SECONDARY } from './shared';

interface Props {
  mode: 'create' | 'edit';
  template?: NotificationTemplate;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export default function CreateEditTemplateModal({ mode, template, onClose, onSuccess, showToast }: Props) {
  const [name, setName] = useState(template?.name ?? '');
  const [type, setType] = useState(template?.type ?? 'EMAIL');
  const [category, setCategory] = useState(template?.category ?? 'SYSTEM');
  const [subject, setSubject] = useState(template?.subject ?? '');
  const [body, setBody] = useState(template?.body ?? '');
  const [variables, setVariables] = useState<string[]>(template?.variables ?? []);
  const [varInput, setVarInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function addVariable() {
    const v = varInput.trim().replace(/[{}]/g, '');
    if (!v || variables.includes(v)) return;
    setVariables(prev => [...prev, v]);
    setVarInput('');
  }
  function removeVariable(v: string) { setVariables(prev => prev.filter(x => x !== v)); }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Name is required.';
    if (!body.trim()) next.body = 'Body is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = { name: name.trim(), type, category, subject: type === 'EMAIL' ? (subject.trim() || null) : null, body: body.trim(), variables };
      if (mode === 'edit' && template) {
        await updateTemplate(template.id, payload);
        invalidateFor(appQueryClient, 'notificationTemplate.update');
        showToast('success', 'Template updated.');
      } else {
        await createTemplate(payload);
        invalidateFor(appQueryClient, 'notificationTemplate.create');
        showToast('success', 'Template created.');
      }
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setServerError(msg);
      showToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={!submitting ? onClose : undefined} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>{mode === 'edit' ? 'Edit Template' : 'Create Template'}</h3>
          <button type="button" onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}><X size={14} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {serverError && <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#b91c1c' }}>{serverError}</div>}

          <div>
            <label style={LABEL} htmlFor="tpl-name">Name *</label>
            <input id="tpl-name" style={{ ...INPUT, width: '100%', boxSizing: 'border-box' }} value={name} onChange={e => setName(e.target.value)} />
            {errors.name && <div style={ERR}>{errors.name}</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={LABEL} htmlFor="tpl-type">Type</label>
              <select id="tpl-type" style={{ ...INPUT, width: '100%' }} value={type} onChange={e => setType(e.target.value as typeof type)}>
                {CHANNEL_TYPES.map(t => <option key={t} value={t}>{t === 'IN_APP' ? 'IN-APP' : t}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL} htmlFor="tpl-category">Category</label>
              <select id="tpl-category" style={{ ...INPUT, width: '100%' }} value={category} onChange={e => setCategory(e.target.value as typeof category)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {type === 'EMAIL' && (
            <div>
              <label style={LABEL} htmlFor="tpl-subject">Subject</label>
              <input id="tpl-subject" style={{ ...INPUT, width: '100%', boxSizing: 'border-box' }} value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Welcome to {{courseName}}!" />
            </div>
          )}

          <div>
            <label style={LABEL} htmlFor="tpl-body">Body * <span style={{ fontWeight: 400, color: '#94a3b8' }}>— use {'{{variable}}'} for dynamic values</span></label>
            <textarea id="tpl-body" rows={5} style={{ ...INPUT, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} value={body} onChange={e => setBody(e.target.value)} />
            {errors.body && <div style={ERR}>{errors.body}</div>}
          </div>

          <div>
            <label style={LABEL}>Variables</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                style={{ ...INPUT, flex: 1 }} value={varInput} onChange={e => setVarInput(e.target.value)}
                placeholder="e.g. studentName"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addVariable(); } }}
              />
              <button type="button" onClick={addVariable} style={{ ...BTN_SECONDARY, display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={14} /> Add</button>
            </div>
            {variables.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {variables.map(v => (
                  <span key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, background: '#eff6ff', color: '#2563eb', padding: '3px 8px', borderRadius: 999, fontFamily: 'monospace' }}>
                    {'{{'}{v}{'}}'}
                    <button type="button" onClick={() => removeVariable(v)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
            <button type="button" onClick={onClose} disabled={submitting} style={BTN_SECONDARY}>Cancel</button>
            <button type="submit" disabled={submitting} style={{ ...BTN_PRIMARY, opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Saving…' : mode === 'edit' ? 'Save Changes' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
