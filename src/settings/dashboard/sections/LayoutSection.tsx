/**
 * Layout Section Component
 * 
 * Settings component for managing dashboard layout modes.
 * Allows users to:
 * - View current mobile layout mode (synced or custom)
 * - Reconnect mobile to desktop (if independent)
 * - Reset all widgets
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { widgetsApi, configApi } from '../../../api/endpoints';
import { Link, RefreshCw, Trash2, Smartphone, LayoutGrid, PanelLeftClose, Monitor } from 'lucide-react';
import { Button, Switch, ConfirmDialog } from '../../../shared/ui';
import { SettingsPage, SettingsSection, SettingsItem } from '../../../shared/ui/settings';
import { useLayout } from '../../../context/LayoutContext';
import logger from '../../../utils/logger';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import { useSidebarUI } from '../../../components/sidebar/context/SidebarUIContext';
import { useWalkthrough } from '../../../features/walkthrough';

type MobileLayoutMode = 'linked' | 'independent';

interface LayoutSectionProps {
    className?: string;
}

/**
 * Sidebar auto-hide toggle - separate component because it uses SidebarUI context
 */
function SidebarAutoHideToggle() {
    const { isSidebarHidden, setSidebarHidden } = useSidebarUI();
    return (
        <SettingsItem
            label="Auto-hide Sidebar"
            description="Automatically hide the sidebar to maximize dashboard space. Hover the left edge to peek, or slide to the edge of the screen to open."
            icon={PanelLeftClose}
            iconColor="text-accent"
        >
            <Switch
                checked={isSidebarHidden}
                onCheckedChange={(checked) => setSidebarHidden(checked)}
            />
        </SettingsItem>
    );
}

/**
 * Square cells toggle - experimental feature for auto cell height
 */
function SquareCellsToggle() {
    const [squareCells, setSquareCells] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const response = await configApi.getUser();
                if (response?.preferences?.squareCells) setSquareCells(true);
            } catch { /* ignore */ }
        };
        load();
    }, []);

    const handleChange = async (checked: boolean) => {
        setSquareCells(checked);
        try {
            await configApi.updateUser({
                preferences: { squareCells: checked }
            });
            window.dispatchEvent(new CustomEvent('user-preferences-changed', {
                detail: { squareCells: checked }
            }));
        } catch (error) {
            logger.error('Failed to save square cells preference:', { error });
            setSquareCells(!checked);
        }
    };

    return (
        <SettingsItem
            label={
                <span className="flex items-center gap-2">
                    Square Cells
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent font-medium uppercase tracking-wider">Experimental</span>
                </span>
            }
            description="Make each grid cell height equal to its width, creating square proportions. Widget heights will change dynamically with window size."
            icon={LayoutGrid}
            iconColor="text-accent"
        >
            <Switch
                checked={squareCells}
                onCheckedChange={handleChange}
            />
        </SettingsItem>
    );
}

