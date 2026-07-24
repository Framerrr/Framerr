import React, { useEffect, useMemo, ReactNode, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configApi } from './api/endpoints';
import logger from './utils/logger';
import api from './api/client';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { ThemeProvider } from './context/ThemeContext';
import { SystemConfigProvider } from './context/SystemConfigContext';
import { IntegrationDataProvider } from './app/providers/IntegrationDataProvider';
import { AppBrandingProvider } from './app/providers/AppBrandingProvider';
import { NotificationProvider } from './context/notification';
import { LayoutProvider } from './context/LayoutContext';
import { useLayout } from './context/useLayout';
import { DashboardEditProvider } from './context/DashboardEditContext';
import { SharedSidebarProvider } from '@/app/sidebar/SharedSidebarContext';
import { useSharedSidebar } from '@/app/sidebar/context/useSharedSidebar';
import { WalkthroughProvider, WalkthroughOverlay } from './features/walkthrough';
import { LAYOUT } from './constants/layout';
import ProtectedRoute from '@/app/ProtectedRoute';
import Sidebar from '@/app/Sidebar';
import FaviconInjector from '@/app/FaviconInjector';
import AppTitle from '@/app/AppTitle';
import { ToastContainer } from './features/notifications';
import { useSettingsSSE } from '@/features/realtime/useSettingsSSE';
import { useConnectionToasts } from '@/app/useConnectionToasts';

const Login = React.lazy(() => import('./app/login/Login'));
const PlexLoading = React.lazy(() => import('./app/login/PlexLoading'));
const ChangePassword = React.lazy(() => import('./app/change-password/ChangePassword'));
const Setup = React.lazy(() => import('./app/setup/Setup'));
const SSOSetup = React.lazy(() => import('./app/sso-setup/SSOSetup'));
import MainContent from './app/MainContent';
import SafeAreaBlur from '@/app/SafeAreaBlur';
import { initHaptics, cleanupHaptics } from './utils/haptics';
import LoadingSpinner from './shared/ui/LoadingSpinner/LoadingSpinner';

// Create React Query client with sensible defaults
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 30, // 30 seconds
            retry: 1,
            refetchOnWindowFocus: false, // Disable auto-refetch on tab focus
        },
    },
});

interface CustomColorLoaderProps {
    children: ReactNode;
}

// Component to load and apply custom colors after user authentication
const CustomColorLoader: React.FC<CustomColorLoaderProps> = ({ children }) => {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return; // Only load if user is authenticated

        const loadCustomColors = async (): Promise<void> => {
            try {
                const response = await configApi.getUser();

                // If user has custom theme, apply the colors
                if (response?.theme?.mode === 'custom' && response?.theme?.customColors) {
                    const colors = response.theme.customColors;
                    Object.entries(colors).forEach(([key, value]) => {
                        document.documentElement.style.setProperty(`--${key}`, value);
                    });
                }
            } catch (error) {
                logger.error('Could not load custom colors:', error);
            }
        };

        loadCustomColors();
    }, [user]); // Re-run when user changes (login/logout)

    return <>{children}</>;
};

