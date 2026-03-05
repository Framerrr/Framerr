/**
 * usePlexIntegration Hook
 * 
 * Manages Plex OAuth flow, server fetching, and server selection.
 * 
 * Extracted from useIntegrationSettings. Receives activeModal,
 * activeModalRef, setIntegrations, and notification helpers as props
 * to avoid circular dependencies.
 */

import { useState, useCallback } from 'react';
import { plexApi } from '@/api';
import { usePlexOAuth, PlexUser } from '../../../hooks/usePlexOAuth';
import logger from '../../../utils/logger';
import { dispatchCustomEvent, CustomEventNames } from '../../../types/events';
import type {
    IntegrationsState,
    PlexConfig,
} from '../types';

export interface UsePlexIntegrationProps {
    activeModal: string | null;
    activeModalRef: React.RefObject<string | null>;
    integrations: IntegrationsState;
    setIntegrations: React.Dispatch<React.SetStateAction<IntegrationsState>>;
    showSuccess: (title: string, message: string) => void;
    showError: (title: string, message: string) => void;
}

export interface UsePlexIntegrationReturn {
    plexAuthenticating: boolean;
    plexLoadingServers: boolean;
    handlePlexLogin: () => Promise<void>;
    handlePlexServerChange: (machineId: string) => void;
    fetchPlexServers: (token: string) => Promise<void>;
}

export function usePlexIntegration({
    activeModal,
    activeModalRef,
    integrations,
    setIntegrations,
    showSuccess,
    showError,
}: UsePlexIntegrationProps): UsePlexIntegrationReturn {
    const [plexLoadingServers, setPlexLoadingServers] = useState(false);

    const fetchPlexServers = useCallback(async (token: string): Promise<void> => {
        if (!activeModal) return;
        const instanceId = activeModal;

        setPlexLoadingServers(true);
        try {
            const servers = await plexApi.getResources(token) || [];

            setIntegrations(prev => {
                const currentConfig = (prev[instanceId] as PlexConfig) || { enabled: true };
                let newPlex: PlexConfig = { ...currentConfig, servers, token };

                if (!currentConfig.machineId && servers.length > 0) {
                    const ownedServer = servers.find((s: { owned: boolean }) => s.owned) || servers[0];
                    newPlex = {
                        ...newPlex,
                        machineId: ownedServer.machineId,
                        url: ownedServer.connections?.find((c: { local: boolean }) => c.local)?.uri || ownedServer.connections?.[0]?.uri || ''
                    };
                }

                return { ...prev, [instanceId]: newPlex };
            });
        } catch (error) {
            logger.error('[Plex] Failed to fetch servers:', (error as Error).message);
        } finally {
            setPlexLoadingServers(false);
        }
    }, [activeModal, setIntegrations]);

    // Plex OAuth hook - uses ref to get current activeModal in callbacks
    const handlePlexAuthSuccess = useCallback(async (token: string, user: PlexUser): Promise<void> => {
        const currentInstanceId = activeModalRef.current;
        if (!currentInstanceId) return;

        setIntegrations(prev => ({
            ...prev,
            [currentInstanceId]: { ...prev[currentInstanceId], token }
        }));

        await fetchPlexServers(token);
        showSuccess('Plex Connected', `Connected as ${user.username ?? 'Plex User'}`);
        dispatchCustomEvent(CustomEventNames.LINKED_ACCOUNTS_UPDATED);
    }, [fetchPlexServers, showSuccess, activeModalRef, setIntegrations]);

    const handlePlexAuthError = useCallback((error: string): void => {
        showError('Plex Auth Failed', error);
    }, [showError]);

    const { startAuth: handlePlexLogin, isAuthenticating: plexAuthenticating } = usePlexOAuth({
        mode: 'popup',
        onSuccess: handlePlexAuthSuccess,
        onError: handlePlexAuthError
    });

    const handlePlexServerChange = useCallback((machineId: string): void => {
        if (!activeModal) return;

        const currentConfig = integrations[activeModal] as PlexConfig || {};
        const servers = currentConfig.servers || [];
        const server = servers.find((s: { machineId: string }) => s.machineId === machineId);
        const url = server?.connections?.find((c) => c.local === true)?.uri || server?.connections?.[0]?.uri || '';

        setIntegrations(prev => ({
            ...prev,
            [activeModal]: { ...prev[activeModal], machineId, url }
        }));
    }, [activeModal, integrations, setIntegrations]);

    return {
        plexAuthenticating,
        plexLoadingServers,
        handlePlexLogin,
        handlePlexServerChange,
        fetchPlexServers,
    };
}
