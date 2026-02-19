/**
 * Walkthrough Flow Registry
 * 
 * Central registry mapping flowIds to flow configurations.
 * Each flow has steps plus optional metadata (requiredRoute, setup).
 * To add a new flow: import the steps and add to the registry.
 */

import type { WalkthroughStep, FlowConfig } from '../types';
import onboardingSteps from './onboarding';

const flowRegistry: Record<string, FlowConfig> = {
    onboarding: {
        steps: onboardingSteps,
        requiredRoute: 'dashboard',
        setup: () => {
            // Scroll to top-left so step 1 targets are visible
            const scrollContainer = document.getElementById('dashboard-layer');
            if (scrollContainer) {
                scrollContainer.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            }
        },
    },
};

/**
 * Get the step definitions for a given flow ID.
 * Returns null if the flow is not registered.
 */
export function getFlow(flowId: string): WalkthroughStep[] | null {
    return flowRegistry[flowId]?.steps ?? null;
}

/**
 * Get the full flow config (steps + metadata) for a given flow ID.
 * Returns null if the flow is not registered.
 */
export function getFlowConfig(flowId: string): FlowConfig | null {
    return flowRegistry[flowId] ?? null;
}

/**
 * Get all registered flow IDs
 */
export function getFlowIds(): string[] {
    return Object.keys(flowRegistry);
}

export default flowRegistry;
