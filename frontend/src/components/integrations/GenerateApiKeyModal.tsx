import { useState } from 'react';
import { X, Copy, AlertTriangle, Check } from 'lucide-react';
import { generateApiKey } from '../../services/integrationsApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { API_KEY_PERMISSIONS } from '../../types/integrations';
import { LABEL, ERR, INPUT, BTN_PRIMARY, BTN_SECONDARY } from './shared';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export default function GenerateApiKeyModal({ onClose, onSuccess, showToast }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function togglePermission(p: string) {
    setPermissions(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }

  async function handleSubmit() {
    if (!name.trim()) { setError('Name is required.'); return; }
    if (permissions.length === 0) { setError('Select at least one permission.'); return; }
    setError(null);
    setSubmitting(true);
    try {
      const created = await generateApiKey({
        name: name.trim(),
        description: description.trim() || undefined,
        permissions,
        expiresAt: expiresAt || undefined,
      });
      invalidateFor(appQueryClient, 'apiKey.generate');
      setCreatedKey(created.key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate key.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleCopy() {
    if (!createdKey) return;
    navigator.clipboard.writeText(createdKey).then(() => setCopied(true)).catch(err => console.error(err));
  }

  function handleDone() {
    onSuccess();
    showToast('success', 'API key generated.');
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={createdKey ? undefined : onClose} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>{createdKey ? 'API Key Generated' : 'Generate API Key'}</h3>
          {!createdKey && <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={16} /></button>}
        </div>

        {createdKey ? (
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
              <AlertTriangle size={16} color="#b45309" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12.5, color: '#92400e' }}>Save this key now — it won't be shown again.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
              <code style={{ fontSize: 12.5, flex: 1, wordBreak: 'break-all', color: '#0f172a' }}>{createdKey}</code>
              <button type="button" onClick={handleCopy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#16a34a' : '#2563eb', flexShrink: 0 }}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <button type="button" style={{ ...BTN_PRIMARY, width: '100%', marginTop: 18 }} onClick={handleDone}>Done</button>
          </div>
        ) : (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={LABEL} htmlFor="apikey-name">Name</label>
              <input id="apikey-name" style={{ ...INPUT, width: '100%' }} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Mobile App Integration" />
            </div>
            <div>
              <label style={LABEL} htmlFor="apikey-description">Description (optional)</label>
              <input id="apikey-description" style={{ ...INPUT, width: '100%' }} value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div>
              <label style={LABEL} id="apikey-permissions-label">Permissions</label>
              <div role="group" aria-labelledby="apikey-permissions-label" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 140, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8 }}>
                {API_KEY_PERMISSIONS.map(p => {
                  const active = permissions.includes(p);
                  return (
                    <button key={p} type="button" aria-pressed={active} onClick={() => togglePermission(p)} style={{
                      fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 999, cursor: 'pointer',
                      border: `1px solid ${active ? '#2563eb' : '#e5e7eb'}`,
                      background: active ? '#eff6ff' : '#fff', color: active ? '#2563eb' : '#64748b',
                    }}>
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label style={LABEL} htmlFor="apikey-expires">Expiry date (optional)</label>
              <input id="apikey-expires" type="date" style={{ ...INPUT, width: '100%' }} value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
            </div>
            {error && <div style={ERR}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" style={BTN_SECONDARY} onClick={onClose}>Cancel</button>
              <button type="button" style={{ ...BTN_PRIMARY, opacity: submitting ? 0.6 : 1 }} disabled={submitting} onClick={handleSubmit}>
                {submitting ? 'Generating…' : 'Generate Key'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
