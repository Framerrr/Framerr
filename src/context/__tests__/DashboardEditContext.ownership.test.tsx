/**
 * Keep-alive ownership: only the registered visible dashboard may push edit state
 * or clear handlers — hidden instances must not desync mobile tab-bar edit chrome.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { DashboardEditProvider } from '../DashboardEditContext';
import { useDashboardEdit } from '../useDashboardEdit';

const noopHandlers = {
    handleSave: async () => undefined,
    handleCancel: () => undefined,
    handleAddWidget: () => undefined,
    handleRelink: () => undefined,
    handleUndo: () => undefined,
    handleRedo: () => undefined,
    handleEnterEditMode: () => undefined,
};

function wrapper({ children }: { children: ReactNode }) {
    return <DashboardEditProvider>{children}</DashboardEditProvider>;
}

describe('DashboardEditContext ownership', () => {
    it('ignores updateEditState from a non-owner dashboard id', () => {
        const { result } = renderHook(() => useDashboardEdit(), { wrapper });

        act(() => {
            result.current!.registerDashboard('dash-a', noopHandlers);
            result.current!.updateEditState('dash-a', {
                editMode: true,
                hasUnsavedChanges: false,
                pendingUnlink: false,
            });
        });
        expect(result.current!.editMode).toBe(true);

        act(() => {
            result.current!.updateEditState('dash-b', {
                editMode: false,
                hasUnsavedChanges: true,
                pendingUnlink: false,
            });
        });
        expect(result.current!.editMode).toBe(true);
        expect(result.current!.hasUnsavedChanges).toBe(false);
    });

    it('does not let a stale unregister wipe the newly-active owner', () => {
        const { result } = renderHook(() => useDashboardEdit(), { wrapper });

        act(() => {
            result.current!.registerDashboard('dash-a', noopHandlers);
            result.current!.updateEditState('dash-a', {
                editMode: true,
                hasUnsavedChanges: false,
                pendingUnlink: false,
            });
            // B becomes visible and claims ownership (A's cleanup may run after).
            result.current!.registerDashboard('dash-b', noopHandlers);
            result.current!.updateEditState('dash-b', {
                editMode: false,
                hasUnsavedChanges: false,
                pendingUnlink: false,
            });
            result.current!.unregisterDashboard('dash-a');
        });

        expect(result.current!.handlers).not.toBeNull();
        expect(result.current!.editMode).toBe(false);

        act(() => {
            result.current!.updateEditState('dash-b', {
                editMode: true,
                hasUnsavedChanges: false,
                pendingUnlink: false,
            });
        });
        expect(result.current!.editMode).toBe(true);
    });
});
