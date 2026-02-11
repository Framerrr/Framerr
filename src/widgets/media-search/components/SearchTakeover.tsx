/**
 * SearchTakeover
 *
 * Spotlight-style search overlay. When active, the search bar portals out
 * of the widget into a full-page blurred overlay.
 *
 * Desktop: bar centered at ~35% from top, width capped at 700px
 * Mobile:  bar at top of viewport, fills available width
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search } from 'lucide-react';
import { useScrollLock } from '../../../shared/hooks/useScrollLock';
import './SearchTakeover.css';

interface SearchTakeoverProps {
    /** Whether the takeover overlay is active */
    isActive: boolean;
    /** Called to close the takeover */
    onClose: () => void;
    /** Current search query */
    query: string;
    /** Called when query changes */
    onQueryChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    /** Called when clear button is clicked */
    onClear: () => void;
    /** Ref for the input element */
    inputRef: React.RefObject<HTMLInputElement | null>;
    /** Whether the widget is in preview mode */
    previewMode?: boolean;
    /** The dropdown content to render below the search bar */
    children: React.ReactNode;
    /** Shared layoutId for FLIP animation from widget bar to takeover bar */
    layoutId?: string;
}

const BACKDROP_VARIANTS = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
};

const SearchTakeover: React.FC<SearchTakeoverProps> = ({
    isActive,
    onClose,
    query,
    onQueryChange,
    onClear,
    inputRef,
    previewMode = false,
    children,
    layoutId,
}) => {
    const backdropRef = useRef<HTMLDivElement>(null);

    // Lock page scroll when active (iOS-compatible, matches Modal behavior)
    useScrollLock(isActive);

    // Focus the input when takeover becomes active
    useEffect(() => {
        if (isActive && inputRef.current) {
            requestAnimationFrame(() => {
                inputRef.current?.focus();
            });
        }
    }, [isActive, inputRef]);

    // Handle escape key
    useEffect(() => {
        if (!isActive) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isActive, onClose]);

    // Handle backdrop click
    const handleBackdropClick = useCallback(
        (e: React.MouseEvent) => {
            // Only close if clicking the backdrop itself, not the content
            if (e.target === backdropRef.current) {
                onClose();
            }
        },
        [onClose]
    );

    return createPortal(
        <AnimatePresence>
            {isActive && (
                <motion.div
                    ref={backdropRef}
                    className="search-takeover-backdrop"
                    variants={BACKDROP_VARIANTS}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={{ duration: 0.2 }}
                    onClick={handleBackdropClick}
                >
                    <div
                        className="search-takeover-container"
                    >
                        {/* Close button */}
                        <motion.button
                            className="search-takeover-close"
                            onClick={onClose}
                            title="Close search"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ delay: 0.15, duration: 0.15 }}
                        >
                            <X size={16} />
                        </motion.button>

                        {/* Search bar — FLIP animated via layoutId */}
                        <motion.div
                            layoutId={layoutId}
                            className="search-takeover-bar"
                            transition={{ type: 'spring' as const, damping: 28, stiffness: 300 }}
                            style={{ borderRadius: '1rem' }}
                        >
                            <Search size={16} className="search-takeover-search-icon" />
                            <input
                                ref={inputRef}
                                type="text"
                                className="search-takeover-input"
                                placeholder="Search movies, shows, actors..."
                                value={query}
                                onChange={onQueryChange}
                                disabled={previewMode}
                                autoFocus
                            />
                            {query && (
                                <button
                                    className="search-takeover-clear"
                                    onClick={onClear}
                                    title="Clear search"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </motion.div>

                        {/* Dropdown content — fades in after bar lands */}
                        {children && (
                            <motion.div
                                className="search-takeover-dropdown"
                                data-scroll-lock-allow
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 8 }}
                                transition={{ delay: 0.12, duration: 0.2 }}
                            >
                                {children}
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default SearchTakeover;
