/**
 * Custom Render Utility — renderWithProviders
 *
 * Wraps React Testing Library's render with AllProviders and
 * provides a pre-configured userEvent instance for convenience.
 *
 * Usage:
 *   import { renderWithProviders, screen } from '@/test/render';
 *
 *   test('renders component', () => {
 *     const { user } = renderWithProviders(<MyComponent />);
 *     await user.click(screen.getByRole('button'));
 *   });
 */
import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AllProviders } from './providers';

type CustomRenderOptions = Omit<RenderOptions, 'wrapper'>;

/**
 * Renders a component wrapped in AllProviders with a pre-configured
 * userEvent instance for simulating user interactions.
 */
export function renderWithProviders(
    ui: React.ReactElement,
    options?: CustomRenderOptions,
) {
    const user = userEvent.setup();
    const renderResult = render(ui, { wrapper: AllProviders, ...options });

    return {
        user,
        ...renderResult,
    };
}

// Re-export commonly used utilities for single-import convenience
export { screen, waitFor, within, act } from '@testing-library/react';
export { userEvent };
