/**
 * LinkItem Component
 * 
 * Renders a single link in the grid.
 * Handles both regular links (open URL) and action buttons (HTTP requests).
 */

import React, { CSSProperties, DragEvent, useState, useCallback } from 'react';
import { Loader, CheckCircle2, XCircle } from 'lucide-react';
import { getIconComponent } from '../../../utils/iconUtils';
import { triggerHaptic } from '../../../utils/haptics';
import axios, { AxiosRequestConfig } from 'axios';
import logger from '../../../utils/logger';
import type { Link, LinkPosition, LinkState } from '../types';

interface LinkItemProps {
    link: Link;
    position: LinkPosition;
    cellSize: number;
    gridGap: number;
    editMode: boolean;
    isTouchDevice: boolean;
    dragOverLinkId: string | null;
    touchDragLinkId: string | null;
    editingLinkId: string | null;
    onLinkClick: (linkId: string) => void;
    // Desktop drag handlers
    onDragStart: (e: DragEvent<HTMLAnchorElement | HTMLButtonElement>, linkId: string) => void;
    onDragEnd: (e: DragEvent<HTMLAnchorElement | HTMLButtonElement>) => void;
    onDragOver: (e: DragEvent<HTMLAnchorElement | HTMLButtonElement>, linkId: string) => void;
    onDragLeave: () => void;
    onDrop: (e: DragEvent<HTMLAnchorElement | HTMLButtonElement>, linkId: string) => void;
    // Touch drag handlers
    onTouchStart: (e: React.TouchEvent, linkId: string) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
}

export const LinkItem: React.FC<LinkItemProps> = ({
    link,
    position,
    cellSize,
    gridGap,
    editMode,
    isTouchDevice,
    dragOverLinkId,
    touchDragLinkId,
    editingLinkId,
    onLinkClick,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDragLeave,
    onDrop,
    onTouchStart,
    onTouchMove,
    onTouchEnd
}) => {
    // Local state for HTTP action execution
    const [linkState, setLinkState] = useState<LinkState>('idle');

    const Icon = getIconComponent(link.icon);
    const isLoading = linkState === 'loading';
    const isSuccess = linkState === 'success';
    const isError = linkState === 'error';
    const isCircle = link.size === 'circle';

    const width = cellSize * position.gridColSpan;
    const height = cellSize;

    /**
     * Execute HTTP action for action-type links
     */
    const executeAction = useCallback(async (): Promise<void> => {
        if (!link.action) {
            logger.error('No action configured for link', link);
            return;
        }

        const { method = 'GET', url, headers = {}, body = null } = link.action;

        setLinkState('loading');

        try {
            logger.debug(`Executing ${method} action:`, url);

            const requestConfig: AxiosRequestConfig = {
                method: method.toLowerCase(),
                url,
                headers,
            };

            if (body && ['post', 'put', 'patch'].includes(method.toLowerCase())) {
                requestConfig.data = body;
            }

            const response = await axios(requestConfig);

            logger.debug(`Action successful:`, response.status);

            setLinkState('success');
            setTimeout(() => setLinkState('idle'), 2000);
        } catch (error) {
            logger.error(`Action failed:`, error);
            setLinkState('error');
            setTimeout(() => setLinkState('idle'), 2000);
        }
    }, [link]);

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
    const iconSize = Math.max(16, Math.min(32, cellSize * 0.3));

    const renderIcon = (): React.ReactNode => {
        if (isLoading) return <Loader size={iconSize} className="text-accent animate-spin" />;
        if (isSuccess) return <CheckCircle2 size={iconSize} className="text-success" />;
        if (isError) return <XCircle size={iconSize} className="text-error" />;
        if (link.style?.showIcon !== false) {
            return <Icon size={iconSize} className="text-accent" />;
        }
        return null;
    };

    // Text rendering - scale with cell size
    const fontSize = cellSize < 60 ? 'text-xs' : cellSize < 80 ? 'text-sm' : 'text-sm';

    const renderText = (): React.ReactNode => {
        if (isSuccess && !isCircle) return <span className={`${fontSize} font-medium text-success`}>Success</span>;
        if (isError && !isCircle) return <span className={`${fontSize} font-medium text-error`}>Failed</span>;
        if (link.style?.showText !== false) {
            return (
                <span className={`${fontSize} font-medium text-theme-primary ${isCircle ? 'mt-1' : ''}`}>
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
        // Smooth transition for reordering during drag
        ...(touchDragLinkId && {
            transition: 'transform 200ms ease-out, opacity 100ms ease-out',
            willChange: 'transform',
        }),
    };

    // Click handler
    const handleLinkClick = (e: React.MouseEvent): void => {
        if (editMode) {
            e.preventDefault();
            e.stopPropagation();
            onLinkClick(link.id);
        } else {
            triggerHaptic('light');
        }
    };

    // Visual feedback for drag state
    const isDragOver = dragOverLinkId === link.id;
    const isTouchDragging = touchDragLinkId === link.id;
    const dragClasses = (isDragOver && !touchDragLinkId) ? ' ring-2 ring-accent ring-offset-2 ring-offset-theme-secondary' : '';
    const dragOpacity = isTouchDragging ? 0 : 1;

    // Shared props for both link and button
    // Note: edit-clickable class makes links clickable in edit mode despite global pointer-events: none
    const sharedProps = {
        'data-link-id': link.id,
        className: `${classes} ${editMode ? 'cursor-pointer' : ''} edit-clickable${dragClasses} no-drag`,
        style: { ...style, opacity: dragOpacity },
        draggable: editMode && !editingLinkId && !isTouchDevice,
        onDragStart: (e: DragEvent<HTMLAnchorElement | HTMLButtonElement>) => editMode && onDragStart(e, link.id),
        onDragEnd,
        onDragEnter: (e: React.DragEvent) => e.preventDefault(),
        onDragOver: (e: DragEvent<HTMLAnchorElement | HTMLButtonElement>) => onDragOver(e, link.id),
        onDragLeave,
        onDrop: (e: DragEvent<HTMLAnchorElement | HTMLButtonElement>) => onDrop(e, link.id),
        onTouchStart: (e: React.TouchEvent) => onTouchStart(e, link.id),
        onTouchMove,
        onTouchEnd,
        onTouchCancel: onTouchEnd,
    };

    // Regular link (opens URL)
    if (link.type === 'link' || !link.type) {
        return (
            <a
                {...sharedProps}
                href={editMode ? undefined : link.url}
                target={editMode ? undefined : "_blank"}
                rel={editMode ? undefined : "noopener noreferrer"}
                onClick={handleLinkClick}
            >
                {renderIcon()}
                {renderText()}
            </a>
        );
    }

    // HTTP action button
    return (
        <button
            {...sharedProps}
            onClick={(e) => {
                if (editMode) {
                    handleLinkClick(e);
                    return;
                }
                triggerHaptic('light');
                executeAction();
            }}
            disabled={isLoading}
            className={`${sharedProps.className} ${isLoading ? 'cursor-wait' : ''}`}
        >
            {renderIcon()}
            {renderText()}
        </button>
    );
};

export default LinkItem;
