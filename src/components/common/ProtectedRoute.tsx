import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSystemConfig } from '../../context/SystemConfigContext';
import { hasPermission } from '../../utils/permissions';

export interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredPermission?: string | null;
}

const ProtectedRoute = ({ children, requiredPermission = null }: ProtectedRouteProps): React.JSX.Element => {
    const { user, loading: authLoading, isAuthenticated } = useAuth();
    const { systemConfig, loading: configLoading } = useSystemConfig();
    const location = useLocation();

    // Splash screen covers everything during load - no need for visible spinner here
    if (authLoading || configLoading) {
        return <></>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Check specific permission if required
    if (requiredPermission && systemConfig) {
        const allowed = hasPermission(user, requiredPermission, systemConfig as unknown as Parameters<typeof hasPermission>[2]);
        if (!allowed) {
            // Redirect to dashboard with access denied message
            return <Navigate to="dashboard" replace />;
        }
    }

    return <>{children}</>;
};

export default ProtectedRoute;
