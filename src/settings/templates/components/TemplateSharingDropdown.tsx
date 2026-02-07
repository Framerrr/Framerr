/**
 * TemplateSharingDropdown - Template sharing control (Controlled Pattern)
 * 
 * Fully controlled component - parent manages sharing state.
 * Changes only apply when parent saves the modal.
 * Uses Popover primitive for consistent styling.
 */

import React, { useState, useEffect } from 'react';
import { Users, User, Globe, Lock, ChevronDown, Check, Loader } from 'lucide-react';
import { Popover, Checkbox } from '@/shared/ui';
import { widgetSharesApi } from '../../../api/endpoints';
import logger from '../../../utils/logger';

export type SharingMode = 'none' | 'everyone' | 'groups' | 'users';

export interface TemplateSharingState {
    mode: SharingMode;
    selectedUsers: string[];
}

interface UserInfo {
    id: string;
    username: string;
    displayName?: string;
    group: string;
}

export interface TemplateSharingDropdownProps {
    /** Current sharing mode (controlled) */
    mode: SharingMode;
    /** Selected user IDs (controlled) */
    selectedUserIds: string[];
    /** Callback when mode changes */
    onModeChange: (mode: SharingMode) => void;
    /** Callback when user selection changes */
    onUserSelectionChange: (userIds: string[]) => void;
    /** Whether dropdown is disabled */
    disabled?: boolean;
}

/**
 * TemplateSharingDropdown - Template sharing control for admin
 * 
 * Controlled component - parent manages all state.
 * Changes only apply when parent saves the modal.
 */
