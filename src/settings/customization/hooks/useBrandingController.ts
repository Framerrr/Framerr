/**
 * Branding Controller Hook
 *
 * Manages application branding state and handlers (admin only).
 * Extracted from useCustomizationState as part of S-X5-04.
 */

import { useState, useEffect, useCallback } from 'react';
import { configApi } from '../../../api/endpoints';
import { ApiError } from '../../../api/errors';
import type { BrandingState } from '../types';
import logger from '../../../utils/logger';
import { dispatchCustomEvent, CustomEventNames } from '../../../types/events';

interface UseBrandingControllerParams {
    userIsAdmin: boolean;
    initialized: boolean;
    showSuccess: (title: string, message: string) => void;
    showError: (title: string, message: string) => void;
}

export function useBrandingController({
    userIsAdmin,
    initialized,
    showSuccess,
    showError,
}: UseBrandingControllerParams): BrandingState {
    const [applicationName, setApplicationName] = useState<string>('Framerr');
    const [applicationIcon, setApplicationIcon] = useState<string>('Server');
    const [savingAppName, setSavingAppName] = useState<boolean>(false);
    const [originalAppName, setOriginalAppName] = useState<string>('Framerr');
    const [originalAppIcon, setOriginalAppIcon] = useState<string>('Server');
    const [hasAppNameChanges, setHasAppNameChanges] = useState<boolean>(false);

    // Load system config for admin (separate from user config)
    useEffect(() => {
        if (!userIsAdmin || !initialized) return;

        const loadSystemConfig = async () => {
            try {
                const systemConfig = await configApi.getSystem();

                if (systemConfig?.server?.name) {
                    const name = systemConfig.server.name;
                    setApplicationName(name);
                    setOriginalAppName(name);
                }

                if (systemConfig?.server?.icon) {
                    const icon = systemConfig.server.icon;
                    setApplicationIcon(icon);
                    setOriginalAppIcon(icon);
                }
            } catch (error) {
                // Silently ignore 403 errors (non-admin users)
                if (!(error instanceof ApiError && error.status === 403)) {
                    logger.error('Failed to load system config:', error);
                }
            }
        };

        loadSystemConfig();
    }, [userIsAdmin, initialized]);

    // Track changes for Application Name & Icon
    useEffect(() => {
        setHasAppNameChanges(
            applicationName !== originalAppName ||
            applicationIcon !== originalAppIcon
        );
    }, [applicationName, applicationIcon, originalAppName, originalAppIcon]);

    // Save application name and icon (admin only)
    const handleSaveApplicationName = useCallback(async (): Promise<void> => {
        setSavingAppName(true);
        try {
            await configApi.updateSystem({
                server: {
                    name: applicationName,
                    icon: applicationIcon
                }
            });

            dispatchCustomEvent(CustomEventNames.APP_NAME_UPDATED, {
                appName: applicationName
            });
            dispatchCustomEvent(CustomEventNames.SYSTEM_CONFIG_UPDATED);

            setOriginalAppName(applicationName);
            setOriginalAppIcon(applicationIcon);

            logger.info('Application name and icon saved successfully');
            showSuccess('Settings Saved', 'Application name and icon updated');
        } catch (error) {
            logger.error('Failed to save application name:', error);
            showError('Save Failed', 'Failed to save application name. Please try again.');
        } finally {
            setSavingAppName(false);
        }
    }, [applicationName, applicationIcon, showSuccess, showError]);

    return {
        applicationName,
        setApplicationName,
        applicationIcon,
        setApplicationIcon,
        savingAppName,
        hasAppNameChanges,
        handleSaveApplicationName,
    };
}
