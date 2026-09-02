import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { createAutomation, updateAutomation, listTemplates } from '../../services/notificationsApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { AUTOMATION_TRIGGERS, CHANNEL_TYPES, type NotificationAutomation, type NotificationChannelType, type NotificationTemplate } from '../../types/notifications';
import { INPUT, LABEL, ERR, BTN_PRIMARY, BTN_SECONDARY } from './shared';

interface Props {
  mode: 'create' | 'edit';
  automation?: NotificationAutomation;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export default function CreateEditAutomationModal({ mode, automation, onClose, onSuccess, showToast }: Props) {
  const [name, setName] = useState(automation?.name ?? '');
  const [description, setDescription] = useState(automation?.description ?? '');
  const [trigger, setTrigger] = useState(automation?.trigger ?? 'USER_REGISTRATION');
  const [templateId, setTemplateId] = useState(automation?.templateId ?? '');
  const [channels, setChannels] = useState<NotificationChannelType[]>(automation?.channels ?? ['IN_APP']);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listTemplates({ status: 'ACTIVE', limit: 100 }).then(res => setTemplates(res.items)).catch(err => console.error(err));
  }, []);

  function toggleChannel(c: NotificationChannelType) {
    setChannels(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Name is required.';
    if (!templateId) next.templateId = 'Select a template.';
    if (channels.length === 0) next.channels = 'Select at least one channel.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = { name: name.trim(), description: description.trim() || null, trigger, templateId, channels };
      if (mode === 'edit' && automation) {
        await updateAutomation(automation.id, payload);
        invalidateFor(appQueryClient, 'notificationRule.update');
        showToast('success', 'Automation updated.');
      } else {
        await createAutomation(payload);
        invalidateFor(appQueryClient, 'notificationRule.create');
        showToast('success', 'Automation created.');
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
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>{mode === 'edit' ? 'Edit Automation' : 'Create Automation'}</h3>
          <button type="button" onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}><X size={14} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {serverError && <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#b91c1c' }}>{serverError}</div>}
          {templates.length === 0 && (
            <div style={{ padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, fontSize: 12, color: '#92400e' }}>
              No active templates yet — create one first (Templates tab).
            </div>
          )}

          <div>
            <label style={LABEL} htmlFor="auto-name">Name *</label>
            <input id="auto-name" style={{ ...INPUT, width: '100%', boxSizing: 'border-box' }} value={name} onChange={e => setName(e.target.value)} />
            {errors.name && <div style={ERR}>{errors.name}</div>}
          </div>

          <div>
            <label style={LABEL} htmlFor="auto-desc">Description</label>
            <textarea id="auto-desc" rows={2} style={{ ...INPUT, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} value={description ?? ''} onChange={e => setDescription(e.target.value)} />
          </div>

          <div>
            <label style={LABEL} htmlFor="auto-trigger">Trigger Event</label>
            <select id="auto-trigger" style={{ ...INPUT, width: '100%' }} value={trigger} onChange={e => setTrigger(e.target.value as typeof trigger)}>
              {AUTOMATION_TRIGGERS.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>

          <div>
            <label style={LABEL} htmlFor="auto-template">Template *</label>
            <select id="auto-template" style={{ ...INPUT, width: '100%' }} value={templateId} onChange={e => setTemplateId(e.target.value)}>
              <option value="">Select a template</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.type})</option>)}
            </select>
            {errors.templateId && <div style={ERR}>{errors.templateId}</div>}
          </div>

          <div>
            <label style={LABEL}>Channels *</label>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {CHANNEL_TYPES.map(c => (
                <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                  <input type="checkbox" checked={channels.includes(c)} onChange={() => toggleChannel(c)} />
                  {c === 'IN_APP' ? 'In-App' : c}
                </label>
              ))}
            </div>
            {errors.channels && <div style={ERR}>{errors.channels}</div>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
            <button type="button" onClick={onClose} disabled={submitting} style={BTN_SECONDARY}>Cancel</button>
            <button type="submit" disabled={submitting} style={{ ...BTN_PRIMARY, opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Saving…' : mode === 'edit' ? 'Save Changes' : 'Create Automation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
