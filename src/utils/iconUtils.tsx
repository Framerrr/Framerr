import React from 'react';
import * as Icons from 'lucide-react';
import { LucideIcon } from 'lucide-react';

/**
 * Centralized Icon Utilities
 * 
 * Supports four icon types:
 * - Lucide icons: name string like 'Server', 'Globe'
 * - System icons: 'system:<name>' - bundled service icons served from local API
 * - CDN icons: 'cdn:<name>' - community icons loaded from jsDelivr CDN  
 * - Custom icons: 'custom:<uuid>' - user-uploaded icons
 * - Base64 icons: 'data:image/...' - legacy inline images
 */

/**
 * Popular icons for quick selection - 126 validated Lucide icons
 * Organized by category for easy browsing in icon pickers.
 * 
 * This is the SINGLE SOURCE OF TRUTH for the icon list.
 * Import this constant anywhere icons need to be displayed for selection.
 */
export const POPULAR_ICONS: string[] = [
    // Core & System
    'Server', 'Monitor', 'Settings', 'Home', 'Database', 'HardDrive',
    // Media & Entertainment
    'Film', 'Tv', 'Video', 'Music', 'Camera', 'Image', 'Headphones',
    'Radio', 'Clapperboard', 'Play', 'Pause', 'SkipForward', 'SkipBack',
    'Volume', 'Volume2', 'VolumeX', 'Mic', 'MicOff', 'ImagePlus',
    'Disc', 'Library', 'Podcast', 'Airplay', 'Cast',
    // System & Hardware
    'Cpu', 'MemoryStick', 'Network', 'Printer', 'Smartphone', 'Tablet',
    'Watch', 'Laptop', 'MonitorDot', 'MonitorPlay', 'BatteryCharging',
    'Battery', 'Power', 'Zap', 'Plug',
    // Files & Storage
    'Folder', 'FolderOpen', 'File', 'FileText', 'FilePlus', 'Files',
    'Save', 'Download', 'Upload', 'Cloud', 'CloudUpload', 'CloudDownload',
    // Communication & Social
    'Mail', 'Send', 'MessageCircle', 'MessageSquare', 'Phone', 'PhoneCall',
    'Users', 'User', 'UserPlus', 'UserCheck', 'Share2', 'ThumbsUp',
    'Eye', 'EyeOff', 'Bell', 'BellOff',
    // Navigation & Actions
    'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'ChevronRight',
    'ChevronLeft', 'ChevronUp', 'ChevronDown', 'Menu', 'MoreVertical',
    'MoreHorizontal', 'ExternalLink', 'Link', 'Unlink', 'Navigation',
    'Navigation2', 'Compass',
    // Status & Alerts
    'CheckCircle', 'CheckCircle2', 'XCircle', 'AlertCircle', 'AlertTriangle',
    'Info', 'HelpCircle', 'AlertOctagon', 'ShieldAlert', 'ShieldCheck',
    // Productivity & Tools
    'Calendar', 'Clock', 'Timer', 'CalendarDays', 'CalendarCheck',
    'Clipboard', 'ClipboardCheck', 'Search', 'Filter', 'SortAsc',
    'SortDesc', 'Wrench', 'Sliders', 'Gauge', 'RefreshCw',
    // Data & Charts
    'BarChart', 'BarChart2', 'PieChart', 'TrendingUp', 'TrendingDown',
    'Activity', 'Target', 'Award', 'Layers', 'Grid',
    // Security
    'Shield', 'Lock', 'Unlock', 'Key', 'ShieldOff',
    // Weather & Nature
    'Sun', 'Moon', 'CloudRain', 'CloudSnow', 'Wind', 'Thermometer',
    'Sunrise', 'Sunset',
    // Actions & Editing
    'Edit', 'Edit2', 'Plus', 'Minus', 'X', 'Trash2', 'Copy',
    'Scissors', 'RotateCw', 'RotateCcw', 'Maximize', 'Minimize',
    'Maximize2', 'Minimize2',
    // Favorites & Bookmarks
    'Heart', 'Star', 'Bookmark', 'Flag', 'Gift', 'Package',
    // Location & Maps  
    'Globe', 'Map', 'MapPin', 'MapPinned',
    // Code & Development
    'Code', 'Code2', 'Terminal', 'Box', 'Layout', 'LayoutGrid'
];

// Default fallback icon
const DefaultIcon = Icons.Server;

// CDN base URL for dashboard-icons
const CDN_BASE_URL = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png';

/**
 * Check if an icon value is a system bundled icon
 */
export function isSystemIcon(iconValue: string | null | undefined): boolean {
    return !!iconValue && iconValue.startsWith('system:');
}

/**
 * Check if an icon value is a CDN community icon
 */
export function isCdnIcon(iconValue: string | null | undefined): boolean {
    return !!iconValue && iconValue.startsWith('cdn:');
}

/**
 * Get the URL for any image-type icon (system, cdn, or custom)
 */
export function getIconUrl(iconValue: string): string | null {
    if (iconValue.startsWith('system:')) {
        const name = iconValue.replace('system:', '');
        return `/api/icons/system/${name}/file`;
    }
    if (iconValue.startsWith('cdn:')) {
        const name = iconValue.replace('cdn:', '');
        return `${CDN_BASE_URL}/${name}.png`;
    }
    if (iconValue.startsWith('custom:')) {
        const id = iconValue.replace('custom:', '');
        return `/api/custom-icons/${id}/file`;
    }
    return null;
}

/**
 * Render an icon value (Lucide name, custom:id, or data:base64) as JSX
 * 
 * Returns a stable React element, NOT a component function.
 * This prevents flashing caused by React remounting components.
 * 
 * @param iconValue - Icon identifier: Lucide name, 'custom:uuid', or 'data:image/...'
 * @param size - Icon size in pixels (default: 20)
 * @param className - Additional CSS classes
 */
export function renderIcon(
    iconValue: string | null | undefined,
    size: number = 20,
    className?: string
): React.ReactNode {
    if (!iconValue) {
        return <DefaultIcon size={size} className={className} />;
    }

    // Handle system bundled icons (system: prefix)
    if (iconValue.startsWith('system:')) {
        const name = iconValue.replace('system:', '');
        return (
            <img
                src={`/api/icons/system/${name}/file`}
                alt={name}
                className={className || 'object-cover rounded'}
                style={{ width: size, height: size }}
            />
        );
    }

    // Handle CDN community icons (cdn: prefix)
    if (iconValue.startsWith('cdn:')) {
        const name = iconValue.replace('cdn:', '');
        return (
            <img
                src={`${CDN_BASE_URL}/${name}.png`}
                alt={name}
                className={className || 'object-cover rounded'}
                style={{ width: size, height: size }}
            />
        );
    }

    // Handle custom uploaded icons (custom: prefix)
    if (iconValue.startsWith('custom:')) {
        const iconId = iconValue.replace('custom:', '');
        return (
            <img
                src={`/api/custom-icons/${iconId}/file`}
                alt="custom icon"
                className={className || 'object-cover rounded'}
                style={{ width: size, height: size }}
            />
        );
    }

    // Handle legacy base64 images (data: prefix)
    if (iconValue.startsWith('data:')) {
        return (
            <img
                src={iconValue}
                alt="icon"
                className={className || 'object-cover rounded'}
                style={{ width: size, height: size }}
            />
        );
    }

    // Handle Lucide icons by name
    const IconsMap = Icons as unknown as Record<string, LucideIcon>;
    const IconComponent = IconsMap[iconValue] || DefaultIcon;
    return <IconComponent size={size} className={className} />;
}

/**
 * Get a Lucide icon component by name
 * 
 * For cases where you need the component itself (not rendered JSX).
 * Only works for Lucide icons, not custom icons.
 * 
 * @param iconName - Lucide icon name (e.g., 'Server', 'Globe')
 */
export function getLucideIcon(iconName: string | null | undefined): LucideIcon {
    if (!iconName) return DefaultIcon;
    const IconsMap = Icons as unknown as Record<string, LucideIcon>;
    return IconsMap[iconName] || DefaultIcon;
}

/**
 * Check if an icon value is a custom uploaded icon
 */
