import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

/**
 * DashboardEditContext - Central state store for dashboard editing
 * 
 * The provider lives in MainLayout (wrapping both Sidebar and MainContent).
 * Dashboard registers itself and updates the state when edit mode changes.
 * Sidebar reads the state to decide whether to block navigation and
 * to transform into edit controls on mobile.
 */

export interface DashboardEditContextValue {
    // Read-only state for consumers (like Sidebar)
    editMode: boolean;
    hasUnsavedChanges: boolean;
    pendingUnlink: boolean;
    pendingDestination: string | null;

    // Undo/Redo state (for mobile tab bar)
    canUndo: boolean;
    canRedo: boolean;
    saving: boolean;
    mobileLayoutMode: 'linked' | 'independent';

    // Actions available to consumers
    setPendingDestination: (dest: string | null) => void;

    // Dashboard handlers (callable by Sidebar for mobile edit controls)
    handlers: DashboardHandlers | null;

    // Registration for Dashboard to push its state
    registerDashboard: (handlers: DashboardHandlers) => void;
    unregisterDashboard: () => void;
    updateEditState: (state: EditStateUpdate) => void;
}

export interface DashboardHandlers {
    handleSave: () => Promise<void>;
    handleCancel: () => void;
    handleAddWidget: () => void;
    handleRelink: () => void;
    handleUndo: () => void;
    handleRedo: () => void;
    handleEnterEditMode: (isTouch?: boolean) => void;
}

export interface EditStateUpdate {
    editMode: boolean;
    hasUnsavedChanges: boolean;
    pendingUnlink: boolean;
    canUndo?: boolean;
    canRedo?: boolean;
    saving?: boolean;
    mobileLayoutMode?: 'linked' | 'independent';
}

const DashboardEditContext = createContext<DashboardEditContextValue | null>(null);

export interface DashboardEditProviderProps {
    children: ReactNode;
}

export function DashboardEditProvider({ children }: DashboardEditProviderProps): React.JSX.Element {
    // Edit state - updated by Dashboard
    const [editMode, setEditMode] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [pendingUnlink, setPendingUnlink] = useState(false);
    const [pendingDestination, setPendingDestination] = useState<string | null>(null);

    // Undo/Redo state
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const [saving, setSaving] = useState(false);
    const [mobileLayoutMode, setMobileLayoutMode] = useState<'linked' | 'independent'>('linked');

    // Dashboard handlers - set when Dashboard registers
    const [dashboardHandlers, setDashboardHandlers] = useState<DashboardHandlers | null>(null);

    const registerDashboard = useCallback((handlers: DashboardHandlers) => {
        setDashboardHandlers(handlers);
    }, []);

    const unregisterDashboard = useCallback(() => {
        setDashboardHandlers(null);
        // Reset state when Dashboard unmounts
        setEditMode(false);
        setHasUnsavedChanges(false);
        setPendingUnlink(false);
        setPendingDestination(null);
        setCanUndo(false);
        setCanRedo(false);
        setSaving(false);
        setMobileLayoutMode('linked');
    }, []);

    const updateEditState = useCallback((state: EditStateUpdate) => {
        setEditMode(state.editMode);
        setHasUnsavedChanges(state.hasUnsavedChanges);
        setPendingUnlink(state.pendingUnlink);
        if (state.canUndo !== undefined) setCanUndo(state.canUndo);
        if (state.canRedo !== undefined) setCanRedo(state.canRedo);
        if (state.saving !== undefined) setSaving(state.saving);
        if (state.mobileLayoutMode !== undefined) setMobileLayoutMode(state.mobileLayoutMode);
    }, []);

    // Memoize context value to prevent unnecessary re-renders
    const value: DashboardEditContextValue = useMemo(() => ({
        editMode,
        hasUnsavedChanges,
        pendingUnlink,
        pendingDestination,
        canUndo,
        canRedo,
        saving,
        mobileLayoutMode,
        setPendingDestination,
        handlers: dashboardHandlers,
        registerDashboard,
        unregisterDashboard,
        updateEditState,
    }), [
        editMode, hasUnsavedChanges, pendingUnlink, pendingDestination,
        canUndo, canRedo, saving, mobileLayoutMode,
        dashboardHandlers, registerDashboard, unregisterDashboard, updateEditState
    ]);

    return (
        <DashboardEditContext.Provider value={value}>
            {children}
        </DashboardEditContext.Provider>
    );
}

export function useDashboardEdit(): DashboardEditContextValue | null {
    return useContext(DashboardEditContext);
}

export default DashboardEditContext;
