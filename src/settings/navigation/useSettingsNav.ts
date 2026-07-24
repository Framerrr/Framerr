import { useContext } from 'react';
import SettingsNavContext, { type SettingsNavContextValue } from './SettingsNavContext';

export function useSettingsNav(): SettingsNavContextValue {
    const context = useContext(SettingsNavContext);
    if (context === undefined) {
        throw new Error('useSettingsNav must be used within a SettingsNavProvider');
    }
    return context;
}
