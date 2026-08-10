import { useEffect, useRef, useState } from 'react';
import { Save, Download, ChevronDown, FileClock, RotateCcw } from 'lucide-react';
import { BTN_PRIMARY, BTN_SECONDARY } from './_shared';

interface Props {
  onSaveAll:  () => void;
  onExport:   () => void;
  onViewLogs: () => void;
  onRestore:  () => void;
  saving: boolean;
}

export default function SettingsPageHeader({ onSaveAll, onExport, onViewLogs, onRestore, saving }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const menuItemStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: '#374151' };

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0f172a' }}>System Settings</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b' }}>
          Configure platform behavior, security policies and system preferences
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button type="button" style={BTN_SECONDARY} onClick={onExport}>
          <Download size={15} strokeWidth={2} />
          Export Config
        </button>
        <button type="button" style={{ ...BTN_PRIMARY, opacity: saving ? 0.7 : 1 }} onClick={onSaveAll} disabled={saving}>
          <Save size={15} strokeWidth={2} />
          {saving ? 'Saving…' : 'Save All Changes'}
        </button>

        <div ref={moreRef} style={{ position: 'relative' }}>
          <button type="button" style={BTN_SECONDARY} onClick={() => setMoreOpen(o => !o)}>
            More Actions
            <ChevronDown size={14} strokeWidth={2} />
          </button>
          {moreOpen && (
            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 50, width: 220, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
              <button type="button" style={menuItemStyle} onClick={() => { setMoreOpen(false); onViewLogs(); }}>
                <FileClock size={15} color="#94a3b8" strokeWidth={2} /> View Config Logs
              </button>
              <button type="button" style={menuItemStyle} onClick={() => { setMoreOpen(false); onRestore(); }}>
                <RotateCcw size={15} color="#94a3b8" strokeWidth={2} /> Restore from Backup
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
