import React, { useMemo, useRef, useEffect } from 'react';
import {
    User, Layout, Settings as SettingsIcon, Users, Cpu, Shield,
    FolderTree, Puzzle, Bell, LayoutDashboard, ChevronRight, ArrowLeft,
    // Sub-tab icons for mobile
    Grid3x3, Layers, Wrench, Share2, Link, Sliders, Copy,
    SlidersHorizontal, Palette, Image, Network, Tv2, Frame,
    Bug, Activity, Beaker, Code, Clock
} from 'lucide-react';
import {
    getSettingsCategories as getSettingsCategoriesFromConfig,
    getVisibleChildren,
    SidebarSettingsCategory
} from '../../components/sidebar/settingsMenuConfig';
import { motion, AnimatePresence, Transition } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useLayout } from '../../context/LayoutContext';
import { SettingsNavProvider, useSettingsNav } from '../../context/SettingsNavContext';
import { SettingsAnimationProvider } from '../../context/SettingsAnimationContext';
import { LAYOUT } from '../../constants/layout';
import { isAdmin } from '../../utils/permissions';
import { Card } from '../../components/common/Card';
// Mobile-only: SettingsSidebar for full-screen navigation stack
import { SettingsSidebar, SettingsMenuItem, SettingsMenuGroup } from '../../components/settings/SettingsSidebar';
import '../../components/settings/SettingsLayout.css';

// User Settings Components
import { TabSettings } from '../../settings/tabs';
import { TabGroupsSettings } from '../../settings/tabgroups';
import CustomizationSettings from '../../settings/customization';
import { ProfileSettings } from '../../settings/profile';
import { NotificationSettings } from '../../settings/notifications';

// Admin Settings Components
import { UserManagementSettings } from '../../settings/users';
import { IntegrationsSettings } from '../../settings/integrations';

import { AuthSettings } from '../../settings/auth';
import { AdvancedSettings } from '../../settings/advanced';
import { DashboardSettings } from '../../settings/dashboard';

/**
 * UserSettings - iOS-style settings page
 * 
 * Uses SettingsNavContext for path-based URL navigation:
 * - #settings                    → Shows category list (mobile) or first category (desktop)
 * - #settings/tabs               → My Tabs settings
 * - #settings/customization      → Customization settings (with sub-tabs)
 * - #settings/profile?source=profile → Profile settings (via profile icon)
 */

// Define settings categories with iOS-style colors
const getSettingsCategories = (hasAdminAccess: boolean): SettingsMenuGroup[] => {
    const userItems: SettingsMenuItem[] = [
        { id: 'tabs', label: 'My Tabs', icon: Layout, iconColor: 'blue' },
        { id: 'tabgroups', label: 'Tab Groups', icon: FolderTree, iconColor: 'orange' },
        { id: 'integrations', label: 'Integrations', icon: Puzzle, iconColor: 'purple' },
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, iconColor: 'teal' },
        { id: 'customization', label: 'Customization', icon: SettingsIcon, iconColor: 'gray' },
        { id: 'profile', label: 'Profile', icon: User, iconColor: 'blue' },
        { id: 'notifications', label: 'Notifications', icon: Bell, iconColor: 'red' },
    ];

    const adminItems: SettingsMenuItem[] = hasAdminAccess ? [
        { id: 'users', label: 'Users', icon: Users, iconColor: 'green', adminOnly: true },
        { id: 'auth', label: 'Auth', icon: Shield, iconColor: 'indigo', adminOnly: true },
        { id: 'advanced', label: 'Advanced', icon: Cpu, iconColor: 'gray', adminOnly: true },
    ] : [];

    // Single group with all items (no visible separator between user and admin)
    return [{
        items: [...userItems, ...adminItems]
    }];
};

// Map category ID to component
const getCategoryComponent = (categoryId: string, hasAdminAccess: boolean, activeSubTab: string | null): React.ReactNode => {
    switch (categoryId) {
        case 'tabs':
            return <TabSettings />;
        case 'tabgroups':
            return <TabGroupsSettings />;
        case 'integrations':
            return <IntegrationsSettings activeSubTab={activeSubTab} />;
        case 'dashboard':
            return <DashboardSettings activeSubTab={activeSubTab} />;
        case 'customization':
            return <CustomizationSettings activeSubTab={activeSubTab} />;
        case 'profile':
            return <ProfileSettings />;
        case 'notifications':
            return <NotificationSettings />;
        case 'users':
            return hasAdminAccess ? <UserManagementSettings activeSubTab={activeSubTab} /> : null;
        case 'auth':
            return hasAdminAccess ? <AuthSettings activeSubTab={activeSubTab} /> : null;
        case 'advanced':
            return hasAdminAccess ? <AdvancedSettings activeSubTab={activeSubTab} /> : null;
        default:
            return null;
    }
};

