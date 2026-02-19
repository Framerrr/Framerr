/**
 * ServiceConfigModal - Unified modal wrapper for all integration configuration forms
 * 
 * Same shell for ALL integrations (simple and complex):
 * - Header: icon, name, reset button, close button
 * - Content: varies by integration type (form component)
 * - Footer: test button (conditional), save button
 * 
 * Built on top of Modal primitive from @/shared/ui for consistent behavior.
 */

import React, { useEffect, useRef, useState } from 'react';
import { TestTube, Loader, CheckCircle2, AlertCircle, Save, Pencil, Settings, Bell } from 'lucide-react';
import { Modal } from '../../../shared/ui';
import { Switch } from '../../../shared/ui';
import { Button } from '../../../shared/ui';

/**
 * EditableName - Click-to-edit component for instance display name
 */
const EditableName: React.FC<{
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
}> = ({ value, onChange, placeholder }) => {
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={() => setIsEditing(false)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'Escape') {
                        setIsEditing(false);
                    }
                }}
                className="text-lg font-semibold text-theme-primary bg-theme-tertiary border border-theme rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-accent w-full"
                placeholder={placeholder}
            />
        );
    }

    return (
        <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 text-lg font-semibold text-theme-primary hover:text-accent transition-colors group"
            title="Click to rename"
        >
            {value || placeholder}
            <Pencil size={14} className="text-theme-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
    );
};

interface TestState {
    loading?: boolean;
    success?: boolean;
    message?: string;
}

interface ServiceConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    service: {
        id: string;
        name: string;
        icon: React.ComponentType<{ size?: number; className?: string }>;
        /** Whether this integration has a connection test button. Defaults to true. */
        hasConnectionTest?: boolean;
        /** Whether this integration supports webhooks (shows Notifications tab) */
        hasWebhook?: boolean;
    };
    children: React.ReactNode;
    /** Instance display name (editable) */
    displayName?: string;
    /** Callback when display name changes */
    onDisplayNameChange?: (name: string) => void;
    onTest?: () => void;

    onSave: () => void;
    onToggle?: () => void;  // Toggle enabled/disabled state
    testState?: TestState | null;
    saving?: boolean;
    isEnabled?: boolean;
    /** Whether save button should be disabled (e.g., form invalid) */
    canSave?: boolean;
    /** Content for the Notifications tab (webhook configuration) */
    webhookContent?: React.ReactNode;
}

/**
 * ServiceConfigModal - Unified modal wrapper for all integration configuration forms
 * Provides consistent header, footer actions, and overlay behavior for ALL integration types.
 */
const ServiceConfigModal: React.FC<ServiceConfigModalProps> = ({
    isOpen,
    onClose,
    service,
    children,
    displayName,
    onDisplayNameChange,
    onTest,

    onSave,
    onToggle,
    testState,
    saving = false,
    isEnabled = false,
    canSave = true,
    webhookContent
}) => {
    const Icon = service.icon;
    const hasWebhook = service.hasWebhook && webhookContent;

    // Tab state - only relevant when webhooks are supported
    type ConfigTab = 'connection' | 'notifications';
    const [activeTab, setActiveTab] = useState<ConfigTab>('connection');

    // Check if test button should be shown (default true)
    const showTestButton = service.hasConnectionTest !== false && onTest;

    // Build the title content (either editable or static)
    const titleContent = (
        <div>
            {onDisplayNameChange ? (
                <EditableName
                    value={displayName ?? ''}
                    onChange={onDisplayNameChange}
                    placeholder={service.name}
                />
            ) : (
                <span className="text-lg font-semibold text-theme-primary">
                    {displayName || service.name}
                </span>
            )}
            <p className="text-sm text-theme-tertiary">
                {service.name}
            </p>
        </div>
    );

    // Build header actions (toggle, reset button)
    const headerActions = (
        <>
            {/* Enable/Disable toggle - always visible */}
            {onToggle && (
                <Switch
                    checked={isEnabled}
                    onCheckedChange={() => onToggle()}
                    aria-label={isEnabled ? 'Disable integration' : 'Enable integration'}
                />
            )}
        </>
    );

    return (
        <Modal
            open={isOpen}
            onOpenChange={(open) => !open && onClose()}
            size="lg"
            className="min-h-[400px]"
        >
            {/* Header */}
            <Modal.Header
                title={titleContent}
                subtitle=""
                icon={<Icon size={20} className="text-theme-secondary" />}
                actions={headerActions}
                className="p-6"
            />

            {/* Tab Bar - only show when webhook support exists */}
            {hasWebhook && (
                <div className="flex border-b border-theme px-6">
                    <button
                        onClick={() => setActiveTab('connection')}
                        className={`flex items-center gap-2 py-3 px-4 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === 'connection'
                            ? 'border-accent text-accent'
                            : 'border-transparent text-theme-secondary hover:text-theme-primary'
                            }`}
                    >
                        <Settings size={16} />
                        Connection
                    </button>
                    <button
                        onClick={() => setActiveTab('notifications')}
                        className={`flex items-center gap-2 py-3 px-4 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === 'notifications'
                            ? 'border-accent text-accent'
                            : 'border-transparent text-theme-secondary hover:text-theme-primary'
                            }`}
                    >
                        <Bell size={16} />
                        Notifications
                    </button>
                </div>
            )}

            {/* Content - Scrollable with disabled state */}
            <Modal.Body
                padded={false}
                className={`p-2 transition-opacity ${!isEnabled ? 'opacity-50 pointer-events-none' : ''}`}
            >
                {/* Connection tab or single-mode content */}
                {(!hasWebhook || activeTab === 'connection') && children}

                {/* Notifications tab */}
                {hasWebhook && activeTab === 'notifications' && webhookContent}
            </Modal.Body>

            {/* Footer */}
            <Modal.Footer>
                <div className="flex items-center justify-between gap-3 w-full">
                    {/* Left side - Test button + result */}
                    <div className="flex items-center gap-3 flex-wrap min-w-0">
                        {showTestButton && (
                            <Button
                                onClick={onTest}
                                disabled={testState?.loading}
                                variant={testState && !testState.loading
                                    ? (testState.success ? 'primary' : 'danger')
                                    : 'secondary'
                                }
                                size="sm"
                                icon={testState?.loading
                                    ? Loader
                                    : (testState?.success
                                        ? CheckCircle2
                                        : testState
                                            ? AlertCircle
                                            : TestTube
                                    )
                                }
                                className={`flex-shrink-0 ${testState && !testState.loading && testState.success
                                    ? 'bg-success border-success'
                                    : ''
                                    }`}
                            >
                                {testState?.loading ? 'Testing...' :
                                    testState?.success ? 'Connected' :
                                        testState ? 'Failed' : 'Test'}
                            </Button>
                        )}
                        {testState?.message && !testState.loading && (
                            <span className={`text-sm ${testState.success ? 'text-success' : 'text-error'}`}>
                                {testState.message}
                            </span>
                        )}
                    </div>

                    {/* Right side - Save */}
                    <Button
                        onClick={onSave}
                        disabled={saving || !canSave}
                        icon={saving ? Loader : Save}
                        size="sm"
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </Button>
                </div>
            </Modal.Footer>
        </Modal>
    );
};

export default ServiceConfigModal;
