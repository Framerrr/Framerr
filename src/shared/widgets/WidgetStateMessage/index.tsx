/**
 * WidgetStateMessage - Unified widget state display primitive
 * 
 * Replaces all inconsistent widget error/loading/empty states with a
 * standardized, container-query-responsive design.
 * 
 * Variants:
 * - loading: Centered spinner
 * - error: Error with optional retry
 * - disabled: Integration disabled (admin sees settings link)
 * - notConfigured: Integration not configured (admin sees settings link)
 * - noAccess: User lacks widget/integration access
 * - crash: React error with retry + details popover
 * - empty: Configurable empty state
 */

import React, { useState } from 'react';
import {
    AlertTriangle,
    AlertCircle,
    ShieldOff,
    Settings,
    Inbox,
    RotateCcw,
    type LucideIcon
} from 'lucide-react';
import { Button, Popover } from '../../ui';
import LoadingSpinner from '../../../components/common/LoadingSpinner';
import './styles.css';

export type WidgetStateVariant =
    | 'loading'
    | 'error'
    | 'disabled'
    | 'notConfigured'
    | 'noAccess'
    | 'crash'
    | 'empty'
    | 'unavailable';

export interface WidgetStateMessageProps {
    /** State variant to display */
    variant: WidgetStateVariant;
    /** Service name for contextual messages (e.g., "Plex", "Sonarr") */
    serviceName?: string;
    /** Instance display name for unavailable variant (e.g., "My Plex Server") */
    instanceName?: string;
    /** Custom message override */
    message?: string;
    /** Retry callback for error/crash states */
    onRetry?: () => void;
    /** Error stack trace for crash details popover */
    errorDetails?: string;
    /** Custom icon for empty state */
    emptyIcon?: LucideIcon;
    /** Custom title for empty state */
    emptyTitle?: string;
    /** Custom subtitle for empty state */
    emptySubtitle?: string;
    /** Whether current user is admin (affects settings links) */
    isAdmin?: boolean;
}

interface VariantConfig {
    icon: LucideIcon | null;
    iconClass: string;
    title: string;
    getMessage: (serviceName?: string, isAdmin?: boolean) => string;
    showSettingsLink: boolean;
    showRetry: boolean;
    showDetails: boolean;
}

const variantConfigs: Record<WidgetStateVariant, VariantConfig> = {
    loading: {
        icon: null, // Uses LoadingSpinner instead
        iconClass: '',
        title: '',
        getMessage: () => '',
        showSettingsLink: false,
        showRetry: false,
        showDetails: false,
    },
    error: {
        icon: AlertTriangle,
        iconClass: 'widget-state__icon--error',
        title: 'Error',
        getMessage: () => 'Something went wrong',
        showSettingsLink: false,
        showRetry: true,
        showDetails: false,
    },
    disabled: {
        icon: AlertCircle,
        iconClass: 'widget-state__icon--warning',
        title: 'No Integrations Available',
        getMessage: (_name?: string, isAdmin?: boolean) => isAdmin
            ? 'Add an integration in settings'
            : '',
        showSettingsLink: true,
        showRetry: false,
        showDetails: false,
    },
    notConfigured: {
        icon: Settings,
        iconClass: 'widget-state__icon--muted',
        title: 'Not Configured',
        getMessage: (name) => {
            if (!name) return 'Select an integration to use this widget';
            const article = /^[aeiou]/i.test(name) ? 'an' : 'a';
            return `Select ${article} ${name} integration to use this widget`;
        },
        showSettingsLink: false,
        showRetry: false,
        showDetails: false,
    },
    noAccess: {
        icon: ShieldOff,
        iconClass: 'widget-state__icon--muted',
        title: 'Access Not Available',
        getMessage: () => 'You do not have access to this widget',
        showSettingsLink: false,
        showRetry: false,
        showDetails: false,
    },
    crash: {
        icon: AlertTriangle,
        iconClass: 'widget-state__icon--error',
        title: 'Widget Failed',
        getMessage: () => 'An error occurred while rendering',
        showSettingsLink: false,
        showRetry: true,
        showDetails: true,
    },
    empty: {
        icon: Inbox,
        iconClass: 'widget-state__icon--muted',
        title: 'No Data',
        getMessage: () => 'Nothing to display',
        showSettingsLink: false,
        showRetry: false,
        showDetails: false,
    },
    unavailable: {
        icon: AlertCircle,
        iconClass: 'widget-state__icon--error',
        title: 'Service Unavailable',
        getMessage: (serviceName) => serviceName
            ? `Unable to reach ${serviceName}`
            : 'Unable to reach service',
        showSettingsLink: false,
        showRetry: false,
        showDetails: false,
    },
};

