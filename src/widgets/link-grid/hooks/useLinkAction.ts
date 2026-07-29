import { useState, useCallback } from 'react';
import axios, { AxiosRequestConfig } from 'axios';
import logger from '../../../utils/logger';
import type { Link, LinkState } from '../types';

export function useLinkAction(link: Link): { state: LinkState; execute: () => Promise<void> } {
    const [state, setState] = useState<LinkState>('idle');

    const execute = useCallback(async (): Promise<void> => {
        if (!link.action) {
            logger.error('No action configured for link', link);
            return;
        }

        const { method = 'GET', url, headers = {}, body = null } = link.action;

        setState('loading');

        try {
            logger.debug(`Executing ${method} action:`, url);

            const requestConfig: AxiosRequestConfig = {
                method: method.toLowerCase(),
                url,
                headers,
            };

            if (body && ['post', 'put', 'patch'].includes(method.toLowerCase())) {
                requestConfig.data = body;
            }

            const response = await axios(requestConfig);

            logger.debug(`Action successful:`, response.status);

            setState('success');
            setTimeout(() => setState('idle'), 2000);
        } catch (error) {
            logger.error(`Action failed:`, error);
            setState('error');
            setTimeout(() => setState('idle'), 2000);
        }
    }, [link]);

    return { state, execute };
}
