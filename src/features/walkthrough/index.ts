/**
 * Walkthrough Feature — Barrel Export
 */

export { WalkthroughProvider, useWalkthrough } from './WalkthroughContext';
export { default as WalkthroughOverlay } from './WalkthroughOverlay';
export type {
    WalkthroughContextValue,
    WalkthroughStep,
    WalkthroughState,
    StepPhase,
    StepInteraction,
    AdvanceCondition,
    WalkthroughPersistence,
} from './types';
