/**
 * Framerr Design System - UI Primitives
 * 
 * Central export for all UI primitive components.
 * Import from '@/shared/ui' for consistent, accessible UI components.
 * 
 * @example
 * import { Modal, Switch, Select, Popover } from '@/shared/ui';
 */

// ===========================
// Animation Presets
// ===========================

export {
    // Transitions
    springTransition,
    fastSpring,
    slowSpring,
    easeTransition,
    // Variants
    scaleIn,
    fadeSlideUp,
    popIn,
    fade,
    slideFromRight,
    slideFromLeft,
    staggerContainer,
    staggerItem,
    backdrop,
} from './animations';

// ===========================
// Compound Components
// ===========================

// Modal - Dialogs, forms, confirmations
export { Modal } from './Modal';
export type { ModalProps, ModalHeaderProps, ModalBodyProps, ModalFooterProps, ModalSize } from './Modal';

// Select - Dropdown selection
export { Select, SelectProvider } from './Select';
export type { SelectProps, SelectTriggerProps, SelectValueProps, SelectContentProps, SelectItemProps } from './Select';

// Popover - Contextual info display
export { Popover } from './Popover';
export type { PopoverProps, PopoverTriggerProps, PopoverContentProps } from './Popover';

// SearchDropdown - Search input dropdown with custom close behavior
export { SearchDropdown } from './SearchDropdown';
export type {
    SearchDropdownProps,
    SearchDropdownContentProps,
    SearchDropdownSectionProps,
    SearchDropdownItemProps,
    SearchDropdownEmptyProps,
    SearchDropdownLoadingProps,
} from './SearchDropdown';

// DropdownMenu - Action menus
export { DropdownMenu } from './DropdownMenu';
export type {
    DropdownMenuProps,
    DropdownMenuTriggerProps,
    DropdownMenuContentProps,
    DropdownMenuItemProps,
    DropdownMenuSeparatorProps,
    DropdownMenuLabelProps
} from './DropdownMenu';

// Tabs - Tab navigation
export { Tabs } from './Tabs';
export type { TabsProps, TabsListProps, TabsTriggerProps, TabsContentProps } from './Tabs';

// ===========================
// Simple Components
// ===========================

// Switch - Toggle on/off
export { Switch } from './Switch';
export type { SwitchProps } from './Switch';

// Checkbox - Multi-select/boolean with indeterminate support
export { Checkbox } from './Checkbox';
export type { CheckboxProps } from './Checkbox';

// Badge - Status indicators
export { Badge } from './Badge';
export type { BadgeProps, BadgeVariant } from './Badge';

// Tooltip - Hover hints
export { Tooltip } from './Tooltip';
export type { TooltipProps } from './Tooltip';

// ConfirmButton - Inline delete with slide-out cancel
export { ConfirmButton } from './ConfirmButton';
export type { ConfirmButtonProps } from './ConfirmButton';

// ConfirmDialog - Modal confirmation for destructive actions
export { ConfirmDialog } from './ConfirmDialog';
export type { ConfirmDialogProps } from './ConfirmDialog';

// Button - Standard button with variants, sizes, loading state
export { Button, buttonSizeClasses } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize, IconPosition } from './Button';

// Form sizing - Shared size constants for Button, Select, Input consistency
export { formSizeClasses } from './formSizeClasses';
export type { FormSize } from './formSizeClasses';

// UserAvatar - User avatar with profile picture or initial fallback
export { UserAvatar } from './UserAvatar';

// MultiSelectDropdown - Generic multi-select with checkboxes and bulk actions
export { MultiSelectDropdown } from './MultiSelectDropdown';
export type { MultiSelectDropdownProps, MultiSelectOption } from './MultiSelectDropdown';

// IntegrationDropdown - Multi-select dropdown for integration selection
export { IntegrationDropdown } from './IntegrationDropdown';
export type { IntegrationDropdownProps, Integration } from './IntegrationDropdown';

// ViewModeToggle - Desktop/Mobile view mode toggle
export { ViewModeToggle } from './ViewModeToggle';
export type { ViewMode } from './ViewModeToggle';

// IntegrationNotificationsTab - Notification configuration for integration instances
export { IntegrationNotificationsTab } from './notifications';
export type { NotificationMode, NotificationEvent, NotificationConfigData } from './notifications';

// CodeEditor - Lightweight syntax-highlighted code editor
export { CodeEditor } from './CodeEditor';
