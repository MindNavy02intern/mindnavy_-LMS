export default function InvitationsTab() {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0 0 8px 8px',
      padding: '3rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      marginTop: 0,
    }}>
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>Invitations — Coming Soon</div>
      <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', maxWidth: 340 }}>
        Send, track, and manage user invitations. Backend implementation is in progress.
      </div>
    </div>
  );
}
