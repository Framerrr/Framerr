/**
 * MonitorSharingDropdown - Controlled dropdown for per-monitor sharing
 * 
 * Shows checkbox list of users who have integration-level access.
 * Fully controlled component - no internal state, no API calls.
 * Changes apply immediately to parent's dirty state.
 * 
 * Visual design matches SharingDropdown for consistency.
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Users, User, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Checkbox } from '@/shared/ui';

export interface EligibleUser {
    id: string;
    username: string;
    displayName?: string;
}

interface MonitorSharingDropdownProps {
    monitorId: string;
    monitorName: string;
    /** All users who have integration-level access (from dirty state) */
    eligibleUsers: EligibleUser[];
    /** Currently selected user IDs for this monitor */
    selectedUserIds: string[];
    /** Callback when selection changes (updates dirty state) */
    onSelectionChange: (userIds: string[]) => void;
    disabled?: boolean;
}

interface DropdownPosition {
    top: number;
    left: number;
    width: number;
}

const MonitorSharingDropdown: React.FC<MonitorSharingDropdownProps> = ({
    monitorId,
    monitorName,
    eligibleUsers,
    selectedUserIds,
    onSelectionChange,
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 0, left: 0, width: 0 });
    const triggerRef = useRef<HTMLButtonElement>(null);

    // Calculate dropdown position when opened
    useEffect(() => {
        if (isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + window.scrollY + 4,
                left: rect.left + window.scrollX,
                width: Math.max(rect.width, 220)
            });
        }
    }, [isOpen]);

    const handleUserToggle = (userId: string) => {
        if (selectedUserIds.includes(userId)) {
            onSelectionChange(selectedUserIds.filter(id => id !== userId));
        } else {
            onSelectionChange([...selectedUserIds, userId]);
        }
    };

    const handleSelectAll = () => {
        if (selectedUserIds.length === eligibleUsers.length) {
            // All selected, deselect all
            onSelectionChange([]);
        } else {
            // Select all
            onSelectionChange(eligibleUsers.map(u => u.id));
        }
    };

    const getLabel = (): string => {
        if (selectedUserIds.length === 0) return 'Share';
        if (selectedUserIds.length === eligibleUsers.length) return `All (${selectedUserIds.length})`;
        return `${selectedUserIds.length} user${selectedUserIds.length > 1 ? 's' : ''}`;
    };

    const hasShares = selectedUserIds.length > 0;

    // Dropdown content rendered via portal
    const dropdownContent = (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop to close */}
                    <div
                        className="fixed inset-0 z-[9998]"
                        onClick={() => setIsOpen(false)}
                    />
                    {/* Dropdown menu */}
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15 }}
                        style={{
                            position: 'absolute',
                            top: dropdownPosition.top,
                            left: dropdownPosition.left,
                            width: dropdownPosition.width,
                            zIndex: 9999
                        }}
                        className="bg-theme-secondary border border-theme rounded-lg shadow-lg overflow-hidden"
                    >
                        {/* Header */}
                        <div className="px-3 py-2 border-b border-theme">
                            <p className="text-xs text-theme-secondary">
                                Share "{monitorName}" with:
                            </p>
                        </div>

                        {/* Select All option */}
                        {eligibleUsers.length > 1 && (
                            <div className="border-b border-theme">
                                <label className="flex items-center gap-2 cursor-pointer hover:bg-theme-hover px-3 py-2">
                                    <Checkbox
                                        checked={selectedUserIds.length === eligibleUsers.length}
                                        onCheckedChange={handleSelectAll}
                                        size="sm"
                                    />
                                    <span className="text-sm font-medium text-theme-primary">Select All</span>
                                </label>
                            </div>
                        )}

                        {/* Users list */}
                        <div className="max-h-48 overflow-y-auto py-1">
                            {eligibleUsers.length === 0 ? (
                                <p className="text-xs text-theme-tertiary px-3 py-2">
                                    No users have integration access.
                                    <br />
                                    Use the Share button in the footer first.
                                </p>
                            ) : (
                                eligibleUsers.map(user => (
                                    <label
                                        key={user.id}
                                        className="flex items-center gap-2 cursor-pointer hover:bg-theme-hover px-3 py-1.5"
                                    >
                                        <Checkbox
                                            checked={selectedUserIds.includes(user.id)}
                                            onCheckedChange={() => handleUserToggle(user.id)}
                                            size="sm"
                                        />
                                        <User size={14} className="text-theme-secondary" />
                                        <span className="text-sm text-theme-primary">
                                            {user.displayName || user.username}
                                        </span>
                                        {selectedUserIds.includes(user.id) && (
                                            <Check size={14} className="ml-auto text-success" />
                                        )}
                                    </label>
                                ))
                            )}
                        </div>

                        {/* Info footer */}
                        <div className="px-3 py-2 border-t border-theme bg-theme-primary/20">
                            <p className="text-xs text-theme-tertiary">
                                Only users with integration access are shown
                            </p>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );

    return (
        <div className="relative inline-block">
            {/* Dropdown Trigger */}
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
                    inline-flex items-center gap-2
                    px-3 py-2 text-sm
                    bg-theme-tertiary border border-theme rounded-lg
                    transition-colors
                    ${disabled
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-theme-hover cursor-pointer'
                    }
                    ${hasShares ? 'text-success' : 'text-theme-primary'}
                `}
            >
                <Users size={16} className={hasShares ? 'text-success' : 'text-theme-secondary'} />
                <span>{getLabel()}</span>
                <ChevronDown
                    size={14}
                    className={`text-theme-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Render dropdown via portal */}
            {createPortal(dropdownContent, document.body)}
        </div>
    );
};

export default MonitorSharingDropdown;
