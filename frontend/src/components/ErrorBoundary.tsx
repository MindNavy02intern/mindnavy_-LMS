import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Class component required — getDerivedStateFromError/componentDidCatch have
// no hook equivalent. Catches render errors and failed lazy-chunk imports
// (App.tsx wraps every route in <Suspense>, which had no error boundary —
// either failure mode was a blank page or a stuck spinner, no visible error).
// The call site in App.tsx keys this by route pathname, so navigating away
// from a broken route remounts a fresh boundary automatically; Retry below
// covers re-attempting without navigating.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', gap: 16, padding: 24, textAlign: 'center',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#b91c1c' }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: '#6b7280', maxWidth: 480, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            {this.state.error.message}
          </div>
          <button
            onClick={this.handleRetry}
            style={{
              padding: '8px 18px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