const TemplateSharingDropdown: React.FC<TemplateSharingDropdownProps> = ({
    mode,
    selectedUserIds,
    onModeChange,
    onUserSelectionChange,
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [users, setUsers] = useState<UserInfo[]>([]);
    const [groups, setGroups] = useState<string[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    // Fetch users on mount
    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async (): Promise<void> => {
        setLoadingData(true);
        try {
            // Use shared API for consistency with widget sharing
            const data = await widgetSharesApi.getUsersAndGroups();

            // Flatten grouped users and ungrouped users into single list
            const allUsers: UserInfo[] = [];

            // Add users from groups
            for (const group of data.groups || []) {
                for (const user of group.users || []) {
                    allUsers.push({
                        id: user.id,
                        username: user.username,
                        displayName: user.displayName,
                        group: group.name
                    });
                }
            }

            // Add ungrouped users
            for (const user of data.ungroupedUsers || []) {
                allUsers.push({
                    id: user.id,
                    username: user.username,
                    displayName: user.displayName,
                    group: 'ungrouped'
                });
            }

            setUsers(allUsers);
            // Extract unique groups
            const uniqueGroups = [...new Set<string>(allUsers.map(u => u.group))];
            setGroups(uniqueGroups);
        } catch (error) {
            logger.error('Error fetching users for sharing:', { error });
        } finally {
            setLoadingData(false);
        }
    };

    const handleModeChange = (newMode: SharingMode): void => {
        onModeChange(newMode);
        if (newMode === 'none') {
            onUserSelectionChange([]);
        } else if (newMode === 'everyone') {
            // When selecting Everyone, all users are implicitly selected
            onUserSelectionChange(users.map(u => u.id));
        }
    };

    const handleUserToggle = (userId: string): void => {
        // If in Everyone mode and deselecting a user, switch to per-user mode
        if (mode === 'everyone') {
            const remainingUsers = users.map(u => u.id).filter(id => id !== userId);
            onModeChange('users');
            onUserSelectionChange(remainingUsers);
            return;
        }

        let newSelection: string[];
        if (selectedUserIds.includes(userId)) {
            newSelection = selectedUserIds.filter(u => u !== userId);
        } else {
            newSelection = [...selectedUserIds, userId];
        }

        // If all users are now selected, auto-switch to Everyone mode
        if (newSelection.length === users.length && users.length > 0) {
            onModeChange('everyone');
            onUserSelectionChange(users.map(u => u.id));
        } else {
            onUserSelectionChange(newSelection);
        }
    };

    const handleGroupToggle = (group: string): void => {
        const groupUserIds = users.filter(u => u.group === group).map(u => u.id);
        const allSelected = groupUserIds.every(id => selectedUserIds.includes(id));

        if (allSelected) {
            onUserSelectionChange(selectedUserIds.filter(id => !groupUserIds.includes(id)));
        } else {
            onUserSelectionChange([...new Set([...selectedUserIds, ...groupUserIds])]);
        }
    };

    const getModeLabel = (): string => {
        if (mode === 'everyone') return 'Shared with Everyone';
        if (mode === 'users' && selectedUserIds.length > 0) {
            return `Shared with ${selectedUserIds.length} user${selectedUserIds.length > 1 ? 's' : ''}`;
        }
        if (mode === 'groups') return 'Specific Groups';
        return 'Not Shared';
    };

    const getModeIcon = () => {
        switch (mode) {
            case 'everyone': return Globe;
            case 'groups': return Users;
            case 'users': return selectedUserIds.length > 0 ? User : Lock;
            default: return Lock;
        }
    };

    const ModeIcon = getModeIcon();
    const isShared = mode !== 'none' && (mode === 'everyone' || selectedUserIds.length > 0);

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <Popover.Trigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    className={`
                        w-full flex items-center justify-between gap-2
                        px-4 py-2.5 text-sm
                        bg-theme-tertiary border border-theme rounded-lg
                        transition-colors
                        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-theme-hover cursor-pointer'}
                    `}
                >
                    <div className="flex items-center gap-2">
                        <ModeIcon size={16} className={isShared ? 'text-success' : 'text-theme-secondary'} />
                        <span className={isShared ? 'text-success' : 'text-theme-primary'}>{getModeLabel()}</span>
                    </div>
                    <ChevronDown
                        size={16}
                        className={`text-theme-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                </button>
            </Popover.Trigger>

            <Popover.Content align="start" sideOffset={4} className="p-1 min-w-[280px]">
                {/* Mode Options */}
                <button
                    onClick={() => handleModeChange('none')}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left rounded-md hover:bg-theme-hover transition-colors ${mode === 'none' ? 'bg-theme-tertiary' : ''}`}
                >
                    <Lock size={16} className="text-theme-secondary" />
                    <span className="text-theme-primary">Not Shared</span>
                    {mode === 'none' && <Check size={14} className="ml-auto text-success" />}
                </button>

                <button
                    onClick={() => handleModeChange('everyone')}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left rounded-md hover:bg-theme-hover transition-colors ${mode === 'everyone' ? 'bg-theme-tertiary' : ''}`}
                >
                    <Globe size={16} className="text-info" />
                    <span className="text-theme-primary">Everyone</span>
                    {mode === 'everyone' && <Check size={14} className="ml-auto text-success" />}
                </button>

                <button
                    onClick={() => handleModeChange('groups')}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left rounded-md hover:bg-theme-hover transition-colors ${mode === 'groups' ? 'bg-theme-tertiary' : ''}`}
                >
                    <Users size={16} className="text-warning" />
                    <span className="text-theme-primary">Specific Groups</span>
                    {mode === 'groups' && <Check size={14} className="ml-auto text-success" />}
                </button>

                <button
                    onClick={() => handleModeChange('users')}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left rounded-md hover:bg-theme-hover transition-colors ${mode === 'users' ? 'bg-theme-tertiary' : ''}`}
                >
                    <User size={16} className="text-accent" />
                    <span className="text-theme-primary">Specific Users</span>
                    {mode === 'users' && <Check size={14} className="ml-auto text-success" />}
                </button>

                {/* Groups Selection */}
                {mode === 'groups' && (
                    <div className="border-t border-theme mt-1 pt-1">
                        {loadingData ? (
                            <div className="flex items-center gap-2 px-3 py-2 text-theme-tertiary">
                                <Loader size={14} className="animate-spin" />
                                <span className="text-xs">Loading...</span>
                            </div>
                        ) : groups.length === 0 ? (
                            <p className="px-3 py-2 text-xs text-theme-tertiary">No groups available</p>
                        ) : (
                            groups.map(group => {
                                const groupUserIds = users.filter(u => u.group === group).map(u => u.id);
                                const allSelected = groupUserIds.every(id => selectedUserIds.includes(id));
                                return (
                                    <label
                                        key={group}
                                        className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-theme-hover cursor-pointer transition-colors"
                                    >
                                        <Checkbox
                                            checked={allSelected}
                                            onCheckedChange={() => handleGroupToggle(group)}
                                            size="sm"
                                        />
                                        <span className="text-sm capitalize text-theme-primary">{group}</span>
                                        <span className="text-xs text-theme-tertiary ml-auto">
                                            ({groupUserIds.length} user{groupUserIds.length !== 1 ? 's' : ''})
                                        </span>
                                    </label>
                                );
                            })
                        )}
                    </div>
                )}

                {/* Users Selection - Show in both 'users' and 'everyone' mode */}
                {(mode === 'users' || mode === 'everyone') && (
                    <div
                        className="border-t border-theme mt-1 pt-1 max-h-48 overflow-y-scroll overscroll-contain"
                        onWheel={(e) => e.stopPropagation()}
                        data-scroll-lock-allow
                    >
                        <p className="px-3 py-1 text-xs text-theme-secondary">
                            Select users:
                        </p>
                        {loadingData ? (
                            <div className="flex items-center gap-2 px-3 py-2 text-theme-tertiary">
                                <Loader size={14} className="animate-spin" />
                                <span className="text-xs">Loading...</span>
                            </div>
                        ) : users.length === 0 ? (
                            <p className="px-3 py-2 text-xs text-theme-tertiary">No non-admin users available</p>
                        ) : (
                            users.map(user => (
                                <label
                                    key={user.id}
                                    className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-theme-hover cursor-pointer transition-colors"
                                >
                                    <Checkbox
                                        checked={mode === 'everyone' || selectedUserIds.includes(user.id)}
                                        onCheckedChange={() => handleUserToggle(user.id)}
                                        size="sm"
                                    />
                                    <span className="text-sm text-theme-primary">
                                        {user.displayName || user.username}
                                    </span>
                                </label>
                            ))
                        )}
                    </div>
                )}

            </Popover.Content>
        </Popover>
    );
};

export default TemplateSharingDropdown;
