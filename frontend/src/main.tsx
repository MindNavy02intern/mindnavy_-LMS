import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { AuthProvider } from './AuthContext'; // 1. أضفنا هذا السطر هنا

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* 2. غلفنا الـ App بالـ AuthProvider لحتى يراقب حالة تسجيل الدخول بالموقع كله */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)