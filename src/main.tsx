import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevents Vite HMR / WebSocket close error from throwing uncaught React child errors when switching tabs
if (typeof window !== 'undefined') {
  const ignoreErrors = ['websocket', 'vite', 'hmr', 'unhandledRejection'];
  
  window.addEventListener('error', (event) => {
    const msg = event?.message || '';
    if (ignoreErrors.some(k => msg.toLowerCase().includes(k))) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const msg = reason?.message || String(reason || '');
    if (ignoreErrors.some(k => msg.toLowerCase().includes(k)) || (reason && typeof reason === 'object' && 'code' in reason)) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  });
}

import { ErrorBoundary } from './components/ErrorBoundary.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

