export default function LoadingSpinner() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--mn-950, #020913)',
      }}
    >
      <div className="mn-spinner" />
    </div>
  );
}
