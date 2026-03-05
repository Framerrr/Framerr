/**
 * Test Provider Wrapper — AllProviders
 *
 * Provides the minimum viable context tree for component testing.
 * Wraps children with QueryClientProvider and MemoryRouter only.
 *
 * Heavier providers (Auth, Theme, SystemConfig, AppData, Notification, Layout)
 * have complex backend dependencies and should be mocked per-test as needed.
 *
 * NOTE: This file does not import from src/app/providers/ because that
 * directory does not exist yet. Providers currently live in src/context/.
 * When providers migrate to src/app/providers/ in a future remediation slice,
 * this wrapper will naturally update if needed.
 * See: TASK-20260301-002_WAIVER.md
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

/**
 * Creates a fresh QueryClient for each test to prevent state leakage.
 */
function createTestQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: Infinity,
            },
            mutations: {
                retry: false,
            },
        },
    });
}

/**
 * AllProviders — Minimum viable context wrapper for tests.
 *
 * Usage:
 *   import { AllProviders } from '@/test/providers';
 *   render(<MyComponent />, { wrapper: AllProviders });
 *
 * Or preferably use renderWithProviders from '@/test/render'.
 */
export function AllProviders({ children }: { children: React.ReactNode }) {
    const queryClient = createTestQueryClient();

    return (
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                {children}
            </MemoryRouter>
        </QueryClientProvider>
    );
}
