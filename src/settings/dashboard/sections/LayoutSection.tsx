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
import { Link, RefreshCw, Trash2, AlertTriangle, Smartphone, LayoutGrid } from 'lucide-react';
import { Button, Switch } from '../../../shared/ui';
import { SettingsPage, SettingsSection, SettingsItem } from '../../../shared/ui/settings';
import { Modal } from '../../../shared/ui/Modal';
import { useLayout } from '../../../context/LayoutContext';
import logger from '../../../utils/logger';
import LoadingSpinner from '../../../components/common/LoadingSpinner';

type MobileLayoutMode = 'linked' | 'independent';

interface LayoutSectionProps {
    className?: string;
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
            {/* Dashboard Management Card */}
            <SettingsSection title="Dashboard Management" icon={LayoutGrid}>

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

                {/* Reconnect Confirmation Modal */}
                <Modal
                    open={showReconnectModal}
                    onOpenChange={(open) => !open && setShowReconnectModal(false)}
                    size="sm"
                >
                    <Modal.Header title="Reconnect Mobile Layout?" />
                    <Modal.Body>
                        <div className="space-y-4">
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
                                <AlertTriangle size={20} className="text-warning flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-theme-secondary">
                                    Your custom mobile layout will be replaced with the current desktop layout.
                                    Any mobile-only widgets will be removed.
                                </div>
                            </div>

                            <p className="text-theme-secondary text-sm">
                                After reconnecting, changes made on desktop will automatically update mobile.
                            </p>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button
                            variant="secondary"
                            onClick={() => setShowReconnectModal(false)}
                            disabled={actionLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleReconnect}
                            disabled={actionLoading}
                        >
                            {actionLoading ? 'Reconnecting...' : 'Reconnect'}
                        </Button>
                    </Modal.Footer>
                </Modal>

                {/* Reset Confirmation Modal */}
                <Modal
                    open={showResetModal}
                    onOpenChange={(open) => !open && setShowResetModal(false)}
                    size="sm"
                >
                    <Modal.Header title="Reset All Widgets?" />
                    <Modal.Body>
                        <div className="space-y-4">
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-error/10 border border-error/20">
                                <AlertTriangle size={20} className="text-error flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-theme-secondary">
                                    This will permanently delete all widgets from both your desktop and mobile dashboards.
                                </div>
                            </div>

                            <p className="text-theme-secondary text-sm">
                                This action cannot be undone. You will start with an empty dashboard.
                            </p>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button
                            variant="secondary"
                            onClick={() => setShowResetModal(false)}
                            disabled={actionLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleReset}
                            disabled={actionLoading}
                        >
                            {actionLoading ? 'Resetting...' : 'Reset Dashboard'}
                        </Button>
                    </Modal.Footer>
                </Modal>
            </SettingsSection>
        </SettingsPage>
    );
}
