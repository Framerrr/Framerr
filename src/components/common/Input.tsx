import React from 'react';
import { LucideIcon } from 'lucide-react';
import { formSizeClasses, type FormSize } from '../../shared/ui/formSizeClasses';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
    label?: string;
    error?: string;
    helperText?: string;
    icon?: LucideIcon;
    /** Size preset — matches Button and Select sizing */
    size?: FormSize;
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
    ...props
}: InputProps): React.JSX.Element => {
    const sizeStyles = formSizeClasses[size];
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
                    className={`w-full rounded-lg transition-all focus:outline-none focus:ring-2 bg-theme-tertiary text-theme-primary ${sizeStyles.text} placeholder-theme-tertiary
            ${error
                            ? 'border-error focus:border-error focus:ring-error/20'
                            : 'border-theme focus:border-accent focus:ring-accent/20'
                        }
            ${Icon ? `pl-10 pr-4 ${sizeStyles.padding.split(' ').pop()}` : sizeStyles.padding}
            border
          `}
                />
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
