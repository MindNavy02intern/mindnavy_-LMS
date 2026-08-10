import { useEffect, useRef, useState } from 'react';
import { Download, FilePlus2, ChevronDown, Calculator, Ticket, Percent } from 'lucide-react';
import { BTN_PRIMARY, BTN_SECONDARY } from './_shared';

interface Props {
  onExport:           () => void;
  onGenerateInvoice:  () => void;
  onCalculatePayouts: () => void;
  onManageCoupons:    () => void;
  onTaxSettings:      () => void;
}

export default function FinancePageHeader({ onExport, onGenerateInvoice, onCalculatePayouts, onManageCoupons, onTaxSettings }: Props) {
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
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0f172a' }}>Finance</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b' }}>
          Manage payments, subscriptions, invoices and financial analytics
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button type="button" style={BTN_SECONDARY} onClick={onExport}>
          <Download size={15} strokeWidth={2} />
          Export Financial Data
        </button>
        <button type="button" style={BTN_PRIMARY} onClick={onGenerateInvoice}>
          <FilePlus2 size={16} strokeWidth={2.5} />
          Generate Invoice
        </button>

        <div ref={moreRef} style={{ position: 'relative' }}>
          <button type="button" style={BTN_SECONDARY} onClick={() => setMoreOpen(o => !o)}>
            More Actions
            <ChevronDown size={14} strokeWidth={2} />
          </button>
          {moreOpen && (
            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 50, width: 220, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
              <button type="button" style={menuItemStyle} onClick={() => { setMoreOpen(false); onCalculatePayouts(); }}>
                <Calculator size={15} color="#94a3b8" strokeWidth={2} /> Calculate Payouts
              </button>
              <button type="button" style={menuItemStyle} onClick={() => { setMoreOpen(false); onManageCoupons(); }}>
                <Ticket size={15} color="#94a3b8" strokeWidth={2} /> Manage Coupons
              </button>
              <button type="button" style={menuItemStyle} onClick={() => { setMoreOpen(false); onTaxSettings(); }}>
                <Percent size={15} color="#94a3b8" strokeWidth={2} /> Tax Management
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
