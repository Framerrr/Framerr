/**
 * IntegrationDropdown - Multi-select dropdown for integration selection
 * 
 * Thin wrapper around MultiSelectDropdown primitive.
 * Maps Integration objects to generic options.
 * 
 * Used by:
 * - WidgetShareModal (size="md", align="start")
 * - WidgetShareCard (size="sm", align="end")
 */

import React from 'react';
import { MultiSelectDropdown } from '../MultiSelectDropdown';

// ============================================================================
// Types
// ============================================================================

export interface Integration {
    id: string;
    name: string;
    type: string;
}

export interface IntegrationDropdownProps {
    /** Available integrations to select from */
    integrations: Integration[];
    /** Currently selected integration IDs */
    selectedIds: string[];
    /** Callback when selection changes */
    onChange: (ids: string[]) => void;
    /** Disable the dropdown */
    disabled?: boolean;
    /** Size variant - sm for compact cards, md for modals */
    size?: 'sm' | 'md';
    /** Popover alignment relative to trigger */
    align?: 'start' | 'end';
    /** Custom placeholder text */
    placeholder?: string;
    /** Show Select All / Select None buttons */
    showBulkActions?: boolean;
    /** Maximum number of selections allowed (optional) */
    maxSelections?: number;
    /** Whether trigger should fill full width of container */
    fullWidth?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const IntegrationDropdown: React.FC<IntegrationDropdownProps> = ({
    integrations,
    selectedIds,
    onChange,
    disabled = false,
    size = 'md',
    align = 'start',
    placeholder = 'Select integration',
    showBulkActions,
    maxSelections,
    fullWidth,
}) => {
    // Map integrations to generic options
    const options = integrations.map(integration => ({
        id: integration.id,
        label: integration.name,
    }));

    return (
        <MultiSelectDropdown
            options={options}
            selectedIds={selectedIds}
            onChange={onChange}
            disabled={disabled}
            size={size}
            align={align}
            placeholder={placeholder}
            showBulkActions={showBulkActions}
            emptyText="No integrations"
            maxSelections={maxSelections}
            fullWidth={fullWidth}
        />
    );
};

export default IntegrationDropdown;
