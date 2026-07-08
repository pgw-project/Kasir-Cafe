import './utils/fetchInterceptor.ts';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import App from './App.tsx';
import './index.css';

// We default to full-stack Express backend, and the fetchInterceptor handles dynamic, 
// resilient client-side LocalStorage/Firestore fallback automatically if the server is unreachable.
// No permanent force-locking in localStorage is needed, enabling seamless custom domains in production.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
