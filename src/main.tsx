// Import axios setup FIRST to register interceptors before any API calls
import './utils/axiosSetup';

// Suppress Recharts dimension warning (cosmetic - chart renders fine once container has size)
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('width(-1)')) return;
    originalWarn.apply(console, args);
};

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { SelectProvider } from './shared/ui';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
    <BrowserRouter>
        <SelectProvider>
            <App />
        </SelectProvider>
    </BrowserRouter>,
);

