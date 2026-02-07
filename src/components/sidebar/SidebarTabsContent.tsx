import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useSharedSidebar } from './SharedSidebarContext';
import { HighlightItem } from './Highlight';
import { sidebarSpring, textSpring } from './types';

/**
 * SidebarTabsContent - Renders tabs and groups in sidebar
 * Extracted from DesktopSidebar for mode switching support
 */
export function SidebarTabsContent() {
    const {
        isExpanded,
        expandedGroups,
        tabs,
        groups,
        renderIcon,
        toggleGroup,
        handleNavigation,
        getActiveNavItem,
    } = useSharedSidebar();

    // Parse current route for active state detection
    const hash = window.location.hash.slice(1);
    const activeNavItem = getActiveNavItem();

    if (!tabs || tabs.length === 0) {
        return null;
    }

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
                        Tabs
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Separator for collapsed state */}
            {!isExpanded && <div className="my-3 h-px bg-gradient-to-r from-transparent via-border-theme to-transparent w-full" />}

            {/* Ungrouped tabs */}
            {tabs.filter(tab => !tab.groupId).map(tab => {
                const isTabActive = hash === tab.slug;
                return (
                    <HighlightItem key={tab.id} value={`tab-${tab.id}`}>
                        <a
                            href={`/#${tab.slug}`}
                            onClick={(e: React.MouseEvent<HTMLAnchorElement>) => handleNavigation(e, `#${tab.slug}`)}
                            className="relative flex items-center py-3.5 pl-20 min-h-[48px] text-sm font-medium text-theme-secondary hover:text-theme-primary transition-colors rounded-xl group"
                        >
                            {/* Icon - absolutely positioned in 80px left zone */}
                            <div className="absolute left-0 w-20 h-full flex items-center justify-center">
                                <span className={`flex items-center justify-center ${isTabActive ? 'text-accent' : ''}`}>
                                    {renderIcon(tab.icon, 20)}
                                </span>
                            </div>
                            {/* Text - appears when expanded */}
                            <AnimatePresence mode="wait">
                                {isExpanded && (
                                    <motion.span
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0 }}
                                        transition={textSpring}
                                        className={`whitespace-nowrap ${isTabActive ? 'text-accent' : ''}`}
                                    >
                                        {tab.name}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                            {/* Tooltip for collapsed state */}
                            {!isExpanded && (
                                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-2 bg-theme-secondary/95 backdrop-blur-sm text-theme-primary text-sm font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl border border-theme">
                                    {tab.name}
                                </div>
                            )}
                        </a>
                    </HighlightItem>
                );
            })}

            {/* Grouped tabs */}
            {groups && groups.map((group) => {
                const groupTabs = tabs.filter(tab => String(tab.groupId) === String(group.id));
                if (groupTabs.length === 0) return null;

                return (
                    <div key={group.id} className={isExpanded ? 'mt-2' : ''}>
                        {isExpanded ? (
                            <>
                                <HighlightItem value={`group-${group.id}`}>
                                    <button
                                        onClick={() => toggleGroup(String(group.id))}
                                        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-theme-tertiary uppercase tracking-wider hover:text-theme-secondary transition-colors rounded-lg"
                                    >
                                        <span>{group.name}</span>
                                        <ChevronRight
                                            size={16}
                                            className="transition-transform duration-300"
                                            style={{
                                                transform: expandedGroups[group.id] ? 'rotate(90deg)' : 'rotate(0deg)'
                                            }}
                                        />
                                    </button>
                                </HighlightItem>
                                <AnimatePresence>
                                    {expandedGroups[group.id] && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={sidebarSpring}
                                            className="overflow-hidden space-y-1 mt-1"
                                        >
                                            {groupTabs.map(tab => {
                                                const isTabActive = hash === tab.slug;
                                                return (
                                                    <HighlightItem key={tab.id} value={`tab-${tab.id}`}>
                                                        <a
                                                            href={`/#${tab.slug}`}
                                                            onClick={(e: React.MouseEvent<HTMLAnchorElement>) => handleNavigation(e, `#${tab.slug}`)}
                                                            className="flex items-center py-3 px-4 pl-8 text-sm font-medium text-theme-tertiary hover:text-theme-primary transition-colors rounded-xl"
                                                        >
                                                            <span className={`mr-3 flex items-center justify-center ${isTabActive ? 'text-accent' : ''}`}>
                                                                {renderIcon(tab.icon, 20)}
                                                            </span>
                                                            <span className={`truncate ${isTabActive ? 'text-accent' : ''}`}>
                                                                {tab.name}
                                                            </span>
                                                        </a>
                                                    </HighlightItem>
                                                );
                                            })}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </>
                        ) : (
                            groupTabs.map(tab => {
                                const isTabActive = hash === tab.slug;
                                return (
                                    <HighlightItem key={tab.id} value={`tab-${tab.id}`}>
                                        <a
                                            href={`/#${tab.slug}`}
                                            onClick={(e: React.MouseEvent<HTMLAnchorElement>) => handleNavigation(e, `#${tab.slug}`)}
                                            className="relative flex items-center py-3.5 pl-20 min-h-[48px] text-theme-secondary hover:text-theme-primary transition-colors rounded-xl group"
                                        >
                                            {/* Icon - absolutely positioned in 80px left zone */}
                                            <div className="absolute left-0 w-20 h-full flex items-center justify-center">
                                                <span className={`flex items-center justify-center ${isTabActive ? 'text-accent' : ''}`}>
                                                    {renderIcon(tab.icon, 20)}
                                                </span>
                                            </div>
                                            {/* Tooltip for collapsed state */}
                                            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-2 bg-theme-secondary/95 backdrop-blur-sm text-theme-primary text-sm font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl border border-theme">
                                                {tab.name}
                                                <span className="text-xs text-theme-tertiary block">{group.name}</span>
                                            </div>
                                        </a>
                                    </HighlightItem>
                                );
                            })
                        )}
                    </div>
                );
            })}
        </>
    );
}

export default SidebarTabsContent;
