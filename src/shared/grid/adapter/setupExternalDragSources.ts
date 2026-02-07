/**
 * setupExternalDragSources - Configure external drag sources for GridStack.
 * 
 * FEATURES:
 * - Morph animation: drag helper starts small (card) and morphs to grid-sized
 * - MutationObserver: watches for placeholder to trigger morph
 * - Auto-detection: watches for new elements matching selector and auto-initializes
 * - Pixel-perfect sizing: uses grid.cellWidth() and getCellHeight() for 1:1 parity
 * - React portal integration: adds data-drag-preview-type for DragPreviewPortal
 * 
 * Based on: prototypes/gridstack/adapter/GridStackRenderer.tsx
 */

import { GridStack } from '../../../vendor/gridstack';
import logger from '../../../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

interface SetupOptions {
    /** Main grid selector to compute cell dimensions (default: '.grid-stack-main') */
    mainGridSelector?: string;
    /** Card size (initial small preview) */
    cardWidth?: number;
    cardHeight?: number;
}

// ============================================================================
// MODULE STATE - Track active watchers to prevent duplicates
// ============================================================================

/** Track which selectors already have active watchers */
const activeWatchers = new Map<string, MutationObserver>();

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Setup external drag sources with EXACT pixel dimensions from GridStack.
 * 
 * KEY FEATURES:
 * - Uses GridStack's cellWidth() and getCellHeight() for 1:1 pixel parity
 * - Helper matches EXACTLY what widget will look like on the grid
 * - No hardcoded values - reads from live grid instance
 * - AUTO-DETECTION: Watches for new elements matching selector (e.g., when modal opens)
 *   and automatically initializes them as drag sources
 * 
 * @param selector - CSS selector for draggable elements (e.g., '.modal-widget, .palette-item')
 * @param options - Configuration options
 */
