import { useEffect, useRef, useState } from 'react';
import { Plus, Key, ChevronDown, Webhook as WebhookIcon, List, RefreshCw, Store } from 'lucide-react';
import { BTN_PRIMARY, BTN_SECONDARY } from './shared';

interface Props {
  onAddIntegration: () => void;
  onGenerateApiKey: () => void;
  onCreateWebhook: () => void;
  onViewLogs: () => void;
  onDataSync: () => void;
  onMarketplace: () => void;
}

const MENU_ITEM: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', fontSize: 13,
  fontWeight: 500, fontFamily: 'inherit', background: 'none', border: 'none', textAlign: 'left',
  cursor: 'pointer', color: '#374151',
};

export default function IntegrationsPageHeader({
  onAddIntegration, onGenerateApiKey, onCreateWebhook, onViewLogs, onDataSync, onMarketplace,
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
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0f172a' }}>Integrations</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b' }}>
          Connect your LMS with third-party services and manage API access
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button type="button" style={BTN_SECONDARY} onClick={onAddIntegration}>
          <Plus size={15} strokeWidth={2.5} style={{ marginRight: 6, verticalAlign: -3 }} />
          Add Integration
        </button>
        <button type="button" style={BTN_PRIMARY} onClick={onGenerateApiKey}>
          <Key size={15} strokeWidth={2.5} style={{ marginRight: 6, verticalAlign: -3 }} />
          Generate API Key
        </button>

        <div ref={moreRef} style={{ position: 'relative' }}>
          <button type="button" style={BTN_SECONDARY} onClick={() => setMoreOpen(o => !o)}>
            More Actions
            <ChevronDown size={14} strokeWidth={2} style={{ marginLeft: 6, verticalAlign: -2 }} />
          </button>
          {moreOpen && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 50,
              width: 210, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
              boxShadow: '0 10px 30px rgba(0,0,0,0.12)', overflow: 'hidden',
            }}>
              <button type="button" style={MENU_ITEM} onClick={() => { setMoreOpen(false); onCreateWebhook(); }}>
                <WebhookIcon size={15} color="#94a3b8" strokeWidth={2} />
                Create Webhook
              </button>
              <button type="button" style={MENU_ITEM} onClick={() => { setMoreOpen(false); onDataSync(); }}>
                <RefreshCw size={15} color="#94a3b8" strokeWidth={2} />
                Data Sync Center
              </button>
              <button type="button" style={MENU_ITEM} onClick={() => { setMoreOpen(false); onViewLogs(); }}>
                <List size={15} color="#94a3b8" strokeWidth={2} />
                View Logs
              </button>
              <button type="button" style={MENU_ITEM} onClick={() => { setMoreOpen(false); onMarketplace(); }}>
                <Store size={15} color="#94a3b8" strokeWidth={2} />
                Marketplace
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
