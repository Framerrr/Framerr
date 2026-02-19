/**
 * WidgetShareCard - Full-width expandable card for widget sharing
 * 
 * Matches IntegrationTypeCard pattern:
 * - Header: icon, name, share summary, revoke all button
 * - Expands to show user groups with integration dropdowns
 * 
 * Design: Matches service settings cards (full horizontal, expandable)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronRight, Users, Loader2 } from 'lucide-react';
import { Checkbox, UserAvatar, Button, ConfirmButton, IntegrationDropdown } from '../../../shared/ui';
import { getWidgetMetadata, getWidgetIcon } from '../../../widgets/registry';
import { widgetSharesApi } from '../../../api/endpoints/widgetShares';
import { useSaveWidgetShares, useRevokeWidgetShares } from '../../../api/hooks/useWidgetQueries';
import { useNotifications } from '../../../context/NotificationContext';
import logger from '../../../utils/logger';

// ============================================================================
// Types
// ============================================================================

interface Integration {
    id: string;
    name: string;
    type: string;
}

interface UserData {
    id: string;
    username: string;
    displayName?: string;
    profilePictureUrl?: string;
}

interface GroupData {
    id: string;
    name: string;
    users: UserData[];
}

interface UserShareState {
    checked: boolean;
    integrations: string[];
}

interface WidgetShareCardProps {
    widgetType: string;
    groups: GroupData[];
    ungroupedUsers: UserData[];
    allIntegrations: Integration[];
    onSaveComplete?: () => void;
}

// ============================================================================
// User Row Component
// ============================================================================

interface UserRowProps {
    user: UserData;
    shareState: UserShareState;
    integrations: Integration[];
    onChange: (state: UserShareState) => void;
    indented?: boolean;
    isLast?: boolean;
}

const UserRow: React.FC<UserRowProps> = ({
    user,
    shareState,
    integrations,
    onChange,
    indented = false,
    isLast = false
}) => {
    return (
        <div className={`flex items-center justify-between py-2 pr-4 hover:bg-theme-hover/30 ${indented ? 'relative' : 'pl-4'}`}>
            <label className={`flex items-center gap-3 cursor-pointer flex-1 min-w-0 ${indented ? 'ml-20' : ''}`}>
                <Checkbox
                    checked={shareState.checked}
                    onCheckedChange={(checked) => onChange({ ...shareState, checked: checked === true })}
                />
                <UserAvatar
                    name={user.displayName || user.username}
                    profilePictureUrl={user.profilePictureUrl}
                    size="sm"
                />
                <span className="text-sm text-theme-primary truncate">
                    {user.displayName || user.username}
                </span>
            </label>
            <IntegrationDropdown
                integrations={integrations}
                selectedIds={shareState.integrations}
                onChange={(ids) => onChange({ ...shareState, integrations: ids })}
                disabled={!shareState.checked}
                size="md"
                align="end"
            />
        </div>
    );
};

// ============================================================================
// Group Row Component
// ============================================================================

interface GroupRowProps {
    group: GroupData;
    userStates: Record<string, UserShareState>;
    integrations: Integration[];
    onUserChange: (userId: string, state: UserShareState) => void;
    onGroupToggle: (checked: boolean) => void;
    onGroupIntegrationsChange: (integrationIds: string[]) => void;
}

const GroupRow: React.FC<GroupRowProps> = ({
    group,
    userStates,
    integrations,
    onUserChange,
    onGroupToggle,
    onGroupIntegrationsChange
}) => {
    const [expanded, setExpanded] = useState(false);

    const checkedUsers = group.users.filter(u => userStates[u.id]?.checked);
    const allChecked = checkedUsers.length === group.users.length && group.users.length > 0;
    const someChecked = checkedUsers.length > 0 && checkedUsers.length < group.users.length;
    const groupChecked: boolean | 'indeterminate' = allChecked ? true : someChecked ? 'indeterminate' : false;

    const groupIntegrations = [...new Set(
        group.users.flatMap(u => userStates[u.id]?.integrations || [])
    )];

    return (
        <div className="border border-theme rounded-lg overflow-hidden">
            {/* Group Header */}
            <div className="flex items-center justify-between py-3 px-4 bg-theme-secondary/20">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="p-0.5 hover:bg-theme-hover rounded transition-colors text-theme-secondary"
                    >
                        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <Checkbox
                        checked={groupChecked}
                        onCheckedChange={(checked) => onGroupToggle(checked === true)}
                    />
                    <div className="w-7 h-7 rounded-full bg-theme-tertiary flex items-center justify-center flex-shrink-0">
                        <Users size={16} className="text-theme-primary" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-theme-primary">{group.name}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-theme-tertiary text-theme-secondary">
                            {checkedUsers.length}/{group.users.length}
                        </span>
                    </div>
                </div>
                <IntegrationDropdown
                    integrations={integrations}
                    selectedIds={groupIntegrations}
                    onChange={onGroupIntegrationsChange}
                    disabled={checkedUsers.length === 0}
                    size="sm"
                    align="end"
                />
            </div>

            {/* Expanded User List with Tree Line */}
            {expanded && (
                <div className="bg-theme-primary/20 relative pb-1">
                    {/* Vertical tree line from group to users */}
                    <div
                        className="absolute left-[54px] -top-2 bottom-4 w-0.5"
                        style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 50%, transparent)' }}
                    />

                    <div className="divide-y divide-theme/50">
                        {group.users.map((user, index) => (
                            <UserRow
                                key={user.id}
                                user={user}
                                shareState={userStates[user.id] || { checked: false, integrations: [] }}
                                integrations={integrations}
                                onChange={(state) => onUserChange(user.id, state)}
                                indented
                                isLast={index === group.users.length - 1}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// Main Widget Share Card Component
// ============================================================================

const WidgetShareCard: React.FC<WidgetShareCardProps> = ({
    widgetType,
    groups,
    ungroupedUsers,
    allIntegrations,
    onSaveComplete
}) => {
    const [expanded, setExpanded] = useState(false);
    const [userStates, setUserStates] = useState<Record<string, UserShareState>>({});
    const [initialUserStates, setInitialUserStates] = useState<Record<string, UserShareState>>({});
    const [loading, setLoading] = useState(false);
    const [initialLoaded, setInitialLoaded] = useState(false);
    const { success: showSuccess, error: showError } = useNotifications();

    // React Query mutations
    const saveMutation = useSaveWidgetShares();
    const revokeMutation = useRevokeWidgetShares();

    const metadata = getWidgetMetadata(widgetType);
    const WidgetIcon = getWidgetIcon(widgetType);
    const widgetName = metadata?.name || widgetType;
    const compatibleTypes = metadata?.compatibleIntegrations || [];

    // Filter integrations to those compatible with this widget
    const compatibleIntegrations = compatibleTypes.length > 0
        ? allIntegrations.filter(i => compatibleTypes.includes(i.type))
        : [];

    // Load existing shares when expanded
    const loadExistingShares = useCallback(async () => {
        if (initialLoaded) return;
        setLoading(true);
        try {
            const response = await widgetSharesApi.getExisting(widgetType, compatibleTypes);
            const states = response.userStates || {};
            setUserStates(states);
            setInitialUserStates(JSON.parse(JSON.stringify(states))); // Deep copy for comparison
            setInitialLoaded(true);
        } catch (err) {
            logger.error('Failed to load widget shares:', err);
        } finally {
            setLoading(false);
        }
    }, [widgetType, compatibleTypes, initialLoaded]);

    // Load data on mount (not on expand)
    useEffect(() => {
        if (!initialLoaded) {
            loadExistingShares();
        }
    }, [initialLoaded, loadExistingShares]);

    // Count shared users
    const sharedUserCount = Object.values(userStates).filter(s => s.checked).length;

    // Compare current state to initial to determine if there are actual changes
    const hasChanges = useMemo(() => {
        // Get all user IDs from both states
        const allUserIds = new Set([...Object.keys(userStates), ...Object.keys(initialUserStates)]);

        for (const userId of allUserIds) {
            const current = userStates[userId];
            const initial = initialUserStates[userId];

            // If one exists and other doesn't
            if (!current && initial?.checked) return true;
            if (current?.checked && !initial) return true;

            // If both exist, compare values
            if (current && initial) {
                if (current.checked !== initial.checked) return true;
                // Only compare integrations if user is checked
                if (current.checked) {
                    const currentInts = [...(current.integrations || [])].sort();
                    const initialInts = [...(initial.integrations || [])].sort();
                    if (currentInts.join(',') !== initialInts.join(',')) return true;
                }
            }
        }
        return false;
    }, [userStates, initialUserStates]);

    const handleUserChange = (userId: string, state: UserShareState) => {
        setUserStates(prev => ({ ...prev, [userId]: state }));
    };

    const handleGroupToggle = (group: GroupData, checked: boolean) => {
        setUserStates(prev => {
            const updated = { ...prev };
            group.users.forEach(user => {
                updated[user.id] = {
                    ...updated[user.id],
                    checked,
                    integrations: updated[user.id]?.integrations || []
                };
            });
            return updated;
        });
    };

    const handleGroupIntegrationsChange = (group: GroupData, integrationIds: string[]) => {
        setUserStates(prev => {
            const updated = { ...prev };
            group.users.forEach(user => {
                if (updated[user.id]?.checked) {
                    updated[user.id] = {
                        ...updated[user.id],
                        integrations: integrationIds
                    };
                }
            });
            return updated;
        });
    };

    const handleSave = async () => {
        try {
            const userShares = Object.entries(userStates)
                .filter(([, state]) => state.checked)
                .map(([userId]) => userId);

            const integrationShares: Record<string, string[]> = {};
            Object.entries(userStates).forEach(([userId, state]) => {
                if (state.checked) {
                    integrationShares[userId] = state.integrations;
                }
            });

            await saveMutation.mutateAsync({
                widgetType,
                data: {
                    userShares,
                    groupShares: [],
                    everyoneShare: false,
                    integrationShares,
                    compatibleTypes
                }
            });

            showSuccess('Changes Saved', `${widgetName} sharing updated`);
            // Update initial state to match current (no more changes)
            setInitialUserStates(JSON.parse(JSON.stringify(userStates)));
            onSaveComplete?.();
        } catch (err) {
            logger.error('Failed to save widget shares:', err);
            showError('Error', 'Failed to save changes');
        }
    };

    const handleRevokeAll = async () => {
        try {
            await revokeMutation.mutateAsync(widgetType);
            // Clear local state and initial state
            setUserStates({});
            setInitialUserStates({});
            showSuccess('Shares Revoked', `All shares for ${widgetName} have been removed.`);
            onSaveComplete?.();
        } catch (err) {
            logger.error('Failed to revoke widget shares:', err);
            showError('Error', 'Failed to revoke shares');
        }
    };

    // Combined saving state from mutations
    const saving = saveMutation.isPending || revokeMutation.isPending;

    // Filter to groups that have users
    const visibleGroups = groups.filter(g => g.users.length > 0);

    return (
        <div className="bg-theme-tertiary rounded-xl border border-theme overflow-hidden">
            {/* Header - Clickable to expand */}
            <div
                role="button"
                tabIndex={0}
                onClick={() => setExpanded(!expanded)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpanded(!expanded);
                    }
                }}
                className="
                    w-full p-4
                    hover:bg-theme-hover/50
                    transition-all duration-200
                    flex flex-wrap items-center gap-4
                    cursor-pointer group
                "
            >
                {/* Icon */}
                <div className="p-3 bg-accent/20 rounded-lg flex-shrink-0 group-hover:bg-accent/30 transition-colors">
                    <WidgetIcon size={24} className="text-accent" />
                </div>

                {/* Title + Share Summary */}
                <div className="flex-1 min-w-0 text-left">
                    <h4 className="font-semibold text-theme-primary">{widgetName}</h4>
                    <p className="text-sm text-theme-secondary">
                        {loading
                            ? 'Loading...'
                            : sharedUserCount > 0
                                ? `Shared with ${sharedUserCount} user${sharedUserCount !== 1 ? 's' : ''}`
                                : 'Not shared'
                        }
                    </p>
                </div>

                {/* Unsaved indicator */}
                {hasChanges && (
                    <span className="w-2 h-2 rounded-full bg-warning flex-shrink-0" title="Unsaved changes" />
                )}

                {/* Revoke button - wraps and centers on mobile */}
                <div
                    className="w-full sm:w-auto flex justify-center sm:justify-end order-last sm:order-none"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                >
                    <ConfirmButton
                        onConfirm={handleRevokeAll}
                        size="sm"
                        disabled={!initialLoaded || sharedUserCount === 0 || saving}
                        confirmMode="icon"
                        label="Revoke All"
                        confirmLabel="Confirm"
                    />
                </div>

                {/* Chevron - always at end, never wraps */}
                <ChevronDown
                    size={20}
                    className={`text-theme-tertiary group-hover:text-accent transition-all duration-200 flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
                />
            </div>

            {/* Expanded Content */}
            {expanded && (
                <div className="border-t border-theme bg-theme-secondary/30">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 size={24} className="animate-spin text-theme-secondary" />
                        </div>
                    ) : (
                        <>
                            {/* Groups and Ungrouped Users */}
                            <div className="p-4 space-y-3">
                                {visibleGroups.map(group => (
                                    <GroupRow
                                        key={group.id}
                                        group={group}
                                        userStates={userStates}
                                        integrations={compatibleIntegrations}
                                        onUserChange={handleUserChange}
                                        onGroupToggle={(checked) => handleGroupToggle(group, checked)}
                                        onGroupIntegrationsChange={(ids) => handleGroupIntegrationsChange(group, ids)}
                                    />
                                ))}

                                {/* Ungrouped Users */}
                                {ungroupedUsers.length > 0 && (
                                    <div className="border border-theme rounded-lg overflow-hidden">
                                        <div className="px-4 py-2 bg-theme-secondary/30 text-sm font-medium text-theme-secondary">
                                            Ungrouped Users
                                        </div>
                                        <div className="px-4 py-2 space-y-1">
                                            {ungroupedUsers.map(user => (
                                                <UserRow
                                                    key={user.id}
                                                    user={user}
                                                    shareState={userStates[user.id] || { checked: false, integrations: [] }}
                                                    integrations={compatibleIntegrations}
                                                    onChange={(state) => handleUserChange(user.id, state)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* No Users Message */}
                                {visibleGroups.length === 0 && ungroupedUsers.length === 0 && (
                                    <div className="text-center py-6 text-theme-secondary text-sm">
                                        No users to share with
                                    </div>
                                )}
                            </div>

                            {/* Save Button - always visible, disabled when no changes */}
                            <div className="px-4 py-3 text-right">
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={handleSave}
                                    disabled={!hasChanges || saving}
                                    icon={saving ? Loader2 : undefined}
                                    className={saving ? '[&_svg]:animate-spin' : ''}
                                >
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default WidgetShareCard;
