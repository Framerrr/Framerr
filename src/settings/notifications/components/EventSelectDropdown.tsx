import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, CheckSquare, XSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface EventDefinition {
    key: string;
    label: string;
}

interface DropdownPosition {
    top: number;
    left: number;
    width: number;
}

export interface EventSelectDropdownProps {
    label?: string;
    events?: EventDefinition[];
    selectedEvents?: string[];
    onChange: (selectedEvents: string[]) => void;
    disabled?: boolean;
    placeholder?: string;
}

/**
 * EventSelectDropdown - Multi-select dropdown for notification events
 */
const EventSelectDropdown = ({
    label,
    events = [],
    selectedEvents = [],
    onChange,
    disabled = false,
    placeholder = 'Select events...'
}: EventSelectDropdownProps): React.JSX.Element => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({ top: 0, left: 0, width: 0 });
    const triggerRef = useRef<HTMLButtonElement>(null);

    // Calculate dropdown position when opened
    useEffect(() => {
        if (isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const dropdownHeight = Math.min(events.length * 36 + 80, 300);

            // Determine if dropdown should open upward
            const shouldOpenUpward = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

            setDropdownPosition({
                top: shouldOpenUpward
                    ? rect.top + window.scrollY - dropdownHeight - 4
                    : rect.bottom + window.scrollY + 4,
                left: rect.left + window.scrollX,
                width: Math.max(rect.width, 280)
            });
        }
    }, [isOpen, events.length]);

    const handleSelectAll = (): void => {
        onChange(events.map(e => e.key));
    };

    const handleSelectNone = (): void => {
        onChange([]);
    };

    const handleToggleEvent = (eventKey: string): void => {
        const newSelection = selectedEvents.includes(eventKey)
            ? selectedEvents.filter(k => k !== eventKey)
            : [...selectedEvents, eventKey];
        onChange(newSelection);
    };

    const getDisplayText = (): string => {
        if (selectedEvents.length === 0) return placeholder;
        if (selectedEvents.length === events.length) return 'All events selected';
        if (selectedEvents.length === 1) {
            const event = events.find(e => e.key === selectedEvents[0]);
            return event?.label || '1 event selected';
        }
        return `${selectedEvents.length} events selected`;
    };

    // Dropdown content rendered via portal
    const dropdownContent = (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop to close */}
                    <div
                        className="fixed inset-0 z-[9998]"
                        onClick={() => setIsOpen(false)}
                    />
                    {/* Dropdown menu */}
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15 }}
                        style={{
                            position: 'absolute',
                            top: dropdownPosition.top,
                            left: dropdownPosition.left,
                            width: dropdownPosition.width,
                            zIndex: 9999
                        }}
                        className="bg-theme-secondary border border-theme rounded-lg shadow-lg overflow-hidden"
                    >
                        {/* Quick Actions */}
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-theme bg-theme-tertiary">
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                className="flex items-center gap-1.5 px-2 py-1 text-xs bg-theme-hover hover:bg-theme-primary rounded transition-colors text-theme-primary"
                            >
                                <CheckSquare size={14} />
                                Select All
                            </button>
                            <button
                                type="button"
                                onClick={handleSelectNone}
                                className="flex items-center gap-1.5 px-2 py-1 text-xs bg-theme-hover hover:bg-theme-primary rounded transition-colors text-theme-primary"
                            >
                                <XSquare size={14} />
                                Select None
                            </button>
                            <span className="ml-auto text-xs text-theme-tertiary">
                                {selectedEvents.length}/{events.length}
                            </span>
                        </div>

                        {/* Event List */}
                        <div className="max-h-56 overflow-y-auto py-1">
                            {events.map(event => {
                                const isSelected = selectedEvents.includes(event.key);
                                return (
                                    <div
                                        key={event.key}
                                        onClick={() => handleToggleEvent(event.key)}
                                        className="flex items-center gap-3 px-3 py-2 hover:bg-theme-hover cursor-pointer"
                                    >
                                        <div
                                            className={`
                        w-4 h-4 rounded border flex items-center justify-center
                        ${isSelected
                                                    ? 'bg-accent border-accent'
                                                    : 'bg-theme-primary border-theme'
                                                }
                      `}
                                        >
                                            {isSelected && <Check size={12} className="text-white" />}
                                        </div>
                                        <span className="text-sm text-theme-primary">{event.label}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Done button */}
                        <div className="border-t border-theme px-3 py-2">
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="w-full px-3 py-1.5 bg-accent text-white text-sm rounded hover:bg-accent/90 transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );

    return (
        <div className="relative">
            {/* Label */}
            {label && (
                <label className="block text-sm font-medium text-theme-secondary mb-2">
                    {label}
                </label>
            )}

            {/* Dropdown Trigger */}
            <button
                ref={triggerRef}
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
          w-full flex items-center justify-between gap-2 px-4 py-2.5
          bg-theme-tertiary border border-theme rounded-lg
          text-sm text-left
          transition-colors
          ${disabled
                        ? 'opacity-50 cursor-not-allowed text-theme-tertiary'
                        : 'hover:bg-theme-hover cursor-pointer text-theme-primary'
                    }
        `}
            >
                <span className={selectedEvents.length === 0 ? 'text-theme-tertiary' : ''}>
                    {getDisplayText()}
                </span>
                <ChevronDown
                    size={16}
                    className={`text-theme-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Render dropdown via portal */}
            {createPortal(dropdownContent, document.body)}
        </div>
    );
};

export default EventSelectDropdown;