export const WidgetStateMessage: React.FC<WidgetStateMessageProps> = ({
    variant,
    serviceName,
    instanceName,
    message,
    onRetry,
    errorDetails,
    emptyIcon,
    emptyTitle,
    emptySubtitle,
    isAdmin = false,
}) => {
    const [detailsOpen, setDetailsOpen] = useState(false);
    const config = variantConfigs[variant];

    // Loading state - just show spinner
    if (variant === 'loading') {
        return (
            <div className="widget-state widget-state--loading">
                <LoadingSpinner />
            </div>
        );
    }

    // Determine icon
    let IconComponent: LucideIcon;
    if (variant === 'empty' && emptyIcon) {
        IconComponent = emptyIcon;
    } else {
        IconComponent = config.icon || Inbox;
    }

    // Determine title
    const title = variant === 'empty' && emptyTitle
        ? emptyTitle
        : config.title;

    // Determine message - for unavailable variant, prefer instanceName over serviceName
    let displayMessage: string;
    if (message) {
        displayMessage = message;
    } else if (variant === 'empty' && emptySubtitle) {
        displayMessage = emptySubtitle;
    } else if (variant === 'unavailable' && instanceName) {
        // Use instance name for more specific unavailable message
        displayMessage = `Unable to reach ${instanceName}`;
    } else {
        displayMessage = config.getMessage(serviceName, isAdmin);
    }

    // Settings link handler
    const handleSettingsClick = () => {
        window.location.hash = '#settings/integrations/services';
    };

    // Show settings link only for admin
    const shouldShowSettingsLink = config.showSettingsLink && isAdmin;

    return (
        <div className={`widget-state widget-state--${variant}`}>
            {/* Icon */}
            <div className={`widget-state__icon ${config.iconClass}`}>
                <IconComponent />
            </div>

            {/* Text Group - enables horizontal layout stacking */}
            <div className="widget-state__text-group">
                {/* Title */}
                {title && (
                    <h3 className="widget-state__title">{title}</h3>
                )}

                {/* Message */}
                {displayMessage && (
                    <p className="widget-state__message">{displayMessage}</p>
                )}
            </div>

            {/* Actions */}
            {(config.showRetry || shouldShowSettingsLink || config.showDetails) && (
                <div className="widget-state__actions">
                    {config.showRetry && onRetry && (
                        <Button
                            variant="primary"
                            size="sm"
                            icon={RotateCcw}
                            onClick={onRetry}
                        >
                            Retry
                        </Button>
                    )}

                    {shouldShowSettingsLink && (
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={Settings}
                            onClick={handleSettingsClick}
                        >
                            Settings
                        </Button>
                    )}

                    {config.showDetails && errorDetails && (
                        <Popover
                            open={detailsOpen}
                            onOpenChange={setDetailsOpen}
                        >
                            <Popover.Trigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDetailsOpen(!detailsOpen)}
                                >
                                    Details
                                </Button>
                            </Popover.Trigger>
                            <Popover.Content
                                side="top"
                                align="center"
                                className="widget-state__details-popover"
                            >
                                <div className="widget-state__details-content">
                                    <div className="widget-state__details-header">
                                        Error Details
                                    </div>
                                    <pre className="widget-state__details-stack">
                                        {errorDetails}
                                    </pre>
                                </div>
                            </Popover.Content>
                        </Popover>
                    )}
                </div>
            )}
        </div>
    );
};

export default WidgetStateMessage;
