import { useState } from 'react';
import { X, Shuffle } from 'lucide-react';
import { createWebhook, updateWebhook } from '../../services/integrationsApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { WEBHOOK_EVENTS } from '../../types/integrations';
import type { Webhook } from '../../types/integrations';
import { LABEL, ERR, INPUT, BTN_PRIMARY, BTN_SECONDARY } from './shared';

interface Props {
  mode: 'create' | 'edit';
  webhook?: Webhook;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

function randomSecret(): string {
  return Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

export default function CreateWebhookModal({ mode, webhook, onClose, onSuccess, showToast }: Props) {
  const [name, setName] = useState(webhook?.name ?? '');
  const [url, setUrl] = useState(webhook?.url ?? '');
  const [events, setEvents] = useState<string[]>(webhook?.events ?? []);
  const [secret, setSecret] = useState(mode === 'create' ? randomSecret() : '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleEvent(e: string) {
    setEvents(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);
  }

  async function handleSubmit() {
    if (!name.trim()) { setError('Name is required.'); return; }
    if (!url.trim().startsWith('https://')) { setError('URL must use https.'); return; }
    if (events.length === 0) { setError('Select at least one event.'); return; }
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'create') {
        await createWebhook({ name: name.trim(), url: url.trim(), events, secret: secret || undefined });
        invalidateFor(appQueryClient, 'webhook.create');
        showToast('success', 'Webhook created.');
      } else if (webhook) {
        await updateWebhook(webhook.id, { name: name.trim(), url: url.trim(), events });
        invalidateFor(appQueryClient, 'webhook.update');
        showToast('success', 'Webhook updated.');
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save webhook.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>{mode === 'create' ? 'Create Webhook' : 'Edit Webhook'}</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={16} /></button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={LABEL} htmlFor="webhook-name">Name</label>
            <input id="webhook-name" style={{ ...INPUT, width: '100%' }} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Order Notifications" />
          </div>
          <div>
            <label style={LABEL} htmlFor="webhook-url">URL (https only)</label>
            <input id="webhook-url" style={{ ...INPUT, width: '100%' }} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/webhook" />
          </div>
          <div>
            <label style={LABEL} id="webhook-events-label">Events</label>
            <div role="group" aria-labelledby="webhook-events-label" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 140, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>
              {WEBHOOK_EVENTS.map(e => {
                const active = events.includes(e);
                return (
                  <button key={e} type="button" aria-pressed={active} onClick={() => toggleEvent(e)} style={{
                    fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 999, cursor: 'pointer',
                    border: `1px solid ${active ? '#2563eb' : '#e5e7eb'}`,
                    background: active ? '#eff6ff' : '#fff', color: active ? '#2563eb' : '#64748b',
                  }}>
                    {e}
                  </button>
                );
              })}
            </div>
          </div>
          {mode === 'create' && (
            <div>
              <label style={LABEL} htmlFor="webhook-secret">Secret (used to sign payloads)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input id="webhook-secret" style={{ ...INPUT, flex: 1 }} value={secret} onChange={e => setSecret(e.target.value)} />
                <button type="button" style={{ ...BTN_SECONDARY, padding: '8px 10px' }} onClick={() => setSecret(randomSecret())} title="Generate new secret">
                  <Shuffle size={14} strokeWidth={2} />
                </button>
              </div>
            </div>
          )}
          {error && <div style={ERR}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" style={BTN_SECONDARY} onClick={onClose}>Cancel</button>
            <button type="button" style={{ ...BTN_PRIMARY, opacity: submitting ? 0.6 : 1 }} disabled={submitting} onClick={handleSubmit}>
              {submitting ? 'Saving…' : mode === 'create' ? 'Create Webhook' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
