import { useContext } from 'react';
import LayoutContext from './LayoutContext';
import type { LayoutContextValue } from '../types/context/layout';

/**
 * Hook to access layout context
 */
export function useLayout(): LayoutContextValue {
    const context = useContext(LayoutContext);
    if (context === undefined) {
        throw new Error('useLayout must be used within a LayoutProvider');
    }
    return context;
}
