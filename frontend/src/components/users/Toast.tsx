import { useState, useCallback } from 'react';

export type ToastType = 'success' | 'error';

interface ToastItem { id: string; type: ToastType; message: string; }

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts(prev => [...prev, { id, type, message }]);
    if (type === 'success') {
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
    }
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, showToast, dismiss };
}

// ── ToastContainer ─────────────────────────────────────────────────────────────

interface ContainerProps {
  toasts:    ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ContainerProps) {
  if (toasts.length === 0) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8,
      pointerEvents: 'none',
    }}>
      <style>{`@keyframes mn-toast-in { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:none; } }`}</style>
      {toasts.map(t => (
        <div
          key={t.id}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px',
            background: t.type === 'success' ? '#16a34a' : '#dc2626',
            color: '#fff', borderRadius: 8,
            boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
            fontSize: 13, fontWeight: 500,
            minWidth: 260, maxWidth: 360,
            animation: 'mn-toast-in 0.22s ease',
            pointerEvents: 'all',
          }}
        >
          {t.type === 'success'
            ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          }
          <span style={{ flex: 1 }}>{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            style={{
              background: 'rgba(255,255,255,0.2)', border: 'none',
              borderRadius: 4, padding: '1px 7px',
              cursor: 'pointer', color: '#fff', fontSize: 12,
              fontFamily: 'inherit', lineHeight: 1.4,
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
