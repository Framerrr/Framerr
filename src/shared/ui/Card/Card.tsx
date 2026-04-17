import React from 'react';

type CardPadding = 'none' | 'sm' | 'md' | 'lg' | 'xl';

export interface CardProps {
    children?: React.ReactNode;
    className?: string;
    hover?: boolean;
    padding?: CardPadding;
}

export interface CardHeaderProps {
    title: React.ReactNode;
    description?: React.ReactNode;
    action?: React.ReactNode;
    divider?: boolean;
}

/**
 * Card Component - Simple modern container
 */
export const Card = ({
    children,
    className = '',
    hover = false,
    padding = 'lg'
}: CardProps): React.JSX.Element => {
    const paddingClasses: Record<CardPadding, string> = {
        none: '',
        sm: 'p-4',
        md: 'p-5',
        lg: 'p-6',
        xl: 'p-8'
    };

    const paddingClass = paddingClasses[padding];

    const baseClasses = `${paddingClass} glass-card rounded-2xl transition-all duration-200 relative`;
    const hoverClasses = hover ? 'hover:shadow-xl hover:shadow-accent/20 hover:-translate-y-1 hover:border-accent/50 cursor-pointer' : '';
    const allClasses = `${baseClasses} ${hoverClasses} ${className}`.trim();

    return (
        <div className={allClasses}>
            {children}
        </div>
    );
};

/**
 * CardHeader Component - Header section for cards
 */
export const CardHeader = ({
    title,
    description,
    action,
    divider = true
}: CardHeaderProps): React.JSX.Element => {
    return (
        <div className={`mb-6 ${divider ? 'pb-4 border-b border-theme' : ''}`}>
            <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                    <h3 className={`text-xl font-semibold text-theme-primary ${description ? 'mb-1' : ''}`}>
                        {title}
                    </h3>
                    {description && (
                        <p className="text-sm text-theme-secondary">
                            {description}
                        </p>
                    )}
                </div>
                {action && <div className="flex-shrink-0">{action}</div>}
            </div>
        </div>
    );
};

export default Card;
