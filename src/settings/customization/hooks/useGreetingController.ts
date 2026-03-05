/**
 * Greeting Controller Hook
 *
 * Manages dashboard greeting state and handlers.
 * Extracted from useCustomizationState as part of S-X5-04.
 */

import { useState, useEffect, useCallback } from 'react';
import type { OriginalGreeting, GreetingState } from '../types';
import logger from '../../../utils/logger';
import { dispatchCustomEvent, CustomEventNames } from '../../../types/events';

interface UseGreetingControllerParams {
    userConfig: {
        preferences?: {
            dashboardGreeting?: {
                enabled?: boolean;
                mode?: string;
                text?: string;
                headerVisible?: boolean;
                taglineEnabled?: boolean;
                taglineText?: string;
                tones?: string[];
                loadingMessages?: boolean;
            };
        };
    } | undefined;
    initialized: boolean;
    user: { displayName?: string; username?: string } | null;
    updateUserMutation: { mutateAsync: (data: Record<string, unknown>) => Promise<unknown> };
    showSuccess: (title: string, message: string) => void;
    showError: (title: string, message: string) => void;
}

export function useGreetingController({
    userConfig,
    initialized,
    user,
    updateUserMutation,
    showSuccess,
    showError,
}: UseGreetingControllerParams): GreetingState {
    const [greetingMode, setGreetingMode] = useState<'auto' | 'manual'>('auto');
    const [greetingText, setGreetingText] = useState<string>('Welcome back, {user}');
    const [headerVisible, setHeaderVisible] = useState<boolean>(true);
    const [taglineEnabled, setTaglineEnabled] = useState<boolean>(true);
    const [taglineText, setTaglineText] = useState<string>('Your personal dashboard');
    const [tones, setTones] = useState<string[]>(['standard', 'witty', 'nerdy']);
    const [loadingMessagesEnabled, setLoadingMessagesEnabled] = useState<boolean>(true);
    const [savingGreeting, setSavingGreeting] = useState<boolean>(false);
    const [originalGreeting, setOriginalGreeting] = useState<OriginalGreeting>({
        enabled: true,
        mode: 'auto',
        text: 'Welcome back, {user}',
        headerVisible: true,
        taglineEnabled: true,
        taglineText: 'Your personal dashboard',
        tones: ['standard', 'witty', 'nerdy'],
        loadingMessages: true
    });
    const [hasGreetingChanges, setHasGreetingChanges] = useState<boolean>(false);

    // Initialize from server data
    useEffect(() => {
        if (!userConfig || !initialized) return;

        const prefs = userConfig.preferences as {
            dashboardGreeting?: {
                enabled?: boolean; mode?: string; text?: string; headerVisible?: boolean;
                taglineEnabled?: boolean; taglineText?: string; tones?: string[]; loadingMessages?: boolean;
            }
        } | undefined;

        if (prefs?.dashboardGreeting) {
            const greeting = prefs.dashboardGreeting;
            const mode = greeting.mode || 'auto';
            const text = greeting.text || 'Welcome back, {user}';
            const displayName = user?.displayName || user?.username || 'User';
            const resolvedText = text.replace(/\{user\}/gi, displayName);
            const hdrVisible = greeting.headerVisible ?? true;
            const tEnabled = greeting.taglineEnabled ?? greeting.enabled ?? true;
            const tText = greeting.taglineText || greeting.text || 'Your personal dashboard';
            setGreetingMode(mode as 'auto' | 'manual');
            setGreetingText(resolvedText);
            setHeaderVisible(hdrVisible);
            setTaglineEnabled(tEnabled);
            setTaglineText(tText);
            const gTones = greeting.tones || ['standard', 'witty', 'nerdy'];
            const gLoadingMsgs = greeting.loadingMessages ?? true;
            setTones(gTones);
            setLoadingMessagesEnabled(gLoadingMsgs);
            setOriginalGreeting({
                enabled: tEnabled,
                mode: mode as 'auto' | 'manual',
                text: resolvedText,
                headerVisible: hdrVisible,
                taglineEnabled: tEnabled,
                taglineText: tText,
                tones: gTones,
                loadingMessages: gLoadingMsgs
            });
        }
    }, [userConfig, initialized]);

    // Track changes for Greeting
    useEffect(() => {
        setHasGreetingChanges(
            greetingMode !== originalGreeting.mode ||
            greetingText !== originalGreeting.text ||
            headerVisible !== originalGreeting.headerVisible ||
            taglineEnabled !== originalGreeting.taglineEnabled ||
            taglineText !== originalGreeting.taglineText ||
            JSON.stringify(tones) !== JSON.stringify(originalGreeting.tones) ||
            loadingMessagesEnabled !== originalGreeting.loadingMessages
        );
    }, [greetingMode, greetingText, headerVisible, taglineEnabled, taglineText, tones, loadingMessagesEnabled, originalGreeting]);

    // Save greeting
    const handleSaveGreeting = useCallback(async (): Promise<void> => {
        setSavingGreeting(true);
        try {
            await updateUserMutation.mutateAsync({
                preferences: {
                    dashboardGreeting: {
                        enabled: taglineEnabled,
                        mode: greetingMode,
                        text: greetingText,
                        headerVisible,
                        taglineEnabled,
                        taglineText,
                        tones,
                        loadingMessages: loadingMessagesEnabled
                    }
                }
            });

            setOriginalGreeting({
                enabled: taglineEnabled,
                mode: greetingMode,
                text: greetingText,
                headerVisible,
                taglineEnabled,
                taglineText,
                tones,
                loadingMessages: loadingMessagesEnabled
            });

            dispatchCustomEvent(CustomEventNames.GREETING_UPDATED, {
                mode: greetingMode,
                text: greetingText,
                headerVisible,
                taglineEnabled,
                taglineText,
                tones,
                loadingMessages: loadingMessagesEnabled
            });

            // Persist to localStorage for instant splash screen preference on next load
            localStorage.setItem('framerr-loading-messages', String(loadingMessagesEnabled));

            logger.info('Greeting saved successfully');
            showSuccess('Greeting Saved', 'Dashboard greeting updated');
        } catch (error) {
            logger.error('Failed to save greeting:', error);
            showError('Save Failed', 'Failed to save greeting. Please try again.');
        } finally {
            setSavingGreeting(false);
        }
    }, [greetingMode, greetingText, headerVisible, taglineEnabled, taglineText, tones, loadingMessagesEnabled, updateUserMutation, showSuccess, showError]);

    // Reset greeting
    // [F3 Bug Fix] Fixed dep array: added `user` as dependency (previously empty [])
    const handleResetGreeting = useCallback((): void => {
        setGreetingMode('auto');
        const displayName = user?.displayName || user?.username || 'User';
        setGreetingText(`Welcome back, ${displayName}`);
        setHeaderVisible(true);
        setTaglineEnabled(true);
        setTaglineText('Your personal dashboard');
        setTones(['standard', 'witty', 'nerdy']);
        setLoadingMessagesEnabled(true);
    }, [user]);

    return {
        greetingMode,
        setGreetingMode,
        greetingText,
        setGreetingText,
        headerVisible,
        setHeaderVisible,
        taglineEnabled,
        setTaglineEnabled,
        taglineText,
        setTaglineText,
        tones,
        setTones,
        loadingMessagesEnabled,
        setLoadingMessagesEnabled,
        savingGreeting,
        hasGreetingChanges,
        handleSaveGreeting,
        handleResetGreeting,
    };
}
