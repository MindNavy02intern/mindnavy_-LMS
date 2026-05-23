import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './styles/brand.css';
import './index.css';
import App from './App';
import { AuthProvider } from './AuthContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* AuthProvider makes user/profile/signOut available to every component */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
