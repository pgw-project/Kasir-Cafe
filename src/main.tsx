import './utils/fetchInterceptor.ts';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Clear any legacy client-side fallback flags to restore real full-stack Express & Firestore operation
localStorage.removeItem('forceClientFirebase');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
