import { useEffect, useRef, useState } from 'react';
import { Send, Megaphone, ChevronDown, FileText, Zap, AlertTriangle, List } from 'lucide-react';

interface Props {
  onSendNotification: () => void;
  onCreateAnnouncement: () => void;
  onCreateTemplate: () => void;
  onCreateAutomation: () => void;
  onEmergencyAlert: () => void;
  onViewLogs: () => void;
}

const BTN_PRIMARY: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '10px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
  background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
};

const BTN_SECONDARY: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '10px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
  background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer',
};

const MENU_ITEM: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', fontSize: 13,
  fontWeight: 500, fontFamily: 'inherit', background: 'none', border: 'none', textAlign: 'left',
  cursor: 'pointer', color: '#374151',
};

export default function NotificationsPageHeader({
  onSendNotification, onCreateAnnouncement, onCreateTemplate, onCreateAutomation, onEmergencyAlert, onViewLogs,
}: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0f172a' }}>Notifications</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b' }}>
          Manage notifications, announcements and delivery campaigns
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button type="button" style={BTN_SECONDARY} onClick={onCreateAnnouncement}>
          <Megaphone size={15} strokeWidth={2} />
          Create Announcement
        </button>
        <button type="button" style={BTN_PRIMARY} onClick={onSendNotification}>
          <Send size={15} strokeWidth={2.5} />
          Send Notification
        </button>

        <div ref={moreRef} style={{ position: 'relative' }}>
          <button type="button" style={BTN_SECONDARY} onClick={() => setMoreOpen(o => !o)}>
            More Actions
            <ChevronDown size={14} strokeWidth={2} />
          </button>
          {moreOpen && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 50,
              width: 220, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
              boxShadow: '0 10px 30px rgba(0,0,0,0.12)', overflow: 'hidden',
            }}>
              <button type="button" style={MENU_ITEM} onClick={() => { setMoreOpen(false); onCreateTemplate(); }}>
                <FileText size={15} color="#94a3b8" strokeWidth={2} />
                Create Template
              </button>
              <button type="button" style={MENU_ITEM} onClick={() => { setMoreOpen(false); onCreateAutomation(); }}>
                <Zap size={15} color="#94a3b8" strokeWidth={2} />
                Create Automation
              </button>
              <button type="button" style={MENU_ITEM} onClick={() => { setMoreOpen(false); onViewLogs(); }}>
                <List size={15} color="#94a3b8" strokeWidth={2} />
                Delivery Logs
              </button>
              <button type="button" style={{ ...MENU_ITEM, color: '#dc2626' }} onClick={() => { setMoreOpen(false); onEmergencyAlert(); }}>
                <AlertTriangle size={15} color="#dc2626" strokeWidth={2} />
                Emergency Alert
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
