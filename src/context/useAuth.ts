import { useContext } from 'react';
import { AuthContext } from './AuthContext';
import type { AuthContextValue } from '../types/context/auth';

export const useAuth = (): AuthContextValue => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
