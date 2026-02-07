/**
 * ColorsPage (Customization Colors Settings)
 * Wrapper for existing ColorsSection component.
 */
import React from 'react';
import { ColorsSection } from '../sections/ColorsSection';
import { useCustomizationState } from '../hooks/useCustomizationState';

export const ColorsPage: React.FC = () => {
    const state = useCustomizationState({ propSubTab: 'colors' });
    return <ColorsSection state={state} />;
};
