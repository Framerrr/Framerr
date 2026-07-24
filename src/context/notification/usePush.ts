import { useContext } from 'react';
import { PushContext, type PushContextValue } from './PushContext';

export const usePush = (): PushContextValue => {
    const context = useContext(PushContext);
    if (!context) {
        throw new Error('usePush must be used within a PushProvider');
    }
    return context;
};
