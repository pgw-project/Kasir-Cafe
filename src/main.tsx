import './utils/fetchInterceptor.ts';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Conditionally manage client-side Firestore/LocalStorage fallback
// In development containers (Cloud Run / localhost dev), we clear it to use the full-stack server.
// On static production hosts (Netlify, Vercel, etc.), we force it immediately for instant, pure client-side operation.
const isCloudRun = window.location.hostname.includes('run.app');
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

if (isCloudRun || (isLocalhost && import.meta.env.DEV)) {
  localStorage.removeItem('forceClientFirebase');
} else {
  localStorage.setItem('forceClientFirebase', 'true');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
