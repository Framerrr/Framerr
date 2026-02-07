/**
 * Common Component Props
 * Props types for reusable UI components
 */

import type { ComponentType, ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

// ============================================
// Button
// ============================================

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: ComponentType<{ size?: number }>;
    fullWidth?: boolean;
    loading?: boolean;
}

// ============================================
// Card
// ============================================

export type CardPadding = 'sm' | 'md' | 'lg' | 'xl' | 'none';

export interface CardProps {
    children: ReactNode;
    className?: string;
    hover?: boolean;
    padding?: CardPadding;
}

export interface CardHeaderProps {
    title: string;
    description?: string;
    action?: ReactNode;
    divider?: boolean;
}

// ============================================
// Input
// ============================================

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
    icon?: ComponentType<{ size?: number }>;
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
    helperText?: string;
    rows?: number;
}

// ============================================
// Modal
// ============================================

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    size?: ModalSize;
    className?: string;
}

// ============================================
// Dropdown
// ============================================

export interface DropdownOption<T = string> {
    value: T;
    label: string;
    disabled?: boolean;
}

export interface DropdownProps<T = string> {
    label?: string;
    value: T;
    onChange: (value: T) => void;
    options: DropdownOption<T>[];
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

// ============================================
// Toggle
// ============================================

export interface ToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label?: string;
    disabled?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

// ============================================
// LoadingSpinner
// ============================================

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'small' | 'medium' | 'large';

export interface LoadingSpinnerProps {
    size?: SpinnerSize;
    message?: string;
    className?: string;
}

// ============================================
// ColorPicker
// ============================================

export interface ColorPreset {
    name: string;
    value: string;
}

export interface ColorPickerProps {
    value: string;
    onChange: (color: string) => void;
    label?: string;
    description?: string;
    disabled?: boolean;
    presets?: ColorPreset[];
}

// ============================================
// IconPicker
// ============================================

export interface UploadedIcon {
    id: string;
    filename: string;
    originalName?: string;
    mimeType?: string;
}

export interface IconPickerProps {
    value: string;
    onChange: (iconValue: string) => void;
    compact?: boolean;
    disabled?: boolean;
}

// ============================================
// ProtectedRoute
// ============================================

export interface ProtectedRouteProps {
    children: ReactNode;
    requiredPermission?: string | null;
}

// ============================================
// Integration Messages
// ============================================

export interface IntegrationMessageProps {
    serviceName: string;
}

// ============================================
// Tabs
// ============================================

export interface TabItem {
    id: string;
    label: string;
    icon?: ComponentType<{ size?: number }>;
    disabled?: boolean;
}

export interface TabsProps {
    tabs: TabItem[];
    activeTab: string;
    onChange: (tabId: string) => void;
    className?: string;
}

// ============================================
// Settings Components
// ============================================

export interface SettingsTab {
    id: string;
    label: string;
    icon: ComponentType<{ size?: number }>;
    adminOnly?: boolean;
}

export interface SettingsSectionProps {
    title: string;
    description?: string;
    children: ReactNode;
}

// ============================================
// Animation Configs
// ============================================

export interface SpringConfig {
    type: 'spring';
    stiffness: number;
    damping: number;
    mass?: number;
}

export interface TransitionConfig {
    duration?: number;
    ease?: string | number[];
}
