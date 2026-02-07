import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getLucideIcon } from '../../utils/iconUtils';
import { useSharedSidebar } from './SharedSidebarContext';
import { HighlightItem } from './Highlight';
import { textSpring } from './types';
import { getSettingsCategories, getVisibleChildren, getFirstVisibleChild, iconColorMap } from './settingsMenuConfig';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/permissions';

/**
 * SidebarSettingsContent - Renders settings categories in sidebar with accordion sub-tabs
 * Used when sidebarMode === 'settings'
 */
export function SidebarSettingsContent() {
    const {
        isExpanded,
        handleNavigation,
        settingsNavPath,
        setSettingsNavPath,
        expandedSettingsCategory,
        setExpandedSettingsCategory,
    } = useSharedSidebar();

    const { user } = useAuth();
    const hasAdminAccess = isAdmin(user);
    const categories = getSettingsCategories(hasAdminAccess);

    // Current active category and sub-tab from URL path
    const activeCategory = settingsNavPath[0] || 'tabs';
    const activeSubTab = settingsNavPath[1] || null;

    // Render icon dynamically using centralized utility
    const renderIcon = (iconName: string, size: number = 20): React.ReactNode => {
        const IconComponent = getLucideIcon(iconName);
        return <IconComponent size={size} />;
    };

    // Handle category click - expand accordion and navigate to first child if has children
    const handleCategoryClick = (e: React.MouseEvent<HTMLAnchorElement>, categoryId: string, hasChildren: boolean) => {
        if (hasChildren) {
            e.preventDefault();
            const category = categories.find(c => c.id === categoryId);
            if (!category) return;

            // Toggle accordion: if already expanded, collapse it; otherwise expand and close others
            if (expandedSettingsCategory === categoryId) {
                // Already expanded - just navigate to first child (don't collapse)
                const firstChild = getFirstVisibleChild(category, hasAdminAccess);
                if (firstChild) {
                    // Optimistic update: highlight immediately before navigation
                    setSettingsNavPath([categoryId, firstChild.id]);
                    window.location.hash = `settings/${categoryId}/${firstChild.id}`;
                }
            } else {
                // Expand this category (closes others automatically via single state)
                setExpandedSettingsCategory(categoryId);
                // Navigate to first child
                const firstChild = getFirstVisibleChild(category, hasAdminAccess);
                if (firstChild) {
                    // Optimistic update: highlight immediately before navigation
                    setSettingsNavPath([categoryId, firstChild.id]);
                    window.location.hash = `settings/${categoryId}/${firstChild.id}`;
                }
            }
        } else {
            // No children - use normal navigation
            // Optimistic update: highlight immediately before navigation
            setSettingsNavPath([categoryId]);
            handleNavigation(e, `#settings/${categoryId}`);
        }
    };

    // Handle sub-tab click
    const handleSubTabClick = (e: React.MouseEvent<HTMLAnchorElement>, categoryId: string, subTabId: string) => {
        e.preventDefault();
        // Optimistic update: highlight immediately before navigation
        setSettingsNavPath([categoryId, subTabId]);
        window.location.hash = `settings/${categoryId}/${subTabId}`;
    };

    return (
        <>
            {/* Header for expanded state */}
            <AnimatePresence mode="wait">
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.1 }}
                        className="text-[11px] font-semibold text-theme-tertiary uppercase tracking-wider px-4 pt-4 pb-2"
                    >
                        Settings
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Separator for collapsed state */}
            {!isExpanded && <div className="my-3 h-px bg-gradient-to-r from-transparent via-border-theme to-transparent w-full" />}

            {/* Settings categories */}
            {categories.map(category => {
                const isActive = activeCategory === category.id;
                const colorClass = iconColorMap[category.iconColor] || 'bg-gray-500';
                const visibleChildren = getVisibleChildren(category, hasAdminAccess);
                const hasChildren = visibleChildren.length > 0;
                const isOpen = expandedSettingsCategory === category.id;

                return (
                    <div key={category.id}>
                        <HighlightItem value={`settings-${category.id}`}>
                            <a
                                href={`/#settings/${category.id}`}
                                onClick={(e) => handleCategoryClick(e, category.id, hasChildren)}
                                className="relative flex items-center py-3.5 pl-20 min-h-[48px] text-sm font-medium text-theme-secondary hover:text-theme-primary transition-colors rounded-xl group"
                            >
                                {/* Icon - absolutely positioned in 80px left zone */}
                                <div className="absolute left-0 w-20 h-full flex items-center justify-center">
                                    <span className={`flex items-center justify-center w-7 h-7 rounded-lg text-white ${colorClass}`}>
                                        {renderIcon(category.icon, 16)}
                                    </span>
                                </div>
                                {/* Text - appears when expanded */}
                                <AnimatePresence mode="wait">
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0 }}
                                            transition={textSpring}
                                            className="flex items-center justify-between flex-1 pr-4"
                                        >
                                            <span className={`whitespace-nowrap ${isActive ? 'text-accent' : ''}`}>
                                                {category.label}
                                            </span>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                {/* Tooltip for collapsed state */}
                                {!isExpanded && (
                                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-2 bg-theme-secondary/95 backdrop-blur-sm text-theme-primary text-sm font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl border border-theme">
                                        {category.label}
                                        {category.adminOnly && (
                                            <span className="text-xs text-theme-tertiary block">Admin</span>
                                        )}
                                    </div>
                                )}
                            </a>
                        </HighlightItem>

                        {/* Children sub-tabs (accordion) - only show when expanded sidebar AND open accordion */}
                        <AnimatePresence>
                            {isExpanded && isOpen && hasChildren && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <div className="ml-10 pl-2 border-l-2 border-accent/30 space-y-1 py-1">
                                        {visibleChildren.map(child => {
                                            const isChildActive = activeCategory === category.id && activeSubTab === child.id;
                                            return (
                                                <HighlightItem key={child.id} value={`settings-${category.id}-${child.id}`}>
                                                    <a
                                                        href={`/#settings/${category.id}/${child.id}`}
                                                        onClick={(e) => handleSubTabClick(e, category.id, child.id)}
                                                        className={`block w-full py-2 pl-5 pr-3 mr-2 text-sm rounded-lg transition-colors ${isChildActive
                                                            ? 'text-accent font-medium'
                                                            : 'text-theme-secondary hover:text-theme-primary'
                                                            }`}
                                                    >
                                                        {child.label}
                                                    </a>
                                                </HighlightItem>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            })}
        </>
    );
}

export default SidebarSettingsContent;