// Inner component that uses the navigation context
const SettingsContent: React.FC = () => {
    const { user } = useAuth();
    const { isMobile } = useLayout();
    const { path, navigate, goBack, animationDirection, getBreadcrumbs } = useSettingsNav();

    const hasAdminAccess = isAdmin(user);
    const categories = useMemo(() => getSettingsCategories(hasAdminAccess), [hasAdminAccess]);

    // Get current category from path
    const currentCategory = path.segments[0] || 'tabs'; // Default to 'tabs'

    // Animation control: only animate on first render or category change
    // Skip animation when just revealing already-visited Settings page
    const hasRenderedOnce = useRef(false);
    const prevCategory = useRef(currentCategory);
    const shouldAnimate = !hasRenderedOnce.current || prevCategory.current !== currentCategory;

    useEffect(() => {
        hasRenderedOnce.current = true;
        prevCategory.current = currentCategory;
    }, [currentCategory]);

    // Handle sidebar item selection
    const handleSelect = (itemId: string): void => {
        navigate(`/${itemId}`);
    };

    // Content transition animation
    const contentSpring: Transition = {
        type: 'spring',
        stiffness: 220,
        damping: 30,
    };

    // Get animation direction for slide
    const getInitialX = (): number => {
        if (animationDirection === 'forward') return 40;
        if (animationDirection === 'backward') return -40;
        return 0;
    };

    const getExitX = (): number => {
        if (animationDirection === 'forward') return -40;
        if (animationDirection === 'backward') return 40;
        return 0;
    };

    // Get centralized config categories for sub-tab detection
    const configCategories = useMemo(() => getSettingsCategoriesFromConfig(hasAdminAccess), [hasAdminAccess]);

    // Find category by ID from centralized config
    const findCategoryById = (id: string): SidebarSettingsCategory | undefined => {
        return configCategories.find(cat => cat.id === id);
    };

    // Mobile breadcrumb header with responsive truncation
    // 80% viewport width threshold - truncates full words (no partial text)
    // Truncation order: Settings → "..." first, then middle items hidden
    const MobileBreadcrumbHeader: React.FC = () => {
        const breadcrumbs = getBreadcrumbs();
        const containerRef = React.useRef<HTMLDivElement>(null);
        const [truncateLevel, setTruncateLevel] = React.useState(0);

        // Measure and adjust truncation level
        React.useEffect(() => {
            const checkWidth = (): void => {
                if (!containerRef.current) return;

                const viewportWidth = window.innerWidth;
                const maxWidth = viewportWidth * 0.8; // 80% of viewport
                const contentWidth = containerRef.current.scrollWidth;

                // Progressive truncation: 0=full, 1=... for Settings, 2=hide middle items
                if (contentWidth > maxWidth && truncateLevel < 2) {
                    setTruncateLevel(prev => Math.min(prev + 1, 2));
                } else if (contentWidth <= maxWidth * 0.7 && truncateLevel > 0) {
                    // Restore if more space becomes available
                    setTruncateLevel(prev => Math.max(prev - 1, 0));
                }
            };

            // Check on mount and when breadcrumbs change
            const timer = setTimeout(checkWidth, 0);
            return () => clearTimeout(timer);
        }, [breadcrumbs, truncateLevel]);

        // Build display items based on truncation level
        const displayItems: Array<{ label: string; isLast: boolean }> = [];

        // Settings or "..."
        if (truncateLevel >= 1) {
            displayItems.push({ label: '...', isLast: false });
        } else {
            displayItems.push({ label: 'Settings', isLast: breadcrumbs.length === 0 });
        }

        // Add breadcrumbs, potentially hiding middle items
        breadcrumbs.forEach((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            const isMiddle = index > 0 && index < breadcrumbs.length - 1;

            // At truncate level 2, hide middle items (keep first category and last item)
            if (truncateLevel >= 2 && isMiddle) {
                return; // Skip middle items
            }

            displayItems.push({ label: crumb, isLast });
        });

        return (
            <div className="flex items-center gap-2 mb-4 px-4 pt-4">
                <button
                    onClick={goBack}
                    className="p-2 -ml-2 rounded-lg hover:bg-theme-hover active:bg-theme-tertiary transition-colors flex-shrink-0"
                    aria-label="Go back"
                >
                    <ArrowLeft size={22} className="text-accent" />
                </button>
                <h1
                    ref={containerRef}
                    className="text-lg font-bold text-theme-primary flex items-center gap-1.5 whitespace-nowrap"
                >
                    {displayItems.map((item, index) => (
                        <span key={index} className="flex items-center gap-1.5">
                            {index > 0 && <span className="text-theme-tertiary">›</span>}
                            <span className={item.isLast ? 'font-semibold' : 'text-theme-secondary'}>
                                {item.label}
                            </span>
                        </span>
                    ))}
                </h1>
            </div>
        );
    };

    // Use the component in render
    const renderMobileBreadcrumbHeader = (): React.ReactNode => <MobileBreadcrumbHeader />;

    // Render sub-category list for categories with children (Level 2)
    const renderMobileSubCategory = (category: SidebarSettingsCategory): React.ReactNode => {
        const children = getVisibleChildren(category, hasAdminAccess);
        const Icon = getCategoryIcon(category.icon);
        const iconColorClass = `settings-item__icon--${category.iconColor || 'default'}`;

        return (
            <div>
                {renderMobileBreadcrumbHeader()}
                <div className="settings-group">
                    {children.map((child) => (
                        <button
                            key={child.id}
                            onClick={() => navigate(`/${category.id}/${child.id}`)}
                            className="settings-item w-full text-left"
                        >
                            <div className={`settings-item__icon ${iconColorClass}`}>
                                {React.createElement(getCategoryIcon(child.icon || category.icon), { size: 18 })}
                            </div>
                            <div className="settings-item__content">
                                <div className="settings-item__label">{child.label}</div>
                            </div>
                            <div className="settings-item__accessory">
                                <ChevronRight size={18} className="settings-item__chevron" />
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    // Helper to get icon component from string name
    const getCategoryIcon = (iconName: string): React.ElementType => {
        const iconMap: Record<string, React.ElementType> = {
            // Parent category icons
            Layout, User, Settings: SettingsIcon, Users, Cpu, Shield,
            FolderTree, Puzzle, Bell, LayoutDashboard, ChevronRight,
            // Sub-tab icons
            Grid3x3, Layers, Wrench, Share2, Link, Sliders, Copy,
            SlidersHorizontal, Palette, Image, Network, Tv2, Frame,
            Bug, Activity, Beaker, Code, Clock
        };
        return iconMap[iconName] || ChevronRight;
    };

    // Render category list for mobile root
    const renderMobileRoot = (): React.ReactNode => (
        <div className="pt-4">
            <div className="mb-6 px-4">
                <h1 className="text-2xl font-bold text-theme-primary">Settings</h1>
                {hasAdminAccess && (
                    <p className="text-theme-secondary text-sm mt-1">
                        Personal preferences and system configuration
                    </p>
                )}
            </div>
            {/* Mobile settings list using settings-group (not settings-sidebar which is hidden on mobile) */}
            {categories.map((group, groupIndex) => (
                <div key={groupIndex}>
                    {group.label && (
                        <div className="settings-group__label">
                            {group.label}
                        </div>
                    )}
                    <div className="settings-group">
                        {group.items.map((item) => {
                            const Icon = item.icon;
                            // Only show active state if we're actually at that category (not at root)
                            const isActive = path.segments.length > 0 && currentCategory === item.id;
                            const iconColorClass = `settings-item__icon--${item.iconColor || 'default'}`;

                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleSelect(item.id)}
                                    className={`settings-item w-full text-left ${isActive ? 'settings-item--active' : ''}`}
                                >
                                    <div className={`settings-item__icon ${iconColorClass}`}>
                                        <Icon size={18} />
                                    </div>
                                    <div className="settings-item__content">
                                        <div className="settings-item__label">{item.label}</div>
                                    </div>
                                    <div className="settings-item__accessory">
                                        <ChevronRight size={18} className="settings-item__chevron" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );

    // Render content for a category
    const renderContent = (): React.ReactNode => {
        const activeSubTab = path.segments[1] || null;
        const component = getCategoryComponent(currentCategory, hasAdminAccess, activeSubTab);
        if (!component) {
            return <div className="p-4 text-theme-secondary">Category not found</div>;
        }
        return component;
    };

    // Mobile: Show category list at root, sub-category list at depth 1 (if has children), content otherwise
    if (isMobile) {
        // Get current category from config to check for children
        const currentConfigCategory = findCategoryById(currentCategory);
        const hasChildren = currentConfigCategory && getVisibleChildren(currentConfigCategory, hasAdminAccess).length > 0;
        const isAtSubCategoryLevel = path.segments.length === 1 && hasChildren;

        // Render mobile content with back button header for content pages
        const renderMobileContentWithHeader = (): React.ReactNode => {
            // Get the category label for the header
            const categoryLabel = currentConfigCategory?.label || currentCategory;

            return (
                <div>
                    {renderMobileBreadcrumbHeader()}
                    <div className="px-4">
                        {renderContent()}
                    </div>
                </div>
            );
        };

        // Determine animation key based on path depth and current path
        const getAnimationKey = (): string => {
            if (path.segments.length === 0) return 'root';
            if (isAtSubCategoryLevel) return `subcategory-${currentCategory}`;
            return `content-${path.segments.join('-')}`;
        };

        // iOS-style slide animation:
        // Forward: new page slides in from right (100% → 0%), old page stays still
        // Backward: revealed page stays still (starts at 0%), exiting page slides out to right (0% → 100%)
        const getSlideInitialX = (): string => {
            if (animationDirection === 'forward') return '100%';
            if (animationDirection === 'backward') return '0%'; // Revealed page doesn't move
            return '0%';
        };

        const getSlideExitX = (): string => {
            if (animationDirection === 'forward') return '0%'; // Covered page doesn't move
            if (animationDirection === 'backward') return '100%'; // Exiting page slides right
            return '0%';
        };

        // iOS spring physics for natural feel
        const mobileSlideTransition: Transition = {
            type: 'spring',
            stiffness: 300,
            damping: 30,
            mass: 0.8,
        };

        return (
            <div className="w-full h-full overflow-hidden relative">
                <AnimatePresence mode="sync" initial={false}>
                    <motion.div
                        key={getAnimationKey()}
                        initial={shouldAnimate ? { x: getSlideInitialX(), opacity: 1 } : false}
                        animate={{ x: '0%', opacity: 1 }}
                        exit={shouldAnimate ? {
                            x: getSlideExitX(),
                            opacity: 1,
                            zIndex: animationDirection === 'backward' ? 10 : 1
                        } : undefined}
                        transition={mobileSlideTransition}
                        style={{
                            // Forward: incoming page on top (10), Backward: entering page below (0)
                            zIndex: animationDirection === 'forward' ? 10 : 0
                        }}
                        className="absolute inset-0 w-full h-full overflow-y-auto bg-theme-primary"
                    >
                        {/* Mobile navigation: root list, sub-category list, or content */}
                        {path.segments.length === 0 ? (
                            renderMobileRoot()
                        ) : isAtSubCategoryLevel && currentConfigCategory ? (
                            renderMobileSubCategory(currentConfigCategory)
                        ) : (
                            renderMobileContentWithHeader()
                        )}

                        {/* Bottom Spacer for mobile tab bar */}
                        <div style={{ height: LAYOUT.TABBAR_HEIGHT + LAYOUT.PAGE_MARGIN }} aria-hidden="true" />
                    </motion.div>
                </AnimatePresence>
            </div>
        );
    }

    // Desktop: Content only (main sidebar handles navigation)
    return (
        <div className="w-full p-2 md:p-8 max-w-[2000px] mx-auto">
            {/* Page Header with Breadcrumbs */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2 text-theme-primary flex items-center gap-2 flex-wrap">
                    <span>Settings</span>
                    {getBreadcrumbs().map((crumb, index) => (
                        <span key={index} className="flex items-center gap-2">
                            <span className="text-theme-tertiary font-normal">›</span>
                            <span>{crumb}</span>
                        </span>
                    ))}
                </h1>
                {path.segments.length === 0 && (
                    <p className="text-theme-secondary">
                        {hasAdminAccess
                            ? 'Manage your personal preferences and system configuration'
                            : 'Manage your personal preferences'
                        }
                    </p>
                )}
            </div>

            {/* Settings Content */}
            <Card padding="none">
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={currentCategory}
                        initial={shouldAnimate ? { opacity: 0, x: getInitialX() } : false}
                        animate={{ opacity: 1, x: 0 }}
                        exit={shouldAnimate ? { opacity: 0, x: getExitX() } : undefined}
                        transition={contentSpring}
                        className="p-6"
                    >
                        {renderContent()}
                    </motion.div>
                </AnimatePresence>
            </Card>

            {/* Bottom Spacer for desktop */}
            <div style={{ height: LAYOUT.PAGE_MARGIN }} aria-hidden="true" />
        </div>
    );
};

// Main component wrapped with navigation provider
const UserSettings = (): React.JSX.Element => {
    return (
        <SettingsNavProvider>
            <SettingsAnimationProvider>
                <SettingsContent />
            </SettingsAnimationProvider>
        </SettingsNavProvider>
    );
};

export default UserSettings;
