/**
 * Grid Core History - Multi-Stack Undo/Redo System
 *
 * Surface-agnostic history management for grid layouts.
 * Provides separate stacks for desktop and mobile layouts.
 *
 * ARCHITECTURE REFERENCE: docs/grid-rework/ARCHITECTURE.md
 *
 * Design:
 * - Two independent stacks: desktop and mobile
 * - Each stack stores HistorySnapshot[] (full widget state)
 * - Maximum 50 entries per stack (overflow trimmed from beginning)
 * - Pure hook with no surface-specific logic
 * - Wrappers decide WHICH stack to use (business logic)
 *
 * Usage:
 * ```tsx
 * const history = useLayoutHistory();
 *
 * // Push to specific stack
 * history.push('desktop', { widgets });
 *
 * // Undo from specific stack
 * const prev = history.undo('mobile');
 *
 * // Clear all or specific
 * history.clear(); // all
 * history.clear('desktop'); // just desktop
 * ```
 */

import { useState, useCallback, useRef } from 'react';
import type { HistorySnapshot, HistoryStackName, UseLayoutHistoryReturn } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum history entries per stack before trimming */
export const MAX_HISTORY_SIZE = 50;

// ============================================================================
// INTERNAL TYPES
// ============================================================================

/** Internal structure for a single stack */
interface HistoryStack {
    undo: HistorySnapshot[];
    redo: HistorySnapshot[];
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * useLayoutHistory - Multi-stack history management hook
 *
 * Provides separate undo/redo stacks for desktop and mobile layouts.
 * Each call creates a new isolated instance (not shared between components).
 *
 * @returns Multi-stack history management interface
 */
export function useLayoutHistory(): UseLayoutHistoryReturn {
    // Desktop stacks
    const [desktopUndo, setDesktopUndo] = useState<HistorySnapshot[]>([]);
    const [desktopRedo, setDesktopRedo] = useState<HistorySnapshot[]>([]);

    // Mobile stacks
    const [mobileUndo, setMobileUndo] = useState<HistorySnapshot[]>([]);
    const [mobileRedo, setMobileRedo] = useState<HistorySnapshot[]>([]);

    // Flag to prevent recursive captures during undo/redo operations
    const isOperationInProgressRef = useRef(false);

    // ========== HELPER: Get setters for a stack ==========

    const getStackSetters = (stack: HistoryStackName) => {
        if (stack === 'desktop') {
            return { setUndo: setDesktopUndo, setRedo: setDesktopRedo };
        }
        return { setUndo: setMobileUndo, setRedo: setMobileRedo };
    };

    const getStackState = (stack: HistoryStackName): HistoryStack => {
        if (stack === 'desktop') {
            return { undo: desktopUndo, redo: desktopRedo };
        }
        return { undo: mobileUndo, redo: mobileRedo };
    };

    // ========== ACTIONS ==========

    /**
     * Push a new snapshot to a specific stack.
     * Clears the redo stack for that stack (new action breaks redo chain).
     */
    const push = useCallback((stack: HistoryStackName, snapshot: HistorySnapshot): void => {
        if (isOperationInProgressRef.current) return;

        const { setUndo, setRedo } = getStackSetters(stack);

        setUndo(prev => {
            // Deep clone to prevent mutation issues
            const cloned: HistorySnapshot = JSON.parse(JSON.stringify(snapshot));
            const newStack = [...prev, cloned];

            // Trim if exceeds max size
            return newStack.length > MAX_HISTORY_SIZE
                ? newStack.slice(-MAX_HISTORY_SIZE)
                : newStack;
        });

        // New action breaks redo chain for this stack
        setRedo([]);
    }, []);

    /**
     * Undo the last action from a specific stack.
     * Returns previous snapshot, or null if nothing to undo.
     */
    const undo = useCallback((stack: HistoryStackName): HistorySnapshot | null => {
        const { undo: undoStack } = getStackState(stack);
        if (undoStack.length === 0) return null;

        isOperationInProgressRef.current = true;

        try {
            const { setUndo } = getStackSetters(stack);

            // Pop from undo stack
            const newUndoStack = [...undoStack];
            const previous = newUndoStack.pop();

            if (!previous) {
                return null;
            }

            setUndo(newUndoStack);

            return previous;
        } finally {
            // Reset flag after microtask to allow state updates to complete
            setTimeout(() => {
                isOperationInProgressRef.current = false;
            }, 0);
        }
    }, [desktopUndo, mobileUndo]);

    /**
     * Redo the last undone action from a specific stack.
     * Returns next snapshot, or null if nothing to redo.
     */
    const redo = useCallback((stack: HistoryStackName): HistorySnapshot | null => {
        const { redo: redoStack } = getStackState(stack);
        if (redoStack.length === 0) return null;

        isOperationInProgressRef.current = true;

        try {
            const { setRedo } = getStackSetters(stack);

            // Pop from redo stack
            const newRedoStack = [...redoStack];
            const next = newRedoStack.pop();

            if (!next) {
                return null;
            }

            setRedo(newRedoStack);

            return next;
        } finally {
            setTimeout(() => {
                isOperationInProgressRef.current = false;
            }, 0);
        }
    }, [desktopRedo, mobileRedo]);

    /**
     * Push current state to redo stack (before applying undo result).
     */
    const pushToRedo = useCallback((stack: HistoryStackName, snapshot: HistorySnapshot): void => {
        const { setRedo } = getStackSetters(stack);
        setRedo(prev => [...prev, JSON.parse(JSON.stringify(snapshot))]);
    }, []);

    /**
     * Push current state to undo stack (before applying redo result).
     */
    const pushToUndo = useCallback((stack: HistoryStackName, snapshot: HistorySnapshot): void => {
        const { setUndo } = getStackSetters(stack);
        setUndo(prev => [...prev, JSON.parse(JSON.stringify(snapshot))]);
    }, []);

    /**
     * Clear history.
     * If stack is provided, clears only that stack.
     * If no stack provided, clears all stacks.
     */
    const clear = useCallback((stack?: HistoryStackName): void => {
        if (stack === 'desktop') {
            setDesktopUndo([]);
            setDesktopRedo([]);
        } else if (stack === 'mobile') {
            setMobileUndo([]);
            setMobileRedo([]);
        } else {
            // Clear all
            setDesktopUndo([]);
            setDesktopRedo([]);
            setMobileUndo([]);
            setMobileRedo([]);
        }
    }, []);

    // ========== COMPUTED ==========

    /**
     * Check if undo is available for a specific stack
     */
    const canUndo = useCallback((stack: HistoryStackName): boolean => {
        const { undo } = getStackState(stack);
        return undo.length > 0;
    }, [desktopUndo, mobileUndo]);

    /**
     * Check if redo is available for a specific stack
     */
    const canRedo = useCallback((stack: HistoryStackName): boolean => {
        const { redo } = getStackState(stack);
        return redo.length > 0;
    }, [desktopRedo, mobileRedo]);

    return {
        push,
        undo,
        redo,
        canUndo,
        canRedo,
        clear,
        pushToRedo,
        pushToUndo,
    };
}
