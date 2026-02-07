/**
 * UserAvatar Component
 * 
 * Displays a user's profile picture or their initial as fallback.
 * Standardized across the app (share modal, user settings, etc.)
 */

import React from 'react';

interface UserAvatarProps {
    /** User's display name or username */
    name: string;
    /** URL to profile picture (optional) */
    profilePictureUrl?: string | null;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Additional class names */
    className?: string;
}

const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base'
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
    name,
    profilePictureUrl,
    size = 'md',
    className = ''
}) => {
    const initial = name?.charAt(0).toUpperCase() || '?';
    const sizeClass = sizeClasses[size];

    if (profilePictureUrl) {
        return (
            <img
                src={profilePictureUrl}
                alt={name}
                className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${className}`}
            />
        );
    }

    return (
        <div
            className={`${sizeClass} rounded-full bg-accent flex items-center justify-center font-bold text-white flex-shrink-0 ${className}`}
        >
            {initial}
        </div>
    );
};

export default UserAvatar;