export function setupExternalDragSources(
    selector: string,
    options: SetupOptions = {}
): void {
    const {
        mainGridSelector = '.grid-stack-main',
        cardWidth = 200,
        cardHeight = 80,
    } = options;

    // Fallback values if grid not found
    const FALLBACK_CELL_WIDTH = 50;
    const FALLBACK_CELL_HEIGHT = 50;

    /**
     * Get the GridStack instance from the grid element.
     */
    const getGridInstance = (): GridStack | null => {
        const mainGridEl = document.querySelector(mainGridSelector) as HTMLElement & { gridstack?: GridStack };
        return mainGridEl?.gridstack || null;
    };

    /**
     * Compute helper pixel dimensions using GridStack's ACTUAL cell dimensions.
     * 
     * NOTE: We do NOT apply CSS scale here. The morph function uses
     * placeholder.getBoundingClientRect() which already returns visual/scaled size.
     */
    const computeHelperSize = (gsW: number, gsH: number) => {
        const grid = getGridInstance();

        if (grid) {
            const cellWidth = grid.cellWidth();
            const cellHeight = grid.getCellHeight();

            return {
                width: Math.round(gsW * cellWidth),
                height: Math.round(gsH * cellHeight),
            };
        }

        // Fallback if grid not available
        logger.warn('[SetupDragIn] Grid not found, using fallback dimensions');
        return {
            width: gsW * FALLBACK_CELL_WIDTH,
            height: gsH * FALLBACK_CELL_HEIGHT,
        };
    };

    // Morph animation state
    let currentHelper: HTMLElement | null = null;
    let observer: MutationObserver | null = null;
    let isMorphed = false;

    GridStack.setupDragIn(selector, {
        appendTo: 'body',
        helper: (event: Event) => {
            const target = event.target as HTMLElement;
            // Look for palette-item or grid-stack-item
            const item = target.closest('.palette-item, .modal-widget, .grid-stack-item') as HTMLElement;
            if (!item) return document.createElement('div');

            // Read widget dimensions from data attributes
            let gsW = parseInt(item.dataset.gsW || item.getAttribute('data-gs-w') || '6', 10);
            let gsH = parseInt(item.dataset.gsH || item.getAttribute('data-gs-h') || '4', 10);
            const widgetType = item.dataset.widgetType || 'Widget';

            // Clamp widget width to the grid's column count.
            // Widget defaultSize values are designed for 24-column desktop.
            // On mobile (4 columns), a w=12 widget would be 3x the grid width,
            // breaking helper sizing and collision detection.
            const grid = getGridInstance();
            if (grid) {
                const maxCols = grid.getColumn();
                gsW = Math.min(gsW, maxCols);
            }

            // Compute actual pixel size based on main grid
            const targetSize = computeHelperSize(gsW, gsH);

            // Get actual dimensions of the source card
            const itemRect = item.getBoundingClientRect();
            const actualCardWidth = itemRect.width;
            const actualCardHeight = itemRect.height;

            // Create helper - start at actual card size
            const helper = document.createElement('div');
            helper.className = 'grid-stack-item ui-draggable-dragging morph-helper';
            helper.style.cssText = `
                position: fixed;
                z-index: 10000;
                width: ${actualCardWidth}px;
                height: ${actualCardHeight}px;
                pointer-events: none;
                transition: width 0.4s cubic-bezier(0.22, 1, 0.36, 1), 
                           height 0.4s cubic-bezier(0.22, 1, 0.36, 1);
            `;

            // Store target size and card size for morph animation
            helper.dataset.targetWidth = String(targetSize.width);
            helper.dataset.targetHeight = String(targetSize.height);
            helper.dataset.cardWidth = String(actualCardWidth);
            helper.dataset.cardHeight = String(actualCardHeight);

            // Copy widget data attributes for callback normalizer to read on drop
            helper.dataset.gsW = String(gsW);
            helper.dataset.gsH = String(gsH);
            helper.dataset.widgetType = widgetType;
            // Also set as attributes for GridStack  
            helper.setAttribute('gs-w', String(gsW));
            helper.setAttribute('gs-h', String(gsH));

            // Layer 1: Clone the card content for initial appearance
            const cardClone = document.createElement('div');
            cardClone.className = 'morph-card-clone';
            cardClone.style.cssText = `
                position: absolute;
                inset: 0;
                opacity: 1;
                transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                pointer-events: none;
            `;
            // Clone the inner content of the card
            cardClone.innerHTML = item.innerHTML;
            // Match the card styling
            cardClone.style.cssText += `
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px;
                background: var(--bg-primary, #0f172a);
                border: 1px solid var(--border-color, #334155);
                border-radius: 8px;
                box-shadow: 0 8px 20px rgba(0,0,0,0.4);
            `;
            helper.appendChild(cardClone);

            // Layer 2: Portal content container (hidden initially, shown on morph)
            const helperContent = document.createElement('div');
            helperContent.className = 'grid-stack-item-content morph-content';

            // Add data attributes for DragPreviewPortal to detect and render into
            const previewId = `drag-preview-${Date.now()}`;
            helperContent.dataset.dragPreviewType = widgetType;
            helperContent.dataset.dragPreviewId = previewId;
            helperContent.dataset.morphed = 'false';

            helperContent.style.cssText = `
                position: absolute;
                inset: 0;
                opacity: 0;
                background: var(--bg-primary, #0f172a);
                border: 2px dashed var(--accent, #3b82f6);
                border-radius: 12px;
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-sizing: border-box;
                overflow: hidden;
            `;

            helper.appendChild(helperContent);

            // Copy gs-* and data-widget-* attributes for GridStack
            helper.setAttribute('gs-w', String(gsW));
            helper.setAttribute('gs-h', String(gsH));

            // Also copy min/max constraints if present
            const dataAttrs = ['gs-min-w', 'gs-min-h', 'gs-max-w', 'gs-max-h', 'data-widget-type', 'data-widget-constraints'];
            dataAttrs.forEach(attr => {
                const value = item.getAttribute(attr) || item.dataset[attr.replace('data-', '').replace(/-([a-z])/g, (_, c) => c.toUpperCase())];
                if (value) {
                    helper.setAttribute(attr, value);
                }
            });

            // Store reference for morph animation
            currentHelper = helper;
            isMorphed = false;

            // Setup MutationObserver to watch for placeholder
            setupPlaceholderWatcher();

            // Cleanup when drag ends
            const cleanupDrag = () => {
                if (observer) {
                    observer.disconnect();
                    observer = null;
                }
                currentHelper = null;
                document.removeEventListener('mouseup', cleanupDrag);
                document.removeEventListener('touchend', cleanupDrag);
            };
            document.addEventListener('mouseup', cleanupDrag);
            document.addEventListener('touchend', cleanupDrag);

            return helper;
        },
    });

    // ========== AUTO-DETECTION FOR DYNAMIC ELEMENTS ==========
    // When elements matching selector are added to DOM (e.g., modal opens),
    // automatically initialize them as drag sources.

    // Skip if we already have a watcher for this selector
    if (activeWatchers.has(selector)) {
        logger.debug('[SetupDragIn] Watcher already active for selector:', selector);
        return;
    }

    /**
     * Initialize any new elements matching the selector.
     * GridStack.setupDragIn is idempotent - it checks if elements are already
     * draggable before initializing, so it's safe to call repeatedly.
     */
    const initializeNewElements = () => {
        // Re-call setupDragIn which will only initialize NEW elements
        // (elements that aren't already draggable)
        GridStack.setupDragIn(selector, {
            appendTo: 'body',
            helper: (event: Event) => {
                const target = event.target as HTMLElement;
                const item = target.closest('.palette-item, .modal-widget, .grid-stack-item') as HTMLElement;
                if (!item) return document.createElement('div');

                const gsW = parseInt(item.dataset.gsW || item.getAttribute('data-gs-w') || '6', 10);
                const gsH = parseInt(item.dataset.gsH || item.getAttribute('data-gs-h') || '4', 10);
                const widgetType = item.dataset.widgetType || 'Widget';
                const targetSize = computeHelperSize(gsW, gsH);

                const helper = document.createElement('div');
                helper.className = 'grid-stack-item ui-draggable-dragging morph-helper';
                helper.style.cssText = `
                    position: fixed;
                    z-index: 10000;
                    width: ${cardWidth}px;
                    height: ${cardHeight}px;
                    pointer-events: none;
                    transition: width 0.2s ease-out, height 0.2s ease-out, border-radius 0.2s ease-out;
                `;

                helper.dataset.targetWidth = String(targetSize.width);
                helper.dataset.targetHeight = String(targetSize.height);

                const helperContent = document.createElement('div');
                helperContent.className = 'grid-stack-item-content morph-content';
                const previewId = `drag-preview-${Date.now()}`;
                helperContent.dataset.dragPreviewType = widgetType;
                helperContent.dataset.dragPreviewId = previewId;
                helperContent.style.cssText = `
                    position: relative;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(135deg, #1e293b, #0f172a);
                    border: 2px solid #3b82f6;
                    border-radius: 12px;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                    transition: all 0.2s ease-out;
                    box-sizing: border-box;
                    overflow: hidden;
                `;
                helper.appendChild(helperContent);

                helper.setAttribute('gs-w', String(gsW));
                helper.setAttribute('gs-h', String(gsH));

                const dataAttrs = ['gs-min-w', 'gs-min-h', 'gs-max-w', 'gs-max-h', 'data-widget-type', 'data-widget-constraints'];
                dataAttrs.forEach(attr => {
                    const value = item.getAttribute(attr) || item.dataset[attr.replace('data-', '').replace(/-([a-z])/g, (_, c) => c.toUpperCase())];
                    if (value) helper.setAttribute(attr, value);
                });

                currentHelper = helper;
                isMorphed = false;
                setupPlaceholderWatcher();

                const cleanupDrag = () => {
                    if (observer) {
                        observer.disconnect();
                        observer = null;
                    }
                    currentHelper = null;
                    document.removeEventListener('mouseup', cleanupDrag);
                    document.removeEventListener('touchend', cleanupDrag);
                };
                document.addEventListener('mouseup', cleanupDrag);
                document.addEventListener('touchend', cleanupDrag);

                return helper;
            },
        });
    };

    // Create a watcher for new elements matching the selector
    const elementWatcher = new MutationObserver((mutations) => {
        // Only check if we added nodes
        const hasAddedNodes = mutations.some(m => m.addedNodes.length > 0);
        if (!hasAddedNodes) return;

        // Check if any new elements match our selector
        const newElements = document.querySelectorAll(selector);
        if (newElements.length > 0) {
            // Debounce - wait a tick for React to finish rendering
            requestAnimationFrame(() => {
                initializeNewElements();
            });
        }
    });

    // Start watching for new elements
    elementWatcher.observe(document.body, {
        childList: true,
        subtree: true,
    });

    // Store reference to prevent duplicate watchers
    activeWatchers.set(selector, elementWatcher);
    logger.debug('[SetupDragIn] Started watching for new elements:', selector);

    /**
     * Watch for .grid-stack-placeholder to appear/disappear
     */
    function setupPlaceholderWatcher() {
        if (observer) observer.disconnect();

        observer = new MutationObserver(() => {
            const placeholder = document.querySelector('.grid-stack-placeholder') as HTMLElement;

            if (placeholder && !isMorphed) {
                // Placeholder appeared - morph to grid size
                morphToPlaceholder(placeholder);
            } else if (!placeholder && isMorphed) {
                // Placeholder disappeared (dragged outside grid) — keep morphed form.
                // Once the helper morphs from card to widget overlay, it stays that way
                // for the entire drag. This prevents the helper from reverting to the
                // modal card appearance (which would be invisible due to modal z-index).
            }
        });

        // Watch the entire body for placeholder changes
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class'],
        });
    }

    /**
     * Morph helper to match placeholder bounds
     * Sequence: Card fades out (80ms) -> Size changes -> Widget fades in
     */
    function morphToPlaceholder(placeholder: HTMLElement) {
        if (!currentHelper) return;

        const cardClone = currentHelper.querySelector('.morph-card-clone') as HTMLElement;
        const portalContent = currentHelper.querySelector('.morph-content') as HTMLElement;

        // Step 1: Immediately fade out card content (fast 80ms)
        if (cardClone) {
            cardClone.style.transition = 'opacity 0.08s ease-out';
            cardClone.style.opacity = '0';
        }

        // Step 2: After card fades, change size and fade in widget
        setTimeout(() => {
            if (!currentHelper) return;

            // Use OFFSET (unscaled) dimensions
            const offsetWidth = placeholder.offsetWidth;
            const offsetHeight = placeholder.offsetHeight;

            currentHelper.style.width = `${offsetWidth}px`;
            currentHelper.style.height = `${offsetHeight}px`;

            if (portalContent) {
                portalContent.style.opacity = '1';
                portalContent.dataset.morphed = 'true';
            }
        }, 80); // Wait for card fade-out

        isMorphed = true;
    }

    /**
     * Morph helper back to card size
     * Sequence: Widget fades out (80ms) -> Size changes -> Card fades in
     */
    function morphToCard() {
        if (!currentHelper) return;

        const cardClone = currentHelper.querySelector('.morph-card-clone') as HTMLElement;
        const portalContent = currentHelper.querySelector('.morph-content') as HTMLElement;

        // Step 1: Immediately fade out widget content (fast 80ms)
        if (portalContent) {
            portalContent.style.transition = 'opacity 0.08s ease-out';
            portalContent.style.opacity = '0';
            portalContent.dataset.morphed = 'false';
        }

        // Step 2: After widget fades, change size and fade in card
        setTimeout(() => {
            if (!currentHelper) return;

            // Morph back to card size using stored dimensions
            const cardW = parseInt(currentHelper.dataset.cardWidth || '200', 10);
            const cardH = parseInt(currentHelper.dataset.cardHeight || '40', 10);

            currentHelper.style.width = `${cardW}px`;
            currentHelper.style.height = `${cardH}px`;

            if (cardClone) {
                cardClone.style.transition = 'opacity 0.25s cubic-bezier(0.22, 1, 0.36, 1)';
                cardClone.style.opacity = '1';
            }
        }, 80); // Wait for widget fade-out

        isMorphed = false;
    }
}
