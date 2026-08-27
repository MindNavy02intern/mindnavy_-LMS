// Branding & Customization tab (?tab=branding).

import { useRef, useState } from 'react';
import { updateSystemSettings, uploadBrandingAsset } from '../../services/settingsApi';
import { SettingsApiError } from '../../types/settings';
import type { SystemSettings } from '../../types/settings';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { applyPrimaryColor, applyLogo, applyFavicon } from '../../lib/theme';
import { Card, FormGrid, Field, FULL_INPUT, BTN_SECONDARY, ToggleRow, ComingSoonBadge } from './_shared';

interface Props {
  settings: SystemSettings;
  onSaved: (s: SystemSettings) => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

function UploadBox({ label, kind, currentUrl, uploading, onUpload }: {
  label: string; kind: 'logo' | 'favicon'; currentUrl: string | null;
  uploading: boolean; onUpload: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 64, height: 64, borderRadius: 10, border: '1px solid #e5e7eb', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
          {currentUrl
            ? <img src={currentUrl} alt={label} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            : <span style={{ fontSize: 10, color: '#cbd5e1' }}>No {kind}</span>}
        </div>
        <div>
          <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
          <button type="button" style={BTN_SECONDARY} disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? 'Uploading…' : `Upload New ${label}`}
          </button>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>PNG/JPG/SVG, up to 2MB.</div>
        </div>
      </div>
    </div>
  );
}

export default function BrandingTab({ settings, onSaved, showToast }: Props) {
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [color, setColor] = useState(settings.primaryColor ?? '#2563eb');
  const [savingColor, setSavingColor] = useState(false);

  async function handleUpload(kind: 'logo' | 'favicon', file: File) {
    const setBusy = kind === 'logo' ? setUploadingLogo : setUploadingFavicon;
    setBusy(true);
    try {
      const url = await uploadBrandingAsset(kind, file);
      const updated = await updateSystemSettings(kind === 'logo' ? { logoUrl: url } : { faviconUrl: url });
      invalidateFor(appQueryClient, 'settings.update', { domain: 'branding' });
      onSaved(updated);
      if (kind === 'logo') applyLogo(updated.logoUrl); else applyFavicon(updated.faviconUrl);
      showToast('success', `${kind === 'logo' ? 'Logo' : 'Favicon'} updated.`);
    } catch (err) {
      showToast('error', err instanceof SettingsApiError ? err.message : `Failed to upload ${kind}.`);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveColor() {
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) { showToast('error', 'Primary color must be a hex value like #2563eb.'); return; }
    setSavingColor(true);
    try {
      const updated = await updateSystemSettings({ primaryColor: color });
      invalidateFor(appQueryClient, 'settings.update', { domain: 'branding' });
      onSaved(updated);
      applyPrimaryColor(updated.primaryColor);
      showToast('success', 'Primary color saved.');
    } catch (err) {
      showToast('error', err instanceof SettingsApiError ? err.message : 'Failed to save color.');
    } finally {
      setSavingColor(false);
    }
  }

  return (
    <div>
      <Card title="Logo & Favicon">
        <FormGrid>
          <UploadBox label="Platform Logo" kind="logo" currentUrl={settings.logoUrl} uploading={uploadingLogo} onUpload={f => handleUpload('logo', f)} />
          <UploadBox label="Favicon" kind="favicon" currentUrl={settings.faviconUrl} uploading={uploadingFavicon} onUpload={f => handleUpload('favicon', f)} />
        </FormGrid>
      </Card>

      <Card title="Primary Color">
        <Field label="Primary Color" hint="Used for buttons, links and active nav highlights.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#2563eb'} onChange={e => setColor(e.target.value)} style={{ width: 40, height: 34, border: '1px solid #d1d5db', borderRadius: 6, padding: 0, cursor: 'pointer' }} />
            <input style={{ ...FULL_INPUT, maxWidth: 140 }} value={color} onChange={e => setColor(e.target.value)} placeholder="#2563eb" />
            <button type="button" style={BTN_SECONDARY} disabled={savingColor} onClick={handleSaveColor}>{savingColor ? 'Saving…' : 'Save Color'}</button>
          </div>
        </Field>
      </Card>

      <Card title="Preview">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, background: '#f8fafc', borderRadius: 8 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: '#fff', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {settings.logoUrl ? <img src={settings.logoUrl} alt="logo preview" style={{ maxWidth: '100%', maxHeight: '100%' }} /> : <span style={{ fontSize: 9, color: '#cbd5e1' }}>Logo</span>}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: settings.primaryColor ?? '#2563eb' }}>{settings.platformName}</div>
          <div style={{ width: 90, height: 28, borderRadius: 6, background: settings.primaryColor ?? '#2563eb' }} />
        </div>
      </Card>

      <Card title="Advanced Branding">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ToggleRow label={<>White Label <ComingSoonBadge /></>} description="Remove MindNavy branding entirely." checked={false} onChange={() => {}} disabled disabledHint="Coming soon" />
          <ToggleRow label={<>Custom Theme Selector <ComingSoonBadge /></>} description="Choose from prebuilt color themes." checked={false} onChange={() => {}} disabled disabledHint="Coming soon" />
        </div>
      </Card>
    </div>
  );
}
