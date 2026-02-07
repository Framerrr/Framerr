/**
 * Integration Icon Mapping
 * 
 * Maps icon string names from backend to renderable components.
 * Supports both Lucide icon names (e.g., 'Gauge') and prefixed
 * system/cdn/custom icons (e.g., 'system:plex').
 * 
 * Uses getIconComponent() from iconUtils for unified handling.
 */

import {
    HelpCircle
} from 'lucide-react';
import { getIconComponent } from '../../utils/iconUtils';

type IconComponent = React.FC<{ size?: number; className?: string }>;

/**
 * Get a renderable icon component by name.
 * Handles both Lucide names and prefixed icon values (system:, cdn:, custom:).
 * Returns HelpCircle as fallback for unknown icons.
 */
export function getIntegrationIcon(iconName: string | undefined): IconComponent {
    if (!iconName) return HelpCircle;
    return getIconComponent(iconName);
}

/**
 * Get a LucideIcon component by name (legacy — for components that need LucideIcon type).
 */
export { getLucideIcon as getIntegrationLucideIcon } from '../../utils/iconUtils';

/**
 * Check if an icon name is valid.
 */
export function isValidIconName(iconName: string): boolean {
    // Any prefixed value is valid
    if (iconName.includes(':')) return true;
    // Check Lucide icon names
    const component = getIconComponent(iconName);
    return component !== HelpCircle;
}
