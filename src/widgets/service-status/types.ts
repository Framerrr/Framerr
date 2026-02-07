/**
 * Service Status Widget Types
 * 
 * Type definitions for the service monitoring widget.
 */

import { MonitorStatus } from '../../components/common/StatusDot';
import type { WidgetProps } from '../types';

// ============================================================================
// Widget Props
// ============================================================================

export interface ServiceStatusWidgetProps extends WidgetProps {
    /** Pre-calculated container height (for scaled preview contexts) */
    containerHeight?: number;
    /** Pre-calculated container width (for scaled preview contexts) */
    containerWidth?: number;
}

// ============================================================================
// Monitor Types (shared with popover)
// ============================================================================

export interface ServiceMonitor {
    id: string;
    name: string;
    iconId: string | null;
    iconName: string | null;
    type: 'http' | 'tcp' | 'ping';
    url: string | null;
    intervalSeconds: number;
    enabled: boolean;
    maintenance: boolean;
    orderIndex: number;
}

export interface MonitorStatusData {
    monitorId: string;
    status: MonitorStatus;
    responseTimeMs: number | null;
    lastCheck: string | null;
    uptimePercent: number | null;
    maintenance: boolean;
    /** Monitor's configured check interval (for client-side timer calculation) */
    intervalSeconds: number;
}

// ============================================================================
// Layout Types
// ============================================================================

export interface LayoutConfig {
    minSize: number;
    maxSize: number;
    gap: number;
}

export interface LayoutResult {
    cardSize: number;
    cardsPerRow: number;
    rowCount: number;
    visibleCount: number;
    variant: 'compact' | 'ultra-compact' | 'expanded';
}

// ============================================================================
// History Types (for popover)
// ============================================================================

export interface HourlyAggregate {
    hourStart: string;
    checksTotal: number;
    checksUp: number;
    checksDegraded: number;
    checksDown: number;
    checksMaintenance: number;
    avgResponseMs: number | null;
}
