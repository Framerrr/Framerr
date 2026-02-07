/**
 * EventDropdown - Multi-select dropdown for webhook event selection
 * 
 * Thin wrapper around MultiSelectDropdown primitive.
 * Maps Event objects to generic options.
 */

import React from 'react';
import { MultiSelectDropdown } from '../../../shared/ui';

// ============================================================================
// Types
// ============================================================================

export interface EventDefinition {
    key: string;
    label: string;
    category?: string;
    adminOnly?: boolean;
}

export interface EventDropdownProps {
    /** Label displayed above the dropdown */
    label?: string;
    /** Available events to select from */
    events: EventDefinition[];
    /** Currently selected event keys */
    selectedEvents: string[];
    /** Callback when selection changes */
    onChange: (selectedKeys: string[]) => void;
    /** Disable the dropdown */
    disabled?: boolean;
    /** Custom placeholder text */
    placeholder?: string;
}

// ============================================================================
// Component
// ============================================================================

const EventDropdown: React.FC<EventDropdownProps> = ({
    label,
    events,
    selectedEvents,
    onChange,
    disabled = false,
    placeholder = 'Select events...'
}) => {
    // Map events to generic options
    const options = events.map(e => ({
        id: e.key,
        label: e.label
    }));

    return (
        <div className="space-y-2">
            {label && (
                <label className="text-sm font-medium text-theme-primary">
                    {label}
                </label>
            )}
            <MultiSelectDropdown
                options={options}
                selectedIds={selectedEvents}
                onChange={onChange}
                disabled={disabled}
                placeholder={placeholder}
                showBulkActions
                size="md"
                emptyText="No events"
            />
        </div>
    );
};

export default EventDropdown;
