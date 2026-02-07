import React, { useEffect, ReactNode } from 'react';
import { Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { configApi } from './api/endpoints';
import logger from './utils/logger';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SystemConfigProvider } from './context/SystemConfigContext';
import { AppDataProvider } from './context/AppDataContext';
import { NotificationProvider } from './context/NotificationContext';
import { LayoutProvider, useLayout } from './context/LayoutContext';
import { DashboardEditProvider } from './context/DashboardEditContext';
import { SharedSidebarProvider, useSharedSidebar } from './components/sidebar/SharedSidebarContext';
import { LAYOUT } from './constants/layout';
import ProtectedRoute from './components/common/ProtectedRoute';
import Sidebar from './components/Sidebar';
import FaviconInjector from './components/FaviconInjector';
import AppTitle from './components/AppTitle';
import ToastContainer from './components/notifications/ToastContainer';
import { useSettingsSSE } from './hooks/useSettingsSSE';
import { useConnectionToasts } from './hooks/useConnectionToasts';

import Login from './app/login/Login';
import PlexLoading from './app/login/PlexLoading';
import Setup from './app/setup/Setup';
import PlexSetup from './app/plex-setup/PlexSetup';
import MainContent from './app/MainContent';
import SafeAreaBlur from './components/common/SafeAreaBlur';
import { initHaptics, cleanupHaptics } from './utils/haptics';

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

interface UserConfigResponse {
    theme?: {
        mode?: string;
        customColors?: Record<string, string>;
    };
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

    // SSE-based settings sync - invalidates React Query caches when settings change
    useSettingsSSE();

    // P9: SSE connection state toasts (reconnecting, reconnected, failed)
    useConnectionToasts();

    // Main container always uses collapsed sidebar width
    // Settings page handles its own extra padding when sidebar is expanded
    const sidebarPadding = isMobile ? 0 : LAYOUT.SIDEBAR_WIDTH;

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
        </>
    );
};

// Main layout component that wraps with SharedSidebarProvider
// NOTE: DashboardEditProvider MUST wrap SharedSidebarProvider so that
// SharedSidebarContext can access dashboardEdit state for navigation guards
const MainLayout: React.FC = () => {
    return (
        <DashboardEditProvider>
            <SharedSidebarProvider>
                <MainLayoutContent />
            </SharedSidebarProvider>
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
                            <AppDataProvider>
                                <NotificationProvider>
                                    <LayoutProvider>
                                        <ToastContainer />
                                        <Routes>
                                            <Route path="/login" element={<Login />} />
                                            <Route path="/login/plex/loading" element={<PlexLoading />} />
                                            <Route path="/setup" element={<Setup />} />
                                            <Route path="/plex-setup" element={<PlexSetup />} />

                                            {/* Protected Routes with Layout-aware Wrapper */}
                                            <Route path="/*" element={<MainLayout />} />
                                        </Routes>
                                    </LayoutProvider>
                                </NotificationProvider>
                            </AppDataProvider>
                        </SystemConfigProvider>
                    </ThemeProvider>
                </CustomColorLoader>
            </AuthProvider>
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    );
};

export default App;
