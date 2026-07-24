/**
 * useRequestFlow Hook
 *
 * Extracts Overseerr request state management from MediaSearchWidget.
 * Manages inline/modal request flow, item request states, and server prefetch.
 */

import { useState, useCallback, useEffect } from 'react';
import { useOverseerrRequest, needsModal, getDefaultServerId } from './useOverseerrRequest';
import { getInitialRequestState } from '../components/requestButtonState';
import { useNotification } from '@/shared/hooks/useNotification';
import type { OverseerrMediaResult, RequestButtonState } from '../types';

interface UseRequestFlowOptions {
    overseerrIntegrationIds: string[];
}

interface UseRequestFlowReturn {
    requestModalItem: OverseerrMediaResult | null;
    setRequestModalItem: (item: OverseerrMediaResult | null) => void;
    getItemState: (item: OverseerrMediaResult) => RequestButtonState;
    handleRequestClick: (item: OverseerrMediaResult) => void;
    handleModalComplete: (success: boolean) => void;
    firstOverseerrId: string;
    overseerrServers: ReturnType<typeof useOverseerrRequest>['servers'];
}

export function useRequestFlow({
    overseerrIntegrationIds,
}: UseRequestFlowOptions): UseRequestFlowReturn {
    const [requestModalItem, setRequestModalItem] = useState<OverseerrMediaResult | null>(null);
    const [itemRequestStates, setItemRequestStates] = useState<Map<number, RequestButtonState>>(new Map());
    const { success: toastSuccess, error: toastError } = useNotification();

    // Phase 4: Overseerr request hook (uses first configured Overseerr instance)
    const firstOverseerrId = overseerrIntegrationIds[0] || '';
    const {
        servers: overseerrServers,
        fetchServers: fetchOverseerrServers,
        submitRequest: submitOverseerrRequest,
    } = useOverseerrRequest({ overseerrInstanceId: firstOverseerrId });

    // Fetch servers once when we have Overseerr
    useEffect(() => {
        if (firstOverseerrId) fetchOverseerrServers();
    }, [firstOverseerrId, fetchOverseerrServers]);

    // Get or initialize request state for an Overseerr item
    const getItemState = useCallback((item: OverseerrMediaResult): RequestButtonState => {
        return itemRequestStates.get(item.id) ?? getInitialRequestState(item);
    }, [itemRequestStates]);

    // Handle inline request button click
    const handleRequestClick = useCallback(async (item: OverseerrMediaResult) => {
        // Check if we need a modal (TV show or 4K available)
        if (needsModal(item, overseerrServers)) {
            setRequestModalItem(item);
            return;
        }

        // Inline fire for simple cases (movie, single non-4K server)
        setItemRequestStates(prev => new Map(prev).set(item.id, 'loading'));

        try {
            const serverId = getDefaultServerId(item, overseerrServers);
            await submitOverseerrRequest({
                mediaType: item.mediaType === 'tv' ? 'tv' : 'movie',
                mediaId: item.id,
                serverId,
            });

            setItemRequestStates(prev => new Map(prev).set(item.id, 'success'));
            toastSuccess('Request Sent', `${item.title || item.name || 'Title'} has been requested`);

            // Transition to permanent "requested" after brief success display
            setTimeout(() => {
                setItemRequestStates(prev => new Map(prev).set(item.id, 'requested'));
            }, 1500);
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Request failed';
            setItemRequestStates(prev => new Map(prev).set(item.id, 'error'));

            // Context-aware toast messages
            if (msg.includes('link your') || msg.includes('403')) {
                toastError('Account Required', 'Link your Overseerr account to make requests');
            } else if (msg.includes('already') || msg.includes('409')) {
                toastError('Already Requested', `${item.title || item.name} has already been requested`);
            } else {
                toastError('Request Failed', msg);
            }

            // Auto-reset to idle after 1s
            setTimeout(() => {
                setItemRequestStates(prev => new Map(prev).set(item.id, 'idle'));
            }, 1000);
        }
    }, [overseerrServers, submitOverseerrRequest, toastSuccess, toastError]);

    // Handle modal request completion
    // For TV: success=true means ALL seasons requested, success=false means partial (more to go)
    const handleModalComplete = useCallback((success: boolean) => {
        if (!requestModalItem) return;

        if (success) {
            toastSuccess('Request Sent', `${requestModalItem.title || requestModalItem.name || 'Title'} has been requested`);
            // All done — show success → requested transition on inline button
            setItemRequestStates(prev => new Map(prev).set(requestModalItem.id, 'success'));
            setTimeout(() => {
                setItemRequestStates(prev => new Map(prev).set(requestModalItem.id, 'requested'));
            }, 1500);
        }
        // If !success: either error (modal shows inline error) or TV partial (user can request more)
    }, [requestModalItem, toastSuccess]);

    return {
        requestModalItem,
        setRequestModalItem,
        getItemState,
        handleRequestClick,
        handleModalComplete,
        firstOverseerrId,
        overseerrServers,
    };
}
