import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { sendEmergencyAlert } from '../../services/notificationsApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import type { NotificationChannelType } from '../../types/notifications';
import { INPUT, LABEL, ERR, BTN_DANGER, BTN_SECONDARY } from './shared';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export default function EmergencyAlertModal({ onClose, onSuccess, showToast }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [channels, setChannels] = useState<NotificationChannelType[]>(['IN_APP', 'EMAIL']);
  const [confirmText, setConfirmText] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  function toggleChannel(c: NotificationChannelType) {
    setChannels(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }

  function validateStep1(): boolean {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = 'Title is required.';
    if (!message.trim()) next.message = 'Message is required.';
    if (channels.length === 0) next.channels = 'Select at least one channel.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSend() {
    if (confirmText !== 'CONFIRM') return;
    setSubmitting(true);
    setServerError(null);
    try {
      await sendEmergencyAlert({ title: title.trim(), message: message.trim(), channels });
      invalidateFor(appQueryClient, 'emergencyAlert.send');
      showToast('success', 'Emergency alert sent to all users.');
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send emergency alert.';
      setServerError(msg);
      showToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} onClick={!submitting ? onClose : undefined} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: '2px solid #dc2626' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fef2f2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} color="#dc2626" />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#991b1b' }}>
              {step === 1 ? 'Send Emergency Alert' : 'Confirm Emergency Alert'}
            </h3>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}><X size={16} /></button>
        </div>

        {step === 1 ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={LABEL} htmlFor="ea-title">Title *</label>
              <input id="ea-title" style={{ ...INPUT, width: '100%', boxSizing: 'border-box' }} value={title} onChange={e => setTitle(e.target.value)} />
              {errors.title && <div style={ERR}>{errors.title}</div>}
            </div>
            <div>
              <label style={LABEL} htmlFor="ea-message">Message *</label>
              <textarea id="ea-message" rows={4} style={{ ...INPUT, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} value={message} onChange={e => setMessage(e.target.value)} />
              {errors.message && <div style={ERR}>{errors.message}</div>}
            </div>
            <div>
              <label style={LABEL}>Channels *</label>
              <div style={{ display: 'flex', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                  <input type="checkbox" checked={channels.includes('EMAIL')} onChange={() => toggleChannel('EMAIL')} /> Email
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                  <input type="checkbox" checked={channels.includes('IN_APP')} onChange={() => toggleChannel('IN_APP')} /> In-App
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#cbd5e1', cursor: 'not-allowed' }}>
                  <input type="checkbox" disabled /> Push <span style={{ fontSize: 10 }}>(coming soon)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#cbd5e1', cursor: 'not-allowed' }}>
                  <input type="checkbox" disabled /> SMS <span style={{ fontSize: 10 }}>(coming soon)</span>
                </label>
              </div>
              {errors.channels && <div style={ERR}>{errors.channels}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" style={BTN_SECONDARY} onClick={onClose}>Cancel</button>
              <button type="button" style={BTN_DANGER} onClick={() => { if (validateStep1()) setStep(2); }}>Continue</button>
            </div>
          </div>
        ) : (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {serverError && <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#b91c1c' }}>{serverError}</div>}
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 14, fontSize: 13, color: '#991b1b' }}>
              This will immediately notify <strong>ALL users</strong> via {channels.join(', ')}. This cannot be undone.
            </div>
            <div style={{ fontSize: 13, color: '#374151' }}>
              <strong>{title}</strong>
              <div style={{ marginTop: 4, whiteSpace: 'pre-wrap', color: '#64748b' }}>{message}</div>
            </div>
            <div>
              <label style={LABEL} htmlFor="ea-confirm">Type CONFIRM to proceed</label>
              <input id="ea-confirm" style={{ ...INPUT, width: '100%', boxSizing: 'border-box' }} value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="CONFIRM" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" style={BTN_SECONDARY} onClick={() => setStep(1)} disabled={submitting}>Back</button>
              <button type="button" style={{ ...BTN_DANGER, opacity: confirmText === 'CONFIRM' && !submitting ? 1 : 0.5 }} disabled={confirmText !== 'CONFIRM' || submitting} onClick={handleSend}>
                {submitting ? 'Sending…' : 'Send Emergency Alert'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
