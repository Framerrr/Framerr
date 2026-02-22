/**
 * Walkthrough System Types
 * 
 * Declarative step API for the walkthrough engine.
 * The engine is app-agnostic — all app-specific behavior
 * lives in flow definitions and external component emit() calls.
 */

import type { Placement } from '@floating-ui/react';

// ============================================================================
// Advance Conditions
// ============================================================================

/** How the user advances past a step */
export type AdvanceCondition =
    | { type: 'button' }                       // Click Next/Start/Finish
    | { type: 'action' }                       // Click the target element
    | { type: 'custom-event'; event: string }; // Named event via emit()

// ============================================================================
// Step Interaction Rules
// ============================================================================

/** Controls what the user can interact with during a step */
export interface StepInteraction {
    /** CSS selectors that remain clickable during this step */
    allow?: string[];
    /** CSS selectors that trigger the end-walkthrough confirmation */
    block?: string[];
    /** When true, relax click blocker during drag operations */
    dragAware?: boolean;
    /** CSS class that identifies a dragging element (configurable per drag library) */
    dragClass?: string;
    /** CSS selector for the drop zone — SVG spotlight switches here during drag */
    dragTargetSelector?: string;
}

// ============================================================================
// Step Lifecycle
// ============================================================================

/** Phase within a step's lifecycle */
export type StepPhase = 'entering' | 'active' | 'exiting';

// ============================================================================
// Step Definition
// ============================================================================

/** A single step in a walkthrough flow */
export interface WalkthroughStep {
    /** Unique step identifier */
    id: string;
    /** Overlay positioning mode */
    mode: 'centered' | 'anchored';
    /** CSS selector for the target element (anchored mode only).
     *  Can be a static string or a function that resolves dynamically from step data. */
    targetSelector?: string | ((stepData: Record<string, unknown>) => string);
    /** Card title */
    title: string;
    /** Card body text */
    message: string;
    /** How the user advances past this step */
    advanceOn: AdvanceCondition;
    /** Preferred placement relative to target (floating-ui) */
    placement?: Placement;
    /** When true, the walkthrough card is hidden but the SVG overlay still shows */
    hideCard?: boolean;
    /** Interaction rules — what's clickable, blocked, drag-aware */
    interaction?: StepInteraction;
    /** When true, prevent modals containing the target from auto-closing */
    modalProtection?: boolean;
    /** When true, clicks on the target element are silently blocked (target still visible/highlighted) */
    blockTarget?: boolean;
    /** ms to wait before overlay appears — user sees the raw UI first */
    enterDelay?: number;
    /** ms to wait after advancing before next step starts */
    exitDelay?: number;
    /** Conditional display based on context (e.g., role-based filtering) */
    condition?: (ctx: WalkthroughConditionContext) => boolean;
    /** Hash route to navigate to before this step renders (e.g., '#settings/integrations/services') */
    navigateTo?: string;
    /** Event name to dispatch (via window) before this step enters.
     *  Used for app-specific cleanup like closing modals or saving state. */
    beforeEnter?: string;
    /** How the spotlight transitions from the previous step.
     *  'morph' (default): keeps old cutout, morphs to new position.
     *  'reset': clears old cutout, fades in fresh for the new target. */
    spotlightTransition?: 'morph' | 'reset';
}

/** Context passed to step condition functions */
export interface WalkthroughConditionContext {
    role: string;
    stepData: Record<string, unknown>;
}

// ============================================================================
// Flow Definitions
// ============================================================================

/** A named walkthrough flow (collection of steps) */
export interface WalkthroughFlow {
    id: string;
    name: string;
    description: string;
    steps: WalkthroughStep[];
}

/** Flow-level configuration stored in the registry */
export interface FlowConfig {
    /** The step definitions for this flow */
    steps: WalkthroughStep[];
    /** Hash route required before auto-start (e.g., 'dashboard').
     *  If set, engine defers start until user navigates to this route. */
    requiredRoute?: string;
    /** Setup function called before step 0 begins (e.g., scroll to top) */
    setup?: () => void;
}

// ============================================================================
// Context State
// ============================================================================

/** Runtime state of the walkthrough engine */
export interface WalkthroughState {
    /** Whether a walkthrough is currently active */
    isActive: boolean;
    /** Whether the walkthrough is temporarily suspended (overlay hidden, state preserved) */
    suspended: boolean;
    /** Current flow being run */
    flowId: string | null;
    /** Current step index (0-based, within filtered steps) */
    currentStepIndex: number;
    /** Current phase within the active step */
    stepPhase: StepPhase;
    /** User role for conditional step filtering */
    role: string;
    /** Generic data store for inter-step communication */
    stepData: Record<string, unknown>;
}

/** Public API exposed by WalkthroughContext */
export interface WalkthroughContextValue {
    /** Current engine state */
    state: WalkthroughState;
    /** Current step definition (null if inactive) */
    currentStep: WalkthroughStep | null;
    /** Current phase within the active step */
    stepPhase: StepPhase;
    /** Total number of visible steps in current flow */
    totalSteps: number;
    /** Current step number (1-based, for display) */
    currentStepNumber: number;
    /** Start a specific walkthrough flow */
    startFlow: (flowId: string) => void;
    /** Advance to the next step (or finish if last) */
    advance: () => void;
    /** Skip the entire walkthrough */
    skip: () => void;
    /** Emit a named event — engine checks against current step's advanceOn */
    emit: (event: string, data?: Record<string, unknown>) => void;
    /** Whether the current step has modal protection active */
    isModalProtected: boolean;
    /** Store data for inter-step communication */
    setStepData: (key: string, value: unknown) => void;
    /** Retrieve stored step data */
    getStepData: (key: string) => unknown;
    /** Temporarily hide the overlay while keeping walkthrough state intact */
    suspend: () => void;
    /** Restore the overlay after a suspend */
    resume: () => void;
    /** Reset a flow's completion and restart it (route-aware — defers if not on required page) */
    resetAndStartFlow: (flowId: string) => void;
}

// ============================================================================
// Persistence Types
// ============================================================================

/** Persistence callbacks injected into the provider */
export interface WalkthroughPersistence {
    /** Called when a flow is completed — persist the completion */
    onFlowComplete: (flowId: string) => Promise<void>;
    /** Called on mount to check which flows are already completed */
    fetchCompletedFlows: () => Promise<Record<string, boolean>>;
    /** Reset a flow's completion status so it can be restarted */
    resetFlow: (flowId: string) => Promise<void>;
}

/** Response shape for completed flows (for backward compat) */
export interface WalkthroughStatusResponse {
    flows: Record<string, boolean>;
}
