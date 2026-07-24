import { useContext } from 'react';
import { IntegrationDataContext, type IntegrationDataContextValue } from './IntegrationDataProvider';

export const useIntegrationData = (): IntegrationDataContextValue => {
    const context = useContext(IntegrationDataContext);
    if (!context) {
        throw new Error('useIntegrationData must be used within an IntegrationDataProvider');
    }
    return context;
};
