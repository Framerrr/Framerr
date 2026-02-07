/**
 * WidgetShareModal - Modal for sharing widget types with users/groups
 * 
 * Features:
 * - Hierarchical group → user list
 * - Indeterminate checkbox states for partial group selection
 * - Integration dropdown per user/group
 * - Pre-loads existing shares
 * - Dirty state tracking
 */

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Users } from 'lucide-react';
import { Modal, Checkbox, UserAvatar, Button, IntegrationDropdown } from '../../shared/ui';
import { getWidgetIcon } from '../../widgets/registry';

// ============================================================================
// Types
// ============================================================================

interface Integration {
    id: string;
    name: string;  // Display name (set name)
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
    integrations: string[];  // Selected integration IDs
}

interface WidgetShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    widgetType: string;
    widgetName: string;
    compatibleIntegrations: Integration[];
    groups: GroupData[];
    ungroupedUsers: UserData[];
    // Initial state (existing shares)
    initialUserShares?: Record<string, UserShareState>;
    onSave?: (shares: { widgetShares: string[]; integrationShares: Record<string, string[]> }) => void;
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
        <div className={`flex items-center justify-between py-2 ${indented ? 'relative' : ''}`}>
            <label className={`flex items-center gap-3 cursor-pointer flex-1 ${indented ? 'ml-18' : ''}`}>
                <Checkbox
                    checked={shareState.checked}
                    onCheckedChange={(checked) => onChange({ ...shareState, checked: checked === true })}
                />
                <UserAvatar
                    name={user.displayName || user.username}
                    profilePictureUrl={user.profilePictureUrl}
                    size="sm"
                />
                <span className="text-sm text-theme-primary">
                    {user.displayName || user.username}
                </span>
            </label>
            <IntegrationDropdown
                integrations={integrations}
                selectedIds={shareState.integrations}
                onChange={(ids) => onChange({ ...shareState, integrations: ids })}
                disabled={!shareState.checked}
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

    // Calculate group checkbox state
    const checkedUsers = group.users.filter(u => userStates[u.id]?.checked);
    const allChecked = checkedUsers.length === group.users.length && group.users.length > 0;
    const someChecked = checkedUsers.length > 0 && checkedUsers.length < group.users.length;
    const groupChecked: boolean | 'indeterminate' = allChecked ? true : someChecked ? 'indeterminate' : false;

    // Calculate group integration state (union of all user integrations)
    const groupIntegrations = [...new Set(
        group.users.flatMap(u => userStates[u.id]?.integrations || [])
    )];

    return (
        <div className="border border-theme rounded-lg overflow-hidden">
            {/* Group Header - visually distinct from user rows */}
            <div className="flex items-center justify-between py-3 px-4 bg-theme-secondary/40">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="p-0.5 hover:bg-theme-hover rounded transition-colors text-theme-secondary"
                    >
                        {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <Checkbox
                        checked={groupChecked}
                        onCheckedChange={(checked) => onGroupToggle(checked === true)}
                    />
                    <div className="w-7 h-7 rounded-full bg-theme-tertiary flex items-center justify-center flex-shrink-0">
                        <Users size={16} className="text-theme-primary" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-theme-primary">{group.name}</span>
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
                />
            </div>

            {/* User List with Tree Line */}
            {expanded && (
                <div className="px-4 pt-2 pb-1 bg-theme-primary/50 relative">
                    {/* Vertical tree line from group to users */}
                    <div
                        className="absolute left-[58px] -top-2 bottom-4 w-0.5"
                        style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 50%, transparent)' }}
                    />

                    <div className="space-y-1">
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
// Main Modal Component
// ============================================================================

const WidgetShareModal: React.FC<WidgetShareModalProps> = ({
    isOpen,
    onClose,
    widgetType,
    widgetName,
    compatibleIntegrations,
    groups,
    ungroupedUsers,
    initialUserShares = {},
    onSave
}) => {
    // Track share state for each user
    const [userStates, setUserStates] = useState<Record<string, UserShareState>>(() => {
        // Initialize with initial shares or empty state
        const initial: Record<string, UserShareState> = {};

        // Initialize all users
        [...groups.flatMap(g => g.users), ...ungroupedUsers].forEach(user => {
            initial[user.id] = initialUserShares[user.id] || { checked: false, integrations: [] };
        });

        return initial;
    });

    // Sync internal state when initialUserShares changes (after async load)
    useEffect(() => {
        const updated: Record<string, UserShareState> = {};
        [...groups.flatMap(g => g.users), ...ungroupedUsers].forEach(user => {
            updated[user.id] = initialUserShares[user.id] || { checked: false, integrations: [] };
        });
        setUserStates(updated);
    }, [initialUserShares, groups, ungroupedUsers]);

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
                    // If unchecking, keep existing integrations; if checking, inherit current
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

    const handleSave = () => {
        // Collect all checked users (widget shares)
        const widgetShares = Object.entries(userStates)
            .filter(([, state]) => state.checked)
            .map(([userId]) => userId);

        // Collect integration shares per user
        // CRITICAL: Include ALL checked users, even with empty integrations array
        // This ensures the server clears old integration shares when user is reshared without integrations
        const integrationShares: Record<string, string[]> = {};
        Object.entries(userStates).forEach(([userId, state]) => {
            if (state.checked) {
                integrationShares[userId] = state.integrations;  // May be empty array - that's correct
            }
        });

        onSave?.({ widgetShares, integrationShares });
        onClose();
    };

    const WidgetIcon = getWidgetIcon(widgetType);

    return (
        <Modal open={isOpen} onOpenChange={(open) => !open && onClose()} size="lg">
            <Modal.Header
                icon={<WidgetIcon size={20} className="text-accent" />}
                title={`Share ${widgetName}`}
            />
            <Modal.Body>
                <div className="space-y-4">
                    {/* Groups */}
                    {groups.map(group => (
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

                    {groups.length === 0 && ungroupedUsers.length === 0 && (
                        <div className="text-center py-8 text-theme-secondary">
                            No users to share with. Create users first.
                        </div>
                    )}
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" size="md" textSize="sm" onClick={onClose}>
                    Cancel
                </Button>
                <Button variant="primary" size="md" textSize="sm" onClick={handleSave}>
                    Save Changes
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default WidgetShareModal;
