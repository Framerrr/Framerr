/**
 * Widget Conversion Utilities
 * 
 * Provides layout generation utilities for FramerrWidget.
 * Used by the layout system for mobile layout generation.
 */

import type { FramerrWidget } from './types';
import { generateMobileLayout } from '../../utils/layoutUtils';

/**
 * Generate mobile layouts for FramerrWidget array
 * 
 * Uses native FramerrWidget function - no conversion overhead.
 * Preserves all FramerrWidget fields including sharing config.
 */
export function generateAllMobileLayouts(widgets: FramerrWidget[]): FramerrWidget[] {
    return generateMobileLayout(widgets);
}
