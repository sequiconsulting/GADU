import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Polyfill for util._extend (deprecated in Node.js 20+)
if (typeof (global as any).util === 'undefined' && typeof window !== 'undefined') {
  (global as any).util = {
    _extend: Object.assign
  };
}

// Increase MaxListenersExceeded limit for Netlify dev environment
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
  try {
    const http = require('http');
    const https = require('https');
    http.IncomingMessage?.setMaxListeners?.(50);
    https.IncomingMessage?.setMaxListeners?.(50);
  } catch (e) {
    // Silently ignore if modules not available
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);