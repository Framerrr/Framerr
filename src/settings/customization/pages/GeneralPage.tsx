/**
 * GeneralPage (Customization General Settings)
 * Wrapper for existing GeneralSection component.
 */
import React from 'react';
import { GeneralSection as OriginalGeneralSection } from '../sections/GeneralSection';
import { useCustomizationState } from '../hooks/useCustomizationState';

export const GeneralPage: React.FC = () => {
    const state = useCustomizationState({ propSubTab: 'general' });
    return <OriginalGeneralSection state={state} />;
};
