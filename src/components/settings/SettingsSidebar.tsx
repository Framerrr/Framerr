import React from 'react';
import { ChevronRight, LucideIcon } from 'lucide-react';
import './SettingsLayout.css';

/**
 * SettingsSidebar - iOS-style grouped list navigation
 * 
 * Renders a list of settings items with:
 * - Colored icon backgrounds (iOS style)
 * - Labels and optional descriptions
 * - Chevron indicators for navigation items
 * - Grouped styling with rounded corners and dividers
 */

export interface SettingsMenuItem {
    /** Unique identifier */
    id: string;
    /** Display label */
    label: string;
    /** Optional description shown below label */
    description?: string;
    /** Lucide icon component */
    icon: LucideIcon;
    /** Icon background color (iOS style) */
    iconColor?: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'pink' | 'teal' | 'gray' | 'indigo' | 'default';
    /** Optional value shown on right side */
    value?: string;
    /** Whether to show chevron (default true for navigation items) */
    showChevron?: boolean;
    /** Whether item is disabled */
    disabled?: boolean;
    /** Whether item is currently active/selected */
    active?: boolean;
    /** Admin only - will be filtered based on permissions */
    adminOnly?: boolean;
}

export interface SettingsMenuGroup {
    /** Optional group label (shown above group) */
    label?: string;
    /** Items in this group */
    items: SettingsMenuItem[];
}

interface SettingsSidebarProps {
    /** Groups of menu items to display */
    groups: SettingsMenuGroup[];
    /** Currently active item ID */
    activeId?: string;
    /** Callback when item is selected */
    onSelect: (itemId: string) => void;
    /** Optional className for container */
    className?: string;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
    groups,
    activeId,
    onSelect,
    className = ''
}) => {
    return (
        <nav className={`settings-sidebar ${className}`}>
            {groups.map((group, groupIndex) => (
                <div key={groupIndex} className="mb-4">
                    {group.label && (
                        <div className="settings-group__label">
                            {group.label}
                        </div>
                    )}
                    <div className="settings-group">
                        {group.items.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeId === item.id || item.active;
                            const showChevron = item.showChevron !== false;
                            const iconColorClass = `settings-item__icon--${item.iconColor || 'default'}`;

                            return (
                                <button
                                    key={item.id}
                                    onClick={() => !item.disabled && onSelect(item.id)}
                                    className={`settings-item ${isActive ? 'settings-item--active' : ''} ${item.disabled ? 'settings-item--disabled' : ''}`}
                                    disabled={item.disabled}
                                >
                                    <div className={`settings-item__icon ${iconColorClass}`}>
                                        <Icon size={18} />
                                    </div>
                                    <div className="settings-item__content">
                                        <div className="settings-item__label">{item.label}</div>
                                        {item.description && (
                                            <div className="settings-item__description">{item.description}</div>
                                        )}
                                    </div>
                                    <div className="settings-item__accessory">
                                        {item.value && (
                                            <span className="settings-item__value">{item.value}</span>
                                        )}
                                        {showChevron && (
                                            <ChevronRight size={18} className="settings-item__chevron" />
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </nav>
    );
};

export default SettingsSidebar;
