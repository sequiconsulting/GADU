import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';

// Polyfill for util._extend (deprecated in Node.js 20+) - only in Node.js environment
if (typeof globalThis !== 'undefined' && typeof globalThis.util === 'undefined' && typeof process !== 'undefined' && process.versions?.node) {
  globalThis.util = {
    _extend: Object.assign
  };
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