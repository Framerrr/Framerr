import { useContext } from 'react';
import { SystemConfigContext } from './SystemConfigContext';
import type { SystemConfigContextValue } from '../types/context/systemConfig';

export const useSystemConfig = (): SystemConfigContextValue => {
    const context = useContext(SystemConfigContext);
    if (!context) {
        throw new Error('useSystemConfig must be used within a SystemConfigProvider');
    }
    return context;
};