// Inner layout content that uses sidebar context for dynamic padding
const MainLayoutContent: React.FC = () => {
    const { isMobile } = useLayout();
    const { isSidebarHidden } = useSharedSidebar();

    // SSE-based settings sync - invalidates React Query caches when settings change
    useSettingsSSE();

    // P9: SSE connection state toasts (reconnecting, reconnected, failed)
    useConnectionToasts();

    // Main container: collapsed sidebar width, PAGE_MARGIN if sidebar is hidden (keeps a visible trigger strip on left)
    const isOnSettingsPage = window.location.hash.slice(1).startsWith('settings');
    const sidebarPadding = isMobile ? 0 : (isSidebarHidden && !isOnSettingsPage ? 0 : LAYOUT.SIDEBAR_WIDTH);

    return (
        <>
            {/* Safe area blur overlay for top notch/camera region */}
            <SafeAreaBlur />

            {/* Outer wrapper: fills viewport (safe-area handled by html in index.css) */}
            <div
                className="flex flex-col w-full h-full"
                style={{
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    // Safe-area padding is applied on html element in index.css
                    // Do NOT add it here or you get double padding
                }}
            >
                <ProtectedRoute>
                    {/* Main flex container - sidebar + content */}
                    <div className="flex w-full flex-1 min-h-0">
                        <Sidebar />
                        <main
                            className="flex-1 min-w-0 min-h-0 h-full"
                            style={{
                                paddingLeft: sidebarPadding,
                                transition: 'padding-left 0.3s ease',
                                backgroundColor: 'var(--bg-primary)',
                                overflow: 'hidden', // Scroll control handled by MainContent
                            }}
                        >
                            <Routes>
                                <Route path="/*" element={<MainContent />} />
                            </Routes>
                        </main>
                    </div>
                </ProtectedRoute>
            </div>

            {/* Walkthrough overlay — renders above everything when active */}
            <WalkthroughOverlay />
        </>
    );
};

// Main layout component that wraps with SharedSidebarProvider
// NOTE: DashboardEditProvider MUST wrap SharedSidebarProvider so that
// SharedSidebarContext can access dashboardEdit state for navigation guards
const MainLayout: React.FC = () => {
    const { user } = useAuth();
    const userRole = user?.group === 'admin' ? 'admin' : 'user';

    // Walkthrough persistence — injected to keep engine app-agnostic
    const walkthroughPersistence = useMemo(() => ({
        onFlowComplete: async (flowId: string) => {
            await api.post('/api/walkthrough/complete', { flowId });
        },
        fetchCompletedFlows: async () => {
            const data = await api.get<{ flows: Record<string, boolean> }>('/api/walkthrough/status');
            return data.flows;
        },
        resetFlow: async () => {
            await api.post('/api/walkthrough/reset', {});
        },
    }), []);

    return (
        <DashboardEditProvider>
            <WalkthroughProvider
                userRole={userRole}
                persistence={walkthroughPersistence}
                autoStartFlowId="onboarding"
                onFlowComplete={(flowId) => {
                    // Dispatch event for Dashboard to save and exit edit mode
                    window.dispatchEvent(new CustomEvent('walkthrough-flow-complete', { detail: { flowId } }));
                }}
            >
                <SharedSidebarProvider>
                    <MainLayoutContent />
                </SharedSidebarProvider>
            </WalkthroughProvider>
        </DashboardEditProvider>
    );
};

const App: React.FC = () => {
    // Initialize haptic feedback system
    useEffect(() => {
        initHaptics();
        return () => cleanupHaptics();
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <FaviconInjector />
                <AppTitle />
                <CustomColorLoader>
                    <ThemeProvider>
                        <SystemConfigProvider>
                            <AppBrandingProvider>
                                <IntegrationDataProvider>
                                    <NotificationProvider>
                                        <LayoutProvider>
                                            <ToastContainer />
                                            <Suspense fallback={
                                                <div className="flex items-center justify-center w-full h-full min-h-screen">
                                                    <LoadingSpinner size="lg" />
                                                </div>
                                            }>
                                                <Routes>
                                                    <Route path="/login" element={<Login />} />
                                                    <Route path="/login/plex/loading" element={<PlexLoading />} />
                                                    <Route path="/change-password" element={<ChangePassword />} />
                                                    <Route path="/setup" element={<Setup />} />
                                                    <Route path="/sso-setup" element={<SSOSetup />} />

                                                    {/* Protected Routes with Layout-aware Wrapper */}
                                                    <Route path="/*" element={<MainLayout />} />
                                                </Routes>
                                            </Suspense>
                                        </LayoutProvider>
                                    </NotificationProvider>
                                </IntegrationDataProvider>
                            </AppBrandingProvider>
                        </SystemConfigProvider>
                    </ThemeProvider>
                </CustomColorLoader>
            </AuthProvider>
            {/* <ReactQueryDevtools initialIsOpen={false} /> */}
        </QueryClientProvider>
    );
};

export default App;
