import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './styles/brand.css';
import './index.css';
import App from './App';
import { AuthProvider } from './AuthContext';

// Global safety net for errors React's own error boundary can't catch
// (event handlers, timers, and any rejected promise) — previously these
// were silently swallowed with nothing in the console.
window.onerror = (message, source, lineno, colno, error) => {
  console.error('[window.onerror]', message, { source, lineno, colno, error });
};
window.onunhandledrejection = (event) => {
  console.error('[unhandledrejection]', event.reason);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* AuthProvider makes user/profile/signOut available to every component */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
