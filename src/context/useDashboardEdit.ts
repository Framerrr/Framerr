import { useContext } from 'react';
import DashboardEditContext, { type DashboardEditContextValue } from './DashboardEditContext';

export function useDashboardEdit(): DashboardEditContextValue | null {
    return useContext(DashboardEditContext);
}
