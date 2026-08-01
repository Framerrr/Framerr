import React from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useSharedSidebar } from './context/useSharedSidebar';
import { HighlightItem } from './Highlight';
import { sidebarSpring, textSpring, labelExitTween, labelStagger, type Tab } from './types';

/** Height pack for section/group chrome — same family as sidebar width. */
const packTransition = sidebarSpring;
const packExit = {
    height: sidebarSpring,
    opacity: labelExitTween,
};

/**
 * Height enter/exit pack. Only clips while the height spring is running so
 * layout-sliding tab icons aren't shaved by a permanent overflow:hidden.
 */
function HeightPack({
    show,
    children,
    className = '',
}: {
    show: boolean;
    children: React.ReactNode;
    className?: string;
}) {
    const [clip, setClip] = React.useState(false);

    return (
        <AnimatePresence initial={false}>
            {show && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0, transition: packExit }}
                    transition={packTransition}
                    onAnimationStart={() => setClip(true)}
                    onAnimationComplete={() => setClip(false)}
                    className={`${clip ? 'overflow-hidden' : 'overflow-visible'} ${className}`}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

type TabRowProps = {
    tab: Tab;
    isExpanded: boolean;
    isActive: boolean;
    labelIndex: number;
    groupName?: string;
    renderIcon: (icon: string | undefined, size: number) => React.ReactNode;
    handleNavigation: (e: React.MouseEvent<HTMLAnchorElement>, hash: string) => void;
};

/**
 * Stable tab row — same DOM in collapsed and expanded.
 * layout="position" lets icons slide up/down as headers pack in/out.
 */
function TabRow({
    tab,
    isExpanded,
    isActive,
    labelIndex,
    groupName,
    renderIcon,
    handleNavigation,
}: TabRowProps) {
    return (
        <motion.div layout="position" transition={packTransition}>
            <HighlightItem value={`tab-${tab.id}`}>
                <a
                    href={tab.openInNewTab ? tab.url : `/#${tab.slug}`}
                    target={tab.openInNewTab ? '_blank' : undefined}
                    rel={tab.openInNewTab ? 'noopener noreferrer' : undefined}
                    onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                        if (tab.openInNewTab) return;
                        handleNavigation(e, `#${tab.slug}`);
                    }}
                    className="relative flex items-center py-3.5 pl-20 min-h-[48px] text-sm font-medium text-theme-secondary hover:text-theme-primary transition-colors rounded-xl group"
                >
                    <div className="absolute left-0 w-20 h-full flex items-center justify-center">
                        <span className={`flex items-center justify-center ${isActive ? 'text-accent' : ''}`}>
                            {renderIcon(tab.icon, 20)}
                        </span>
                    </div>
                    <AnimatePresence mode="wait">
                        {isExpanded && (
                            <motion.span
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -6, transition: labelExitTween }}
                                transition={{ ...textSpring, delay: labelStagger(labelIndex) }}
                                className={`whitespace-nowrap truncate ${isActive ? 'text-accent' : ''}`}
                            >
                                {tab.name}
                            </motion.span>
                        )}
                    </AnimatePresence>
                    {!isExpanded && (
                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-2 bg-theme-secondary/95 backdrop-blur-sm text-theme-primary text-sm font-medium rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl border border-theme">
                            {tab.name}
                            {groupName && (
                                <span className="text-xs text-theme-tertiary block">{groupName}</span>
                            )}
                        </div>
                    )}
                </a>
            </HighlightItem>
        </motion.div>
    );
}

/**
 * SidebarTabsContent - Renders tabs and groups in sidebar
 * One-row model: tab rows stay mounted; headers height-pack so icons slide up/down.
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
    } = useSharedSidebar();

    const hash = window.location.hash.slice(1);

    if (!tabs || tabs.length === 0) {
        return null;
    }

    const ungroupedTabs = tabs.filter(tab => tab.enabled !== false && !tab.groupId);
    const hasUngrouped = ungroupedTabs.length > 0;
    let motionIndex = 0;

    return (
        <LayoutGroup id="sidebar-tabs">
            {/* Ungrouped chrome — fully hidden when there are no ungrouped tabs */}
            {hasUngrouped && (
                <AnimatePresence initial={false} mode="popLayout">
                    {isExpanded ? (
                        <motion.div
                            key="tabs-header"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0, transition: packExit }}
                            transition={packTransition}
                            className="overflow-hidden"
                        >
                            <div className="text-[11px] font-semibold text-theme-tertiary uppercase tracking-wider px-4 pt-4 pb-2">
                                Tabs
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="tabs-sep"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0, transition: packExit }}
                            transition={packTransition}
                            className="overflow-hidden"
                        >
                            <div className="my-3 h-px bg-gradient-to-r from-transparent via-border-theme to-transparent w-full" />
                        </motion.div>
                    )}
                </AnimatePresence>
            )}

            {ungroupedTabs.map(tab => {
                const labelIndex = motionIndex++;
                return (
                    <TabRow
                        key={tab.id}
                        tab={tab}
                        isExpanded={isExpanded}
                        isActive={hash === tab.slug}
                        labelIndex={labelIndex}
                        renderIcon={renderIcon}
                        handleNavigation={handleNavigation}
                    />
                );
            })}

            {groups && groups.map(group => {
                const groupTabs = tabs.filter(
                    tab => tab.enabled !== false && String(tab.groupId) === String(group.id),
                );
                if (groupTabs.length === 0) return null;

                const groupHeaderIndex = isExpanded ? motionIndex++ : motionIndex;
                // Collapsed sidebar always shows every tab icon; expanded respects accordion.
                const showGroupTabs = !isExpanded || !!expandedGroups[group.id];

                return (
                    <div key={group.id}>
                        <AnimatePresence initial={false}>
                            {isExpanded && (
                                <motion.div
                                    key={`group-header-${group.id}`}
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0, transition: packExit }}
                                    transition={packTransition}
                                    className="overflow-hidden"
                                >
                                    <div className="mt-2">
                                        <HighlightItem value={`group-${group.id}`}>
                                            <button
                                                type="button"
                                                onClick={() => toggleGroup(String(group.id))}
                                                className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-theme-tertiary uppercase tracking-wider hover:text-theme-secondary transition-colors rounded-lg"
                                            >
                                                <motion.span
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{
                                                        ...textSpring,
                                                        delay: labelStagger(groupHeaderIndex),
                                                    }}
                                                >
                                                    {group.name}
                                                </motion.span>
                                                <ChevronRight
                                                    size={16}
                                                    className="transition-transform duration-300"
                                                    style={{
                                                        transform: expandedGroups[group.id]
                                                            ? 'rotate(90deg)'
                                                            : 'rotate(0deg)',
                                                    }}
                                                />
                                            </button>
                                        </HighlightItem>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <HeightPack show={showGroupTabs} className="space-y-1">
                            {groupTabs.map(tab => {
                                const labelIndex = motionIndex++;
                                return (
                                    <TabRow
                                        key={tab.id}
                                        tab={tab}
                                        isExpanded={isExpanded}
                                        isActive={hash === tab.slug}
                                        labelIndex={labelIndex}
                                        groupName={group.name}
                                        renderIcon={renderIcon}
                                        handleNavigation={handleNavigation}
                                    />
                                );
                            })}
                        </HeightPack>
                    </div>
                );
            })}
        </LayoutGroup>
    );
}

export default SidebarTabsContent;
