/**
 * Vitest Test Setup
 * 
 * This file runs before each test file.
 * Add global mocks, matchers, and setup here.
 */

import '@testing-library/jest-dom';

// Suppress console errors during tests (optional - comment out if you want to see them)
// vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock matchMedia for components that use responsive hooks
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => { },
        removeListener: () => { },
        addEventListener: () => { },
        removeEventListener: () => { },
        dispatchEvent: () => false,
    }),
});

// Mock ResizeObserver for components that use it
global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

// Mock IntersectionObserver for components that use it
global.IntersectionObserver = class IntersectionObserver {
    root = null;
    rootMargin = '';
    thresholds = [];
    observe() { }
    unobserve() { }
    disconnect() { }
    takeRecords() { return []; }
} as unknown as typeof IntersectionObserver;
