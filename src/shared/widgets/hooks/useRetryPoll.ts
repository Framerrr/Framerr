/**
 * useRetryPoll
 *
 * Returns an async handler that POSTs to /api/realtime/retry for a given
 * SSE topic. Widgets use this as the onRetry prop for WidgetStateMessage.
 *
 * AuthZ is enforced server-side (connection ownership + DB-derived
 * integration access check via authorizeRetryTopic() in realtime.ts).
 * Client must also be actively subscribed to the topic (defense-in-depth).
 */

import { useCallback } from 'react';
import useRealtimeSSE from '@/features/realtime/useRealtimeSSE';
import api from '../../../api/client';
import logger from '../../../utils/logger';

export function useRetryPoll(
    integrationId: string | undefined,
    integrationType: string,
    subtype?: string
): (() => Promise<void>) | undefined {
    const { connectionId } = useRealtimeSSE();

    return useCallback(async (): Promise<void> => {
        if (!integrationId || !connectionId) return;
        const topic = subtype
            ? `${integrationType}:${subtype}:${integrationId}`
            : `${integrationType}:${integrationId}`;
        try {
            await api.post('/api/realtime/retry', { connectionId, topic });
        } catch (err) {
            logger.debug('[useRetryPoll] Retry request failed', { topic, error: err });
        }
    }, [integrationId, integrationType, subtype, connectionId]);
}

export default useRetryPoll;