export function LayoutSection({ className = '' }: LayoutSectionProps) {
    const { isMobile } = useLayout();
    const [mobileLayoutMode, setMobileLayoutMode] = useState<MobileLayoutMode>('linked');
    const [widgetCount, setWidgetCount] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [showReconnectModal, setShowReconnectModal] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [hideMobileEditButton, setHideMobileEditButton] = useState(false);
    const [tourReset, setTourReset] = useState(false);
    const walkthrough = useWalkthrough();

    // Load current state
    const loadDashboardState = async (): Promise<void> => {
        try {
            const response = await widgetsApi.getAll();
            setMobileLayoutMode(response.mobileLayoutMode || 'linked');
            setWidgetCount(response.widgets?.length || 0);
        } catch (error) {
            logger.error('Failed to load dashboard state:', { error });
        } finally {
            setLoading(false);
        }
    };

    // Load user preferences
    const loadUserPreferences = async (): Promise<void> => {
        try {
            const response = await configApi.getUser();
            if (response?.preferences?.hideMobileEditButton) {
                setHideMobileEditButton(true);
            }
        } catch (error) {
            logger.debug('Could not load user preferences');
        }
    };

    // Toggle hide mobile edit button preference
    const handleToggleHideMobileEditButton = async (): Promise<void> => {
        const newValue = !hideMobileEditButton;
        setHideMobileEditButton(newValue);
        try {
            await configApi.updateUser({
                preferences: { hideMobileEditButton: newValue }
            });
            // Dispatch event to notify Dashboard of the preference change
            window.dispatchEvent(new CustomEvent('user-preferences-changed', {
                detail: { hideMobileEditButton: newValue }
            }));
        } catch (error) {
            logger.error('Failed to save preference:', { error });
            // Revert on error
            setHideMobileEditButton(!newValue);
        }
    };

    useEffect(() => {
        loadDashboardState();
        loadUserPreferences();
    }, []);

    // Listen for dashboard updates to refresh state automatically
    useEffect(() => {
        const handleWidgetsUpdate = (): void => {
            loadDashboardState();
        };

        window.addEventListener('widgets-added', handleWidgetsUpdate);
        window.addEventListener('mobile-layout-mode-changed', handleWidgetsUpdate);
        return () => {
            window.removeEventListener('widgets-added', handleWidgetsUpdate);
            window.removeEventListener('mobile-layout-mode-changed', handleWidgetsUpdate);
        };
    }, []);

    const handleReconnect = async (): Promise<void> => {
        try {
            setActionLoading(true);
            await widgetsApi.reconnectMobile();
            setMobileLayoutMode('linked');
            setShowReconnectModal(false);
            // Reload dashboard
            window.dispatchEvent(new CustomEvent('widgets-added'));
        } catch (error) {
            logger.error('Failed to reconnect mobile dashboard:', { error });
        } finally {
            setActionLoading(false);
        }
    };

    const handleReset = async (): Promise<void> => {
        try {
            setActionLoading(true);
            await widgetsApi.reset();
            setMobileLayoutMode('linked');
            setShowResetModal(false);
            // Reload dashboard
            window.dispatchEvent(new CustomEvent('widgets-added'));
        } catch (error) {
            logger.error('Failed to reset dashboard:', { error });
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className={`rounded-xl p-6 border border-theme bg-theme-secondary ${className}`}>
                <div className="flex items-center justify-center py-4">
                    <LoadingSpinner size="md" />
                </div>
            </div>
        );
    }

    return (
        <SettingsPage
            title="General"
            description="Manage your dashboard layout and preferences"
        >
            {/* General Section */}
            <SettingsSection title="General" icon={LayoutGrid}>
                {/* Reset All Widgets */}
                <SettingsItem
                    label="Reset Dashboard"
                    description="Remove all widgets from your dashboard. This cannot be undone."
                    icon={Trash2}
                    iconColor="text-error"
                >
                    <Button
                        variant="danger"
                        size="md"
                        textSize="sm"
                        onClick={() => setShowResetModal(true)}
                        disabled={actionLoading || widgetCount === 0}
                    >
                        Reset All Widgets
                    </Button>
                </SettingsItem>

                {/* Reset Welcome Tour */}
                <SettingsItem
                    label="Reset Welcome Tour"
                    description="Replay the walkthrough that introduces you to Framerr. The tour will start next time you visit the dashboard."
                    icon={RefreshCw}
                    iconColor="text-accent"
                >
                    <Button
                        variant="secondary"
                        size="md"
                        textSize="sm"
                        onClick={() => {
                            walkthrough?.resetAndStartFlow('onboarding');
                            setTourReset(true);
                        }}
                        disabled={tourReset}
                    >
                        {tourReset ? 'Tour Reset!' : 'Reset Tour'}
                    </Button>
                </SettingsItem>
            </SettingsSection>

            {/* Desktop Section */}
            <SettingsSection title="Desktop" icon={Monitor}>
                {/* Auto-hide Sidebar Toggle */}
                <SidebarAutoHideToggle />

                {/* Square Cells Toggle (Experimental) */}
                <SquareCellsToggle />
            </SettingsSection>

            {/* Mobile Section */}
            <SettingsSection title="Mobile" icon={Smartphone}>
                {/* Mobile Layout Status */}
                <SettingsItem
                    label="Mobile Layout"
                    description={mobileLayoutMode === 'linked'
                        ? 'Synced with desktop - changes on desktop automatically update mobile'
                        : 'Custom layout - mobile and desktop are independent'}
                >
                    <div className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${mobileLayoutMode === 'linked'
                        ? 'bg-success/20 text-success'
                        : 'bg-warning/20 text-warning'
                        }`}>
                        {mobileLayoutMode === 'linked' ? 'Linked' : 'Independent'}
                    </div>
                </SettingsItem>

                {/* Hide Mobile Edit Button Toggle */}
                <SettingsItem
                    label="Hide Mobile Edit Button"
                    description="Hide the Edit button on mobile. You can still enter edit mode by swiping up on the bottom tab bar."
                    icon={Smartphone}
                    iconColor="text-accent"
                >
                    <Switch
                        checked={hideMobileEditButton}
                        onCheckedChange={handleToggleHideMobileEditButton}
                    />
                </SettingsItem>

                {/* Reconnect Button (only when independent) */}
                <AnimatePresence>
                    {mobileLayoutMode === 'independent' && (
                        <SettingsItem
                            key="reconnect-item"
                            label="Reconnect to Desktop"
                            description="Resync your mobile layout with desktop. Your mobile customizations will be replaced with the desktop layout."
                            icon={Link}
                            iconColor="text-accent"
                            noAnimation
                        >
                            <Button
                                variant="secondary"
                                onClick={() => setShowReconnectModal(true)}
                                disabled={actionLoading}
                            >
                                Reconnect Mobile
                            </Button>
                        </SettingsItem>
                    )}
                </AnimatePresence>
            </SettingsSection>

            {/* Reconnect Confirmation Dialog */}
            <ConfirmDialog
                open={showReconnectModal}
                onOpenChange={(open) => !open && setShowReconnectModal(false)}
                onConfirm={handleReconnect}
                title="Reconnect Mobile Layout?"
                message={`Your custom mobile layout will be replaced with the current desktop layout. Any mobile-only widgets will be removed.\n\nAfter reconnecting, changes made on desktop will automatically update mobile.`}
                confirmLabel={actionLoading ? 'Reconnecting...' : 'Reconnect'}
                variant="warning"
                loading={actionLoading}
            />

            {/* Reset Confirmation Dialog */}
            <ConfirmDialog
                open={showResetModal}
                onOpenChange={(open) => !open && setShowResetModal(false)}
                onConfirm={handleReset}
                title="Reset All Widgets?"
                message={`This will permanently delete all widgets from both your desktop and mobile dashboards.\n\nThis action cannot be undone. You will start with an empty dashboard.`}
                confirmLabel={actionLoading ? 'Resetting...' : 'Reset Dashboard'}
                variant="danger"
                loading={actionLoading}
            />
        </SettingsPage>
    );
}
