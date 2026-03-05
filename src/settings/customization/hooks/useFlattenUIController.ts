/**
 * Flatten UI Controller Hook
 *
 * Manages the "Reduce Transparency" / solid-ui toggle.
 * Extracted from useCustomizationState as part of S-X5-04.
 */

import { useState, useEffect, useCallback } from 'react';
import type { FlattenUIState } from '../types';
import logger from '../../../utils/logger';

interface UseFlattenUIControllerParams {
    userConfig: {
        preferences?: {
            ui?: { flattenUI?: boolean };
        };
    } | undefined;
    initialized: boolean;
    updateUserMutation: { mutateAsync: (data: Record<string, unknown>) => Promise<unknown> };
    showError: (title: string, message: string) => void;
}

export function useFlattenUIController({
    userConfig,
    initialized,
    updateUserMutation,
    showError,
}: UseFlattenUIControllerParams): FlattenUIState {
    const [flattenUI, setFlattenUI] = useState<boolean>(false);
    const [savingFlattenUI, setSavingFlattenUI] = useState<boolean>(false);

    // Initialize from server data
    useEffect(() => {
        if (!userConfig || !initialized) return;

        const prefs = userConfig.preferences as { ui?: { flattenUI?: boolean } } | undefined;
        if (prefs?.ui?.flattenUI !== undefined) {
            const shouldFlatten = prefs.ui.flattenUI;
            setFlattenUI(shouldFlatten);
            if (shouldFlatten) {
                document.documentElement.classList.add('solid-ui');
            }
        }
    }, [userConfig, initialized]);

    // Toggle solid UI mode (optimistic update)
    const handleToggleFlattenUI = useCallback(async (value: boolean): Promise<void> => {
        const previousValue = flattenUI;

        // Optimistic update
        setFlattenUI(value);
        if (value) {
            document.documentElement.classList.add('solid-ui');
        } else {
            document.documentElement.classList.remove('solid-ui');
        }

        setSavingFlattenUI(true);
        try {
            await updateUserMutation.mutateAsync({
                preferences: { ui: { flattenUI: value } }
            });
            logger.info('Solid UI preference saved');
        } catch (error) {
            // Rollback on error
            logger.error('Failed to save solid UI preference:', error);
            showError('Save Failed', 'Failed to save solid UI preference.');

            setFlattenUI(previousValue);
            if (previousValue) {
                document.documentElement.classList.add('solid-ui');
            } else {
                document.documentElement.classList.remove('solid-ui');
            }
        } finally {
            setSavingFlattenUI(false);
        }
    }, [flattenUI, updateUserMutation, showError]);

    return {
        flattenUI,
        savingFlattenUI,
        handleToggleFlattenUI,
    };
}
