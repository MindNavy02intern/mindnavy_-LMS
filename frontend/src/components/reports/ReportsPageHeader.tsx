import { useEffect, useRef, useState } from 'react';
import { Download, Calendar, ChevronDown, FileBarChart } from 'lucide-react';

interface Props {
  onExport:        () => void;
  onScheduleReport: () => void;
  onCustomReport:  () => void;
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

export default function ReportsPageHeader({ onExport, onScheduleReport, onCustomReport }: Props) {
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
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0f172a' }}>Reports &amp; Analytics</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b' }}>
          Track performance, monitor learning progress and generate insights
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button type="button" style={BTN_SECONDARY} onClick={onExport}>
          <Download size={15} strokeWidth={2} />
          Export Report
        </button>
        <button type="button" style={BTN_SECONDARY} onClick={onScheduleReport}>
          <Calendar size={15} strokeWidth={2} />
          Schedule Report
        </button>

        <div ref={moreRef} style={{ position: 'relative' }}>
          <button type="button" style={BTN_PRIMARY} onClick={() => setMoreOpen(o => !o)}>
            More Actions
            <ChevronDown size={14} strokeWidth={2} />
          </button>
          {moreOpen && (
            <div style={{
              position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 50,
              width: 200, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
              boxShadow: '0 10px 30px rgba(0,0,0,0.12)', overflow: 'hidden',
            }}>
              <button
                type="button"
                onClick={() => { setMoreOpen(false); onCustomReport(); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: '#374151' }}
              >
                <FileBarChart size={15} color="#94a3b8" strokeWidth={2} />
                Custom Report
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