export function isCustomIcon(iconValue: string | null | undefined): boolean {
    return !!iconValue && iconValue.startsWith('custom:');
}

/**
 * Check if an icon value is a base64 image
 */
export function isBase64Icon(iconValue: string | null | undefined): boolean {
    return !!iconValue && iconValue.startsWith('data:');
}

/**
 * Extract custom icon ID from icon value
 */
export function getCustomIconId(iconValue: string): string | null {
    if (iconValue.startsWith('custom:')) {
        return iconValue.replace('custom:', '');
    }
    return null;
}

// Cache for custom icon components to prevent recreating on every call
const customIconComponentCache = new Map<string, React.FC<{ size?: number; className?: string }>>();
const base64IconComponentCache = new Map<string, React.FC<{ size?: number; className?: string }>>();

/**
 * Get icon component for rendering with dynamic props
 * 
 * For ServiceStatusWidget and similar components that need to render
 * the icon with varying props. Returns a stable component reference.
 * 
 * Custom icon components are cached by ID to prevent React from
 * remounting them on every render (which causes flashing).
 */
export function getIconComponent(
    iconValue: string | null | undefined
): React.FC<{ size?: number; className?: string }> {
    if (!iconValue) {
        return DefaultIcon;
    }

    // Handle system bundled icons - use cache for stability
    if (iconValue.startsWith('system:')) {
        const name = iconValue.replace('system:', '');
        const cacheKey = `system:${name}`;

        if (customIconComponentCache.has(cacheKey)) {
            return customIconComponentCache.get(cacheKey)!;
        }

        const SystemIcon: React.FC<{ size?: number; className?: string }> = ({ size = 20, className }) => (
            <img
                src={`/api/icons/system/${name}/file`}
                alt={name}
                className={className || 'object-cover rounded'}
                style={{ width: size, height: size, objectFit: 'contain' }}
            />
        );
        customIconComponentCache.set(cacheKey, SystemIcon);
        return SystemIcon;
    }

    // Handle CDN community icons - use cache for stability
    if (iconValue.startsWith('cdn:')) {
        const name = iconValue.replace('cdn:', '');
        const cacheKey = `cdn:${name}`;

        if (customIconComponentCache.has(cacheKey)) {
            return customIconComponentCache.get(cacheKey)!;
        }

        const CdnIcon: React.FC<{ size?: number; className?: string }> = ({ size = 20, className }) => (
            <img
                src={`${CDN_BASE_URL}/${name}.png`}
                alt={name}
                className={className || 'object-cover rounded'}
                style={{ width: size, height: size, objectFit: 'contain' }}
            />
        );
        customIconComponentCache.set(cacheKey, CdnIcon);
        return CdnIcon;
    }

    // Handle custom uploaded icons - use cache for stability
    if (iconValue.startsWith('custom:')) {
        const iconId = iconValue.replace('custom:', '');

        if (customIconComponentCache.has(iconId)) {
            return customIconComponentCache.get(iconId)!;
        }

        const CustomIcon: React.FC<{ size?: number; className?: string }> = ({ size = 20, className }) => (
            <img
                src={`/api/custom-icons/${iconId}/file`}
                alt="custom icon"
                className={className || 'object-cover rounded'}
                style={{ width: size, height: size, objectFit: 'contain' }}
            />
        );
        customIconComponentCache.set(iconId, CustomIcon);
        return CustomIcon;
    }

    // Handle legacy base64 images - use cache for stability
    if (iconValue.startsWith('data:')) {
        const cacheKey = iconValue.substring(0, 100);

        if (base64IconComponentCache.has(cacheKey)) {
            return base64IconComponentCache.get(cacheKey)!;
        }

        const Base64Icon: React.FC<{ size?: number; className?: string }> = ({ size = 20, className }) => (
            <img
                src={iconValue}
                alt="icon"
                className={className || 'object-cover rounded'}
                style={{ width: size, height: size, objectFit: 'contain' }}
            />
        );
        base64IconComponentCache.set(cacheKey, Base64Icon);
        return Base64Icon;
    }

    // Handle Lucide icons
    const IconsMap = Icons as unknown as Record<string, LucideIcon>;
    return IconsMap[iconValue] || DefaultIcon;
}

