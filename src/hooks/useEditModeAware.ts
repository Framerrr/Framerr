import { useDashboardEdit } from '../context/DashboardEditContext';

/**
 * useEditModeAware - Convenience hook for widgets to easily respect edit mode
 * 
 * Usage:
 * const { editMode, withEditCheck } = useEditModeAware();
 * <button onClick={withEditCheck(openPopover)}>Details</button>
 */
export function useEditModeAware() {
    const context = useDashboardEdit();
    const editMode = context?.editMode ?? false;

    // Wrap any handler to no-op when in edit mode
    const withEditCheck = <T extends (...args: unknown[]) => void>(handler: T): T => {
        return ((...args: unknown[]) => {
            if (editMode) return;
            handler(...args);
        }) as T;
    };

    return { editMode, withEditCheck };
}

export default useEditModeAware;
