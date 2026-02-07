/**
 * StackedIcons - Display 1-3 stacked icons for batched notifications
 * 
 * Layout for multiple icons:
 * ┌────────────┐
 * │ [1]        │  Icon 1: top-left, z-index: 3
 * │     [2]    │  Icon 2: center-right, z-index: 2  
 * │ [3]        │  Icon 3: bottom-left, z-index: 1
 * └────────────┘
 */

import React from 'react';
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { getIconComponent, getIconUrl } from '../../utils/iconUtils';

interface StackedIconsProps {
    iconIds: string[];
    lucideIcons?: string[];  // Lucide icon names for each position
    status: 'success' | 'error' | 'warning' | 'info';
    size?: number;  // Container size in pixels
}

const StackedIcons: React.FC<StackedIconsProps> = ({ iconIds, lucideIcons = [], status, size = 40 }) => {
    // Combine iconIds and lucideIcons - lucideIcons take precedence where available
    const displayCount = Math.max(iconIds.length, lucideIcons.length);
    const displayIndexes = Array.from({ length: Math.min(displayCount, 3) }, (_, i) => i);
    const iconSize = size * 0.5;  // Each icon is ~50% of container

    // Status-based border colors
    const borderColor = status === 'error' ? 'var(--error)'
        : status === 'success' ? 'var(--success)'
            : status === 'warning' ? 'var(--warning)'
                : 'var(--accent)';

    // Position styles for each icon slot
    const positions = [
        { top: 0, left: 0, zIndex: 3 },           // Top-left
        { top: '30%', right: 0, zIndex: 2 },     // Center-right
        { bottom: 0, left: 0, zIndex: 1 },        // Bottom-left
    ];

    // Fallback icon based on status
    const getFallbackIcon = () => {
        const fallbackSize = iconSize * 0.6;
        if (status === 'error') return <AlertCircle size={fallbackSize} color={borderColor} />;
        if (status === 'success') return <CheckCircle size={fallbackSize} color={borderColor} />;
        return <AlertTriangle size={fallbackSize} color={borderColor} />;
    };

    return (
        <div
            style={{
                position: 'relative',
                width: size,
                height: size,
                flexShrink: 0,
            }}
        >
            {displayIndexes.map((index) => {
                const lucideIcon = lucideIcons[index];
                const iconId = iconIds[index];

                return (
                    <div
                        key={`${lucideIcon || iconId || index}`}
                        style={{
                            position: 'absolute',
                            width: iconSize,
                            height: iconSize,
                            borderRadius: '6px',
                            background: 'var(--bg-secondary)',
                            border: `2px solid ${borderColor}`,
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            ...positions[index],
                        }}
                    >
                        {lucideIcon ? (
                            // Render Lucide icon
                            (() => {
                                const LucideIconComponent = getIconComponent(lucideIcon);
                                return <LucideIconComponent size={iconSize * 0.6} className="opacity-80" />;
                            })()
                        ) : iconId ? (
                            // Render custom icon
                            <img
                                src={getIconUrl(iconId) || `/api/custom-icons/${iconId}/file`}
                                alt=""
                                style={{
                                    width: '80%',
                                    height: '80%',
                                    objectFit: 'contain',
                                }}
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        ) : (
                            // Fallback icon
                            getFallbackIcon()
                        )}
                    </div>
                );
            })}

            {/* If no icons at all, show a single status icon */}
            {displayIndexes.length === 0 && (
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: iconSize,
                        height: iconSize,
                        borderRadius: '6px',
                        background: 'var(--bg-secondary)',
                        border: `2px solid ${borderColor}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {getFallbackIcon()}
                </div>
            )}
        </div>
    );
};

export default StackedIcons;
