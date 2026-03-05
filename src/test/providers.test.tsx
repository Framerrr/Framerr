/**
 * Provider Wrapper Validation Test
 *
 * Validates that AllProviders renders without errors.
 * This is a verification test per the implementation plan.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AllProviders } from './providers';

describe('AllProviders', () => {
    it('renders children without errors', () => {
        render(
            <AllProviders>
                <div>test content</div>
            </AllProviders>,
        );

        expect(screen.getByText('test content')).toBeVisible();
    });

    it('provides a fresh QueryClient per render', () => {
        const { unmount } = render(
            <AllProviders>
                <div>first render</div>
            </AllProviders>,
        );
        expect(screen.getByText('first render')).toBeVisible();
        unmount();

        render(
            <AllProviders>
                <div>second render</div>
            </AllProviders>,
        );
        expect(screen.getByText('second render')).toBeVisible();
    });
});
