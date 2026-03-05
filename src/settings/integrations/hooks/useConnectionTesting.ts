/**
 * useConnectionTesting Hook
 * 
 * Manages connection test state and the handleTest callback
 * for integration settings.
 * 
 * Extracted from useIntegrationSettings.
 */

import { useState, useCallback } from 'react';
import { integrationsApi } from '@/api';
import { ApiError } from '@/api/errors';
import type {
    IntegrationsState,
    TestState,
    IntegrationConfig,
} from '../types';

export interface UseConnectionTestingProps {
    integrations: IntegrationsState;
}

export interface UseConnectionTestingReturn {
    testStates: Record<string, TestState | null>;
    handleTest: (instanceId: string) => Promise<void>;
}

export function useConnectionTesting({ integrations }: UseConnectionTestingProps): UseConnectionTestingReturn {
    const [testStates, setTestStates] = useState<Record<string, TestState | null>>({});

    const handleTest = useCallback(async (instanceId: string): Promise<void> => {
        const config = integrations[instanceId];
        if (!config) {
            setTestStates(prev => ({
                ...prev,
                [instanceId]: { loading: false, success: false, message: '✗ No config found' }
            }));
            return;
        }

        const type = (config as { _type?: string })._type;
        if (!type) {
            setTestStates(prev => ({
                ...prev,
                [instanceId]: { loading: false, success: false, message: '✗ Unknown integration type' }
            }));
            return;
        }

        setTestStates(prev => ({ ...prev, [instanceId]: { loading: true } }));
        try {
            const { _instanceId, _displayName, _type, enabled, ...configWithoutMeta } = config as IntegrationConfig & { _instanceId?: string; _displayName?: string; _type?: string };

            const result = await integrationsApi.testByConfig(type, configWithoutMeta, instanceId.startsWith('new-') ? undefined : instanceId);

            setTestStates(prev => ({
                ...prev,
                [instanceId]: {
                    loading: false,
                    success: result.success,
                    message: result.success
                        ? `✓ ${result.message || 'Connection successful'}`
                        : `✗ ${result.error}`
                }
            }));

            setTimeout(() => {
                setTestStates(prev => ({ ...prev, [instanceId]: null }));
            }, 5000);
        } catch (error) {
            const apiError = error as ApiError;
            setTestStates(prev => ({
                ...prev,
                [instanceId]: {
                    loading: false,
                    success: false,
                    message: `✗ ${apiError.message || 'Connection failed'}`
                }
            }));
        }
    }, [integrations]);

    return { testStates, handleTest };
}
