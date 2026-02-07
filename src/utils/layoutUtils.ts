import logger from './logger';
import { getWidgetMetadata } from '../widgets/registry';
import { GRID_COLS } from '../constants/gridConfig';
import type { WidgetLayout, FramerrWidget } from '../../shared/types/widget';

/**
 * Widget info for layout calculation
 */
interface WidgetLayoutInfo {
    id: string;
    type: string;
    x: number;
    y: number;
    w: number;
    h: number;
    yStart: number;
    yEnd: number;
    widget: FramerrWidget;
}

/**
 * Generate mobile layout for FramerrWidget array
 * 
 * Uses band detection algorithm to stack widgets vertically while
 * preserving visual grouping from desktop layout.
 */
export const generateMobileLayout = (widgets: FramerrWidget[]): FramerrWidget[] => {
    const cols = GRID_COLS.sm;

    // Filter out widgets without valid layout (defensive guard for old-format data)
    const validWidgets = widgets.filter(w => w.layout && typeof w.layout.x === 'number');

    // 1. Extract layout info from FramerrWidget.layout (desktop)
    const widgetInfos: WidgetLayoutInfo[] = validWidgets.map(w => ({
        id: w.id,
        type: w.type as string,
        x: w.layout.x,
        y: w.layout.y,
        w: w.layout.w,
        h: w.layout.h,
        yStart: w.layout.y,
        yEnd: w.layout.y + w.layout.h,
        widget: w
    }));

    // 2. Sort by Y, then X, then ID for deterministic ordering
    const ySorted = [...widgetInfos].sort((a, b) => {
        if (a.y !== b.y) return a.y - b.y;
        if (a.x !== b.x) return a.x - b.x;
        return (a.id || '').localeCompare(b.id || '');
    });

    // 3. Apply band detection (sweep line algorithm)
    const bands: WidgetLayoutInfo[][] = [];
    let currentBand: WidgetLayoutInfo[] = [];
    let currentBandMaxY = -1;

    ySorted.forEach((widget) => {
        if (currentBand.length === 0) {
            currentBand.push(widget);
            currentBandMaxY = widget.yEnd;
            return;
        }

        // Hard cut: widget starts at or after current band's bottom
        if (widget.y >= currentBandMaxY) {
            bands.push(currentBand);
            currentBand = [widget];
            currentBandMaxY = widget.yEnd;
        } else {
            // No cut: widget overlaps with current band
            currentBand.push(widget);
            currentBandMaxY = Math.max(currentBandMaxY, widget.yEnd);
        }
    });

    if (currentBand.length > 0) {
        bands.push(currentBand);
    }

    logger.debug('Band detection', {
        bandCount: bands.length,
        bands: bands.map(band => ({
            widgets: band.map(w => w.type),
            yRange: `${Math.min(...band.map(w => w.y))}-${Math.max(...band.map(w => w.yEnd))}`
        }))
    });

    // 4. Sort each band by X, then Y, then ID
    const sorted = bands.flatMap(band => {
        return [...band].sort((a, b) => {
            if (a.x !== b.x) return a.x - b.x;
            if (a.y !== b.y) return a.y - b.y;
            return (a.id || '').localeCompare(b.id || '');
        });
    });

    logger.debug('Final sorted order', { order: sorted.map(w => w.type) });

    // 5. Create stacked mobile layout
    let currentY = 0;
    return sorted.map((item) => {
        const mobileHeight = calculateMobileHeight(item.widget);
        const mobileLayout: WidgetLayout = {
            x: 0,
            y: currentY,
            w: cols,
            h: mobileHeight
        };
        currentY += mobileHeight;

        // Return FramerrWidget with mobileLayout set (preserves all fields)
        return {
            ...item.widget,
            mobileLayout
        };
    });
};

/**
 * Calculate mobile height for FramerrWidget
 */
const calculateMobileHeight = (widget: FramerrWidget): number => {
    const metadata = getWidgetMetadata(widget.type);
    const defaultH = metadata?.defaultSize?.h ?? 2;
    const desktopHeight = widget.layout.h ?? defaultH;
    const minH = metadata?.minSize?.h ?? 1;
    return Math.max(minH, desktopHeight);
};

/**
 * Generate mobile layout for all widgets (sm breakpoint)
 */
export const generateAllMobileLayouts = (widgets: FramerrWidget[]): FramerrWidget[] => {
    return generateMobileLayout(widgets);
};
