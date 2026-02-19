import React, { useState, useCallback } from 'react';
import { LucideIcon, Eye, EyeOff } from 'lucide-react';
import { formSizeClasses, type FormSize } from '../../shared/ui/formSizeClasses';

/** Must match the backend REDACTED_SENTINEL in redact.ts */
const REDACTED_SENTINEL = '••••••••';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
    label?: string;
    error?: string;
    helperText?: string;
    icon?: LucideIcon;
    /** Size preset — matches Button and Select sizing */
    size?: FormSize;
    /**
     * When true, enables sentinel-aware clear-on-focus behavior:
     * - Focus: clears field if value matches redacted sentinel
     * - Blur: restores sentinel if field is empty
     * Used for integration config fields (API keys, tokens, passwords).
     */
    redacted?: boolean;
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
    helperText?: string;
    rows?: number;
}

/**
 * Input Component - Consistent form input styling
 */
export const Input = ({
    label,
    error,
    helperText,
    icon: Icon,
    size = 'lg',
    className = '',
    type,
    redacted,
    value,
    onFocus,
    onBlur,
    ...props
}: InputProps): React.JSX.Element => {
    const sizeStyles = formSizeClasses[size];
    const isPassword = type === 'password' && !redacted;
    const [showPassword, setShowPassword] = useState(false);
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

    // Clear-on-focus: clear sentinel when user clicks into a redacted field
    const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
        if (redacted && e.target.value === REDACTED_SENTINEL) {
            // Dispatch a synthetic change event to clear the field
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype, 'value'
            )?.set;
            nativeInputValueSetter?.call(e.target, '');
            e.target.dispatchEvent(new Event('input', { bubbles: true }));
        }
        onFocus?.(e);
    }, [redacted, onFocus]);

    // Restore-on-blur: if user leaves field empty, restore sentinel
    const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
        if (redacted && e.target.value === '') {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype, 'value'
            )?.set;
            nativeInputValueSetter?.call(e.target, REDACTED_SENTINEL);
            e.target.dispatchEvent(new Event('input', { bubbles: true }));
        }
        onBlur?.(e);
    }, [redacted, onBlur]);

    return (
        <div className={`mb-4 ${className}`}>
            {label && (
                <label className="block mb-2 font-medium text-theme-primary text-sm">
                    {label}
                </label>
            )}
            <div className="relative">
                {Icon && (
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-theme-tertiary">
                        <Icon size={sizeStyles.iconSize} />
                    </div>
                )}
                <input
                    {...props}
                    type={inputType}
                    value={value}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    className={`w-full rounded-lg transition-all focus:outline-none focus:ring-2 bg-theme-tertiary text-theme-primary ${sizeStyles.text} placeholder-theme-tertiary
            ${error
                            ? 'border-error focus:border-error focus:ring-error/20'
                            : 'border-theme focus:border-accent focus:ring-accent/20'
                        }
            ${Icon ? `pl-10 ${isPassword ? 'pr-10' : 'pr-4'} ${sizeStyles.padding.split(' ').pop()}` : isPassword ? `${sizeStyles.padding} pr-10` : sizeStyles.padding}
            border
          `}
                />
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(prev => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-secondary opacity-50 hover:opacity-100 transition-all"
                        tabIndex={-1}
                    >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                )}
            </div>
            {error && (
                <p className="mt-1 text-error text-sm">
                    {error}
                </p>
            )}
            {helperText && !error && (
                <p className="mt-1 text-theme-tertiary text-sm">
                    {helperText}
                </p>
            )}
        </div>
    );
};

/**
 * Textarea Component - Multi-line input
 */
export const Textarea = ({
    label,
    error,
    helperText,
    className = '',
    rows = 4,
    ...props
}: TextareaProps): React.JSX.Element => {
    return (
        <div className={`mb-4 ${className}`}>
            {label && (
                <label className="block mb-2 font-medium text-theme-primary text-sm">
                    {label}
                </label>
            )}
            <textarea
                {...props}
                rows={rows}
                className={`w-full rounded-lg transition-all focus:outline-none focus:ring-2 bg-theme-tertiary text-theme-primary text-base placeholder-theme-tertiary resize-y px-4 py-3
          ${error
                        ? 'border-error focus:border-error focus:ring-error/20'
                        : 'border-theme focus:border-accent focus:ring-accent/20'
                    }
          border
        `}
            />
            {error && (
                <p className="mt-1 text-error text-sm">
                    {error}
                </p>
            )}
            {helperText && !error && (
                <p className="mt-1 text-theme-tertiary text-sm">
                    {helperText}
                </p>
            )}
        </div>
    );
};

export default Input;
