/**
 * Branding Controller Hook
 *
 * Manages application branding state and handlers (admin only).
 * Extracted from useCustomizationState as part of S-X5-04.
 *
 * Seeds from AppBrandingProvider (already loaded app-wide) so the General
 * settings page does not flash default "Framerr" / Server before the real values.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { configApi } from '../../../api/endpoints';
import type { BrandingState } from '../types';
import logger from '../../../utils/logger';
import { dispatchCustomEvent, CustomEventNames } from '../../../types/events';
import { useAppBranding } from '../../../app/providers/useAppBranding';

interface UseBrandingControllerParams {
    userIsAdmin: boolean;
    initialized: boolean;
    showSuccess: (title: string, message: string) => void;
    showError: (title: string, message: string) => void;
}

export function useBrandingController({
    userIsAdmin,
    initialized: _initialized,
    showSuccess,
    showError,
}: UseBrandingControllerParams): BrandingState {
    const { serverName, serverIcon, brandingLoaded } = useAppBranding();

    const [applicationName, setApplicationName] = useState<string>(serverName);
    const [applicationIcon, setApplicationIcon] = useState<string>(serverIcon);
    const [savingAppName, setSavingAppName] = useState<boolean>(false);
    const [originalAppName, setOriginalAppName] = useState<string>(serverName);
    const [originalAppIcon, setOriginalAppIcon] = useState<string>(serverIcon);
    const [hasAppNameChanges, setHasAppNameChanges] = useState<boolean>(false);
    const seededRef = useRef(brandingLoaded);

    // If branding was not ready on first paint, seed once when it loads.
    useEffect(() => {
        if (!userIsAdmin || !brandingLoaded || seededRef.current) return;
        setApplicationName(serverName);
        setApplicationIcon(serverIcon);
        setOriginalAppName(serverName);
        setOriginalAppIcon(serverIcon);
        seededRef.current = true;
    }, [userIsAdmin, brandingLoaded, serverName, serverIcon]);

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
