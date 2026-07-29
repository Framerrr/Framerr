/**
 * LinkItem Component
 * 
 * Renders a single link in the grid.
 * Handles both regular links (open URL) and action buttons (HTTP requests).
 */

import React, { CSSProperties } from 'react';
import { Loader, CheckCircle2, XCircle } from 'lucide-react';
import { getIconComponent } from '../../../utils/iconUtils';
import { triggerHaptic } from '../../../utils/haptics';
import { consumeGridDragSuppression } from '../../../utils/gridDragClickSuppression';
import { useLinkAction } from '../hooks/useLinkAction';
import { useDashboardEdit } from '../../../context/useDashboardEdit';
import { useActiveDashboard } from '../../../context/ActiveDashboardContext';
import { guardedNavigate } from '../../../settings/navigation/settingsConfig';
import { resolveLinkNavigation } from '../utils/linkNavigation';
import type { Link, LinkPosition } from '../types';

interface LinkItemProps {
    link: Link;
    position: LinkPosition;
    cellSize: number;
    gridGap: number;
    editMode: boolean;
    editingLinkId: string | null;
    onLinkClick: (linkId: string) => void;
}

export const LinkItem: React.FC<LinkItemProps> = ({
    link,
    position,
    cellSize,
    gridGap,
    editMode,
    onLinkClick
}) => {
    const dashboardEdit = useDashboardEdit();
    const { switchDashboard } = useActiveDashboard();
    const { state: linkState, execute: executeAction } = useLinkAction(link);

    const Icon = getIconComponent(link.icon);
    const isLoading = linkState === 'loading';
    const isSuccess = linkState === 'success';
    const isError = linkState === 'error';
    const isCircle = link.size === 'circle';

    const width = cellSize * position.gridColSpan;
    const height = cellSize;

    // Base classes
    const baseClasses = 'flex items-center justify-center border bg-theme-tertiary border-theme transition-all duration-200 relative overflow-hidden';

    // Shape classes
    const shapeClasses = isCircle
        ? 'rounded-full flex-col'
        : 'rounded-full flex-row gap-2';

    // State classes
    const stateClasses = isSuccess
        ? 'border-success/70 bg-success/20'
        : isError
            ? 'border-error/70 bg-error/20'
            : '';

    const classes = `${baseClasses} ${shapeClasses} ${stateClasses}`;

    // Icon rendering - scale with cell size
    // Icon-only circles get largest icons, rectangles get a nice bump, icon+text circles get minimal bump
    const isIconOnly = link.style?.showIcon !== false && link.style?.showText === false;
    const iconScale = isCircle
        ? (isIconOnly ? 0.5 : 0.45)   // Circle: icon-only = largest, icon+text = icon dominates
        : 0.42;                         // Rectangle: slightly larger
    const iconMax = isCircle
        ? (isIconOnly ? 40 : 36)
        : 36;
    const iconSize = Math.max(16, Math.min(iconMax, cellSize * iconScale));

    const renderIcon = (): React.ReactNode => {
        if (isLoading) return <Loader size={iconSize} className="text-accent animate-spin" />;
        if (isSuccess) return <CheckCircle2 size={iconSize} className="text-success" />;
        if (isError) return <XCircle size={iconSize} className="text-error" />;
        if (link.style?.showIcon !== false) {
            return <Icon size={iconSize} className="text-accent" />;
        }
        return null;
    };

    // Text rendering - scale with cell size (circles always use smaller text to give icon more weight)
    const fontSize = isCircle ? 'text-xs' : (cellSize < 60 ? 'text-xs' : 'text-sm');

    const renderText = (): React.ReactNode => {
        if (isSuccess && !isCircle) return <span className={`${fontSize} font-medium text-success`}>Success</span>;
        if (isError && !isCircle) return <span className={`${fontSize} font-medium text-error`}>Failed</span>;
        if (link.style?.showText !== false) {
            return (
                <span className={`${fontSize} font-medium text-theme-primary ${isCircle ? 'mt-1 text-center' : ''}`}>
                    {link.title}
                </span>
            );
        }
        return null;
    };

    // Absolute positioning within grid using transform (GPU-accelerated)
    const translateX = position.gridCol * (cellSize + gridGap);
    const translateY = position.gridRow * (cellSize + gridGap);

    const style: CSSProperties = {
        position: 'absolute',
        left: 0,
        top: 0,
        transform: `translate(${translateX}px, ${translateY}px)`,
        width: `${width}px`,
        height: `${height}px`,
    };

    // Click handler
    const handleLinkClick = (e: React.MouseEvent): void => {
        if (consumeGridDragSuppression(e.currentTarget as Element)) {
            e.preventDefault();
            e.stopPropagation();
            return; // FRAMERR: swallow the native click that follows a real
                    // mouse drag-drop on this widget — see
                    // src/utils/gridDragClickSuppression.ts and
                    // TASK-20260727-004_PLAN.md §5.
        }
        if (editMode) {
            e.preventDefault();
            e.stopPropagation();
            onLinkClick(link.id);
        } else {
            triggerHaptic('light');
        }
    };

    // Shared props for both link and action tile.
    // Neither tile type carries `.no-drag` — touch/mouse hold-vs-tap arbitration
    // is owned by GridStack's dd-touch.ts / dd-draggable.ts once that class is
    // absent. The action tile must not be a native form-control tag (skipMouseDown,
    // dd-draggable.ts:45) or the touch-stall risk in TASK-20260727-004_PLAN.md §3
    // returns. See that plan before re-introducing `.no-drag` or a native button.
    const sharedProps = {
        'data-link-id': link.id,
        className: `${classes} cursor-pointer edit-clickable`,
        style,
    };

    // Regular link (external URL, in-app hash, or Framerr dashboard)
    if (link.type === 'link' || !link.type) {
        const nav = resolveLinkNavigation(link);
        const isInApp = nav.kind === 'dashboard' || nav.kind === 'hash';
        const openInNewTab = !editMode && nav.kind === 'external' && nav.openInNewTab;

        return (
            <a
                {...sharedProps}
                href={editMode || isInApp ? undefined : nav.url}
                target={openInNewTab ? '_blank' : undefined}
                rel={openInNewTab ? 'noopener noreferrer' : undefined}
                tabIndex={editMode ? 0 : undefined}
                onClick={(e) => {
                    if (editMode) {
                        handleLinkClick(e);
                        return;
                    }
                    if (nav.kind === 'dashboard' && nav.dashboardId) {
                        e.preventDefault();
                        triggerHaptic('light');
                        switchDashboard(nav.dashboardId);
                        return;
                    }
                    if (nav.kind === 'hash' && nav.hash) {
                        e.preventDefault();
                        triggerHaptic('light');
                        const destination = `#${nav.hash}`;
                        const result = guardedNavigate(destination, dashboardEdit);
                        if (result === 'proceed') {
                            window.location.hash = nav.hash;
                        }
                        return;
                    }
                    if (!nav.openInNewTab) {
                        // Current-tab external: let the browser follow href (no target=_blank)
                        triggerHaptic('light');
                        return;
                    }
                    handleLinkClick(e);
                }}
                onKeyDown={(e) => {
                    // Edit-mode keyboard opens the editor; view-mode keyboard is unchanged.
                    if (!editMode) return;
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    e.preventDefault();
                    onLinkClick(link.id);
                }}
            >
                {renderIcon()}
                {renderText()}
            </a>
        );
    }

    // HTTP action tile (div role="button" — not a native button so GridStack drag works)
    return (
        <div
            {...sharedProps}
            role="button"
            tabIndex={isLoading ? -1 : 0}
            aria-disabled={isLoading || undefined}
            className={`${sharedProps.className} ${isLoading ? 'cursor-wait' : ''}`}
            onClick={(e) => {
                if (isLoading) return;
                if (editMode) {
                    handleLinkClick(e);
                    return;
                }
                triggerHaptic('light');
                executeAction();
            }}
            onKeyDown={(e) => {
                if (isLoading) return;
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                if (editMode) {
                    onLinkClick(link.id);
                    return;
                }
                triggerHaptic('light');
                executeAction();
            }}
        >
            {renderIcon()}
            {renderText()}
        </div>
    );
};

export default LinkItem;
