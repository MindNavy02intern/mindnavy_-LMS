// Learners page header. Mirrors InstructorsPageHeader.tsx. "More Actions" has
// no Pending-Applications-style queue to link to (Learners has no application
// flow) — its one item is Bulk Enroll, opening BulkEnrollLearnersModal.

import { useEffect, useRef, useState } from 'react';
import { Plus, Upload, Download, ChevronDown, Users } from 'lucide-react';

interface LearnersPageHeaderProps {
  onAddLearner:     () => void;
  onImportLearners: () => void;
  onExportLearners: () => void;
  onBulkEnroll:     () => void;
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

export default function LearnersPageHeader({
  onAddLearner, onImportLearners, onExportLearners, onBulkEnroll,
}: LearnersPageHeaderProps) {
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
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0f172a' }}>Learners</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#64748b' }}>
          Manage learners, enrollments, progress and compliance
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button type="button" style={BTN_PRIMARY} onClick={onAddLearner}>
          <Plus size={16} strokeWidth={2.5} />
          Add Learner
        </button>
        <button type="button" style={BTN_SECONDARY} onClick={onImportLearners}>
          <Upload size={15} strokeWidth={2} />
          Import Learners
        </button>
        <button type="button" style={BTN_SECONDARY} onClick={onExportLearners}>
          <Download size={15} strokeWidth={2} />
          Export
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
              <button
                type="button"
                onClick={() => { setMoreOpen(false); onBulkEnroll(); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '10px 14px', fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                  background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: '#374151',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
              >
                <Users size={15} color="#64748b" strokeWidth={2} />
                Bulk Enroll
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
