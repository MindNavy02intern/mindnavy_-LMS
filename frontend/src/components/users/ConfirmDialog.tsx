interface Props {
  title:        string;
  body:         React.ReactNode;
  confirmLabel: string;
  confirmColor?: string;
  onConfirm:    () => void;
  onCancel:     () => void;
  loading?:     boolean;
}

export default function ConfirmDialog({
  title, body, confirmLabel, confirmColor = '#2563eb',
  onConfirm, onCancel, loading,
}: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={onCancel} />
      <div style={{
        position: 'relative', background: '#fff', borderRadius: 12,
        padding: 24, width: '100%', maxWidth: 400,
        boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
      }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#111827' }}>{title}</h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>{body}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '7px 16px', fontSize: 13, fontFamily: 'inherit',
              background: '#f9fafb', border: '1px solid #e5e7eb',
              borderRadius: 7, cursor: 'pointer', color: '#374151',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '7px 16px', fontSize: 13, fontFamily: 'inherit', fontWeight: 600,
              background: loading ? '#9ca3af' : confirmColor,
              border: 'none', borderRadius: 7,
              cursor: loading ? 'not-allowed' : 'pointer', color: '#fff',
            }}
          >
            {loading ? 'Processing…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
