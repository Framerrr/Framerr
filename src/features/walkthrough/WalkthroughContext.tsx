/**
 * WalkthroughContext
 * 
 * Generic walkthrough engine. Flow-agnostic — just runs
 * whatever flow steps it's given.
 * 
 * Responsibilities:
 * - State machine with step phases (entering → active → exiting)
 * - Event bus for custom-event advancement
 * - Step data store for inter-step communication
 * - Persistence via injected callbacks
 * - Conditional step filtering
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { getFlow, getFlowConfig } from './flows/registry';
import type {
    WalkthroughContextValue,
    WalkthroughState,
    WalkthroughStep,
    WalkthroughPersistence,
    StepPhase,
} from './types';
import logger from '../../utils/logger';

const WalkthroughContext = createContext<WalkthroughContextValue | null>(null);

interface WalkthroughProviderProps {
    children: React.ReactNode;
    userRole: string;
    /** Persistence callbacks — injected to keep engine app-agnostic */
    persistence: WalkthroughPersistence;
    /** Flow ID to auto-start if not completed (e.g., 'onboarding') */
    autoStartFlowId?: string;
    /** Called when a flow completes (not on skip). Use for app-specific cleanup like saving. */
    onFlowComplete?: (flowId: string) => void;
}

export function WalkthroughProvider({
    children,
    userRole,
    persistence,
    autoStartFlowId,
    onFlowComplete,
}: WalkthroughProviderProps): React.JSX.Element {
    const [state, setState] = useState<WalkthroughState>({
        isActive: false,
        suspended: false,
        flowId: null,
        currentStepIndex: 0,
        stepPhase: 'entering',
        role: userRole,
        stepData: {},
    });

    const hasFetchedRef = useRef(false);
    const enterDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const exitDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Update role if it changes
    useEffect(() => {
        setState(prev => ({ ...prev, role: userRole }));
    }, [userRole]);

    // Get filtered steps (respecting conditions) for current flow
    // Re-evaluates when stepData changes so conditions can branch on runtime data
    const filteredSteps = useMemo((): WalkthroughStep[] => {
        if (!state.flowId) return [];
        const allSteps = getFlow(state.flowId);
        if (!allSteps) return [];

        return allSteps.filter(step => {
            if (!step.condition) return true;
            return step.condition({ role: state.role, stepData: state.stepData });
        });
    }, [state.flowId, state.role, state.stepData]);

    // Current step
    const currentStep = useMemo((): WalkthroughStep | null => {
        if (!state.isActive || state.currentStepIndex >= filteredSteps.length) return null;
        return filteredSteps[state.currentStepIndex];
    }, [state.isActive, state.currentStepIndex, filteredSteps]);

    // Step phase — exposed directly for convenience
    const stepPhase = state.stepPhase;

    // Modal protection — derived from current step config
    const isModalProtected = useMemo((): boolean => {
        if (!currentStep) return false;
        return currentStep.modalProtection === true;
    }, [currentStep]);

    // ─── Step Phase Management ───────────────────────────────────────
    // When step changes, start the entering phase with enterDelay
    const prevStepIndexRef = useRef<number>(-1);

    useEffect(() => {
        if (!state.isActive || !currentStep) return;
        if (prevStepIndexRef.current === state.currentStepIndex) return;

        prevStepIndexRef.current = state.currentStepIndex;

        // Clear any existing timers
        if (enterDelayTimerRef.current) clearTimeout(enterDelayTimerRef.current);
        if (exitDelayTimerRef.current) clearTimeout(exitDelayTimerRef.current);

        const delay = currentStep.enterDelay ?? 0;

        if (delay > 0) {
            // Start in entering phase, transition to active after delay
            setState(prev => ({ ...prev, stepPhase: 'entering' }));
            enterDelayTimerRef.current = setTimeout(() => {
                setState(prev => ({ ...prev, stepPhase: 'active' }));
            }, delay);
        } else {
            // No delay — go directly to active
            setState(prev => ({ ...prev, stepPhase: 'active' }));
        }
    }, [state.isActive, state.currentStepIndex, currentStep]);

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (enterDelayTimerRef.current) clearTimeout(enterDelayTimerRef.current);
            if (exitDelayTimerRef.current) clearTimeout(exitDelayTimerRef.current);
        };
    }, []);

    // ─── Complete Flow ───────────────────────────────────────────────
    const completeFlow = useCallback(async (flowId: string) => {
        try {
            await persistence.onFlowComplete(flowId);
            // Fire app-specific completion callback (e.g., save dashboard)
            onFlowComplete?.(flowId);
        } catch (error) {
            logger.error('[Walkthrough] Failed to complete flow:', { error });
        }
    }, [persistence, onFlowComplete]);

    // ─── Start Flow ──────────────────────────────────────────────────
    const startFlow = useCallback((flowId: string) => {
        const steps = getFlow(flowId);
        if (!steps) {
            logger.warn(`[Walkthrough] Unknown flow: ${flowId}`);
            return;
        }

        // Run flow-level setup (e.g., scroll to top) before starting
        const flowConfig = getFlowConfig(flowId);
        if (flowConfig?.setup) {
            flowConfig.setup();
        }

        logger.debug(`[Walkthrough] Starting flow: ${flowId}`);
        prevStepIndexRef.current = -1; // Reset so phase effect fires

        // Determine initial phase based on first visible step's enterDelay
        const firstStep = steps.find(step => !step.condition || step.condition({ role: userRole, stepData: {} }));
        const initialPhase: StepPhase = (firstStep?.enterDelay && firstStep.enterDelay > 0) ? 'entering' : 'active';

        setState(prev => ({
            ...prev,
            isActive: true,
            flowId,
            currentStepIndex: 0,
            stepPhase: initialPhase,
            stepData: {},
        }));
    }, [userRole]);

    // ─── Advance ─────────────────────────────────────────────────────
    const advance = useCallback(() => {
        // Synchronous signal for drag-awareness: the interaction hook's
        // MutationObserver needs to know immediately that advance was called,
        // before React renders. DOM events dispatch synchronously.
        window.dispatchEvent(new CustomEvent('walkthrough-step-advanced'));

        setState(prev => {
            if (!prev.isActive || !prev.flowId) return prev;

            const steps = getFlow(prev.flowId);
            if (!steps) return prev;

            // Filter steps for the user's role
            const visibleSteps = steps.filter(step => {
                if (!step.condition) return true;
                return step.condition({ role: prev.role, stepData: prev.stepData });
            });

            // Current step's exitDelay
            const currentIdx = prev.currentStepIndex;
            const exitDelay = currentIdx < visibleSteps.length
                ? (visibleSteps[currentIdx]?.exitDelay ?? 0)
                : 0;

            const nextIndex = currentIdx + 1;

            logger.debug(`[Walkthrough] advance: currentIdx=${currentIdx}, nextIndex=${nextIndex}, visibleSteps=${visibleSteps.length}, ids=[${visibleSteps.map(s => s.id).join(',')}]`);
            logger.debug(`[Walkthrough] advance: current step="${visibleSteps[currentIdx]?.id}", next step="${visibleSteps[nextIndex]?.id ?? 'END'}", role=${prev.role}, widgetType=${prev.stepData.widgetType}`);

            const doAdvance = () => {
                if (nextIndex >= visibleSteps.length) {
                    // Flow complete
                    completeFlow(prev.flowId!);
                    logger.debug(`[Walkthrough] Flow completed: ${prev.flowId}`);
                    setState(s => ({
                        ...s,
                        isActive: false,
                        suspended: false,
                        flowId: null,
                        currentStepIndex: 0,
                        stepPhase: 'entering',
                        stepData: {},
                    }));
                } else {
                    // Determine phase for next step based on enterDelay
                    const nextStep = visibleSteps[nextIndex];
                    const nextPhase: StepPhase = (nextStep?.enterDelay && nextStep.enterDelay > 0) ? 'entering' : 'active';
                    prevStepIndexRef.current = -1; // Reset so phase effect fires for new step
                    setState(s => ({
                        ...s,
                        currentStepIndex: nextIndex,
                        stepPhase: nextPhase,
                    }));
                }
            };

            if (exitDelay > 0) {
                // Transition to exiting phase, then advance after delay
                if (exitDelayTimerRef.current) clearTimeout(exitDelayTimerRef.current);
                exitDelayTimerRef.current = setTimeout(doAdvance, exitDelay);
                return { ...prev, stepPhase: 'exiting' as StepPhase };
            } else {
                // No exit delay — advance immediately
                // We need to call doAdvance outside of setState to avoid nested setState
                // Use a microtask
                queueMicrotask(doAdvance);
                return prev;
            }
        });
    }, [completeFlow]);

    // ─── Skip ────────────────────────────────────────────────────────
    const skip = useCallback(() => {
        setState(prev => {
            if (prev.flowId) {
                completeFlow(prev.flowId);
            }
            logger.debug(`[Walkthrough] Flow skipped: ${prev.flowId}`);
            if (enterDelayTimerRef.current) clearTimeout(enterDelayTimerRef.current);
            if (exitDelayTimerRef.current) clearTimeout(exitDelayTimerRef.current);
            prevStepIndexRef.current = -1;
            return {
                ...prev,
                isActive: false,
                suspended: false,
                flowId: null,
                currentStepIndex: 0,
                stepPhase: 'entering' as StepPhase,
                stepData: {},
            };
        });
    }, [completeFlow]);

    // ─── Event Bus ───────────────────────────────────────────────────
    // When emit() is called, check if the current step's advanceOn
    // matches the emitted event. If so, auto-advance.
    const shouldAdvanceRef = useRef(false);

    const emit = useCallback((event: string, data?: Record<string, unknown>) => {
        // Store any data passed with the event
        if (data) {
            setState(prev => ({
                ...prev,
                stepData: { ...prev.stepData, ...data },
            }));
        }

        // Check if current step should advance on this event
        // Use a ref to signal advance (avoids side effects inside setState)
        shouldAdvanceRef.current = false;

        setState(prev => {
            if (!prev.isActive || !prev.flowId) return prev;

            const steps = getFlow(prev.flowId);
            if (!steps) return prev;

            const visibleSteps = steps.filter(step => {
                if (!step.condition) return true;
                return step.condition({ role: prev.role, stepData: prev.stepData });
            });

            const step = visibleSteps[prev.currentStepIndex];
            if (!step) return prev;

            if (step.advanceOn.type === 'custom-event' && step.advanceOn.event === event) {
                logger.debug(`[Walkthrough] Event '${event}' matched step '${step.id}', advancing`);
                shouldAdvanceRef.current = true;
            }

            return prev;
        });

        // Advance outside of setState to avoid React Strict Mode double-invocation
        queueMicrotask(() => {
            if (shouldAdvanceRef.current) {
                shouldAdvanceRef.current = false;
                advance();
            }
        });
    }, [advance]);

    // ─── Step Data ───────────────────────────────────────────────────
    const setStepData = useCallback((key: string, value: unknown) => {
        setState(prev => ({
            ...prev,
            stepData: { ...prev.stepData, [key]: value },
        }));
    }, []);

    const getStepData = useCallback((key: string): unknown => {
        return state.stepData[key];
    }, [state.stepData]);

    // ─── Suspend / Resume ─────────────────────────────────────────────
    const suspend = useCallback(() => {
        logger.debug('[Walkthrough] Suspended — overlay hidden');
        setState(prev => ({ ...prev, suspended: true }));
    }, []);

    const resume = useCallback(() => {
        logger.debug('[Walkthrough] Resumed — overlay restored');
        setState(prev => ({ ...prev, suspended: false }));
    }, []);

    // ─── Route-aware start (reused by auto-start and resetAndStartFlow) ───
    const startFlowRouteAware = useCallback((flowId: string) => {
        const flowConfig = getFlowConfig(flowId);
        const requiredRoute = flowConfig?.requiredRoute;

        const doStart = () => {
            // Delay so user sees the page before the tutorial starts
            setTimeout(() => startFlow(flowId), 850);
        };

        if (requiredRoute) {
            const currentHash = window.location.hash.slice(1) || 'dashboard';
            const currentPage = currentHash.split('?')[0].split('/')[0];

            if (currentPage === requiredRoute) {
                doStart();
            } else {
                logger.debug(`[Walkthrough] Deferring start until route matches '${requiredRoute}'`);
                const onHashChange = () => {
                    const hash = window.location.hash.slice(1) || 'dashboard';
                    const page = hash.split('?')[0].split('/')[0];
                    if (page === requiredRoute) {
                        window.removeEventListener('hashchange', onHashChange);
                        doStart();
                    }
                };
                window.addEventListener('hashchange', onHashChange);
            }
        } else {
            doStart();
        }
    }, [startFlow]);

    // ─── Reset and restart a flow (unified for shortcut + settings button) ───
    const resetAndStartFlow = useCallback((flowId: string) => {
        persistence.resetFlow(flowId).then(() => {
            startFlowRouteAware(flowId);
        }).catch((error: unknown) => {
            logger.error('[Walkthrough] Failed to reset flow:', { error });
        });
    }, [persistence, startFlowRouteAware]);

    // ─── Auto-start on mount ─────────────────────────────────────────
    useEffect(() => {
        if (hasFetchedRef.current || !autoStartFlowId) return;
        hasFetchedRef.current = true;

        (async () => {
            try {
                const completedFlows = await persistence.fetchCompletedFlows();

                if (!completedFlows[autoStartFlowId]) {
                    startFlowRouteAware(autoStartFlowId);
                }
            } catch (error) {
                logger.error('[Walkthrough] Failed to fetch status:', { error });
            }
        })();
    }, [startFlowRouteAware, autoStartFlowId, persistence]);

    // ─── Context Value ───────────────────────────────────────────────
    const value = useMemo((): WalkthroughContextValue => ({
        state,
        currentStep,
        stepPhase,
        totalSteps: filteredSteps.length,
        currentStepNumber: state.currentStepIndex + 1,
        startFlow,
        advance,
        skip,
        emit,
        isModalProtected,
        setStepData,
        getStepData,
        suspend,
        resume,
        resetAndStartFlow,
    }), [state, currentStep, stepPhase, filteredSteps.length, startFlow, advance, skip, emit, isModalProtected, setStepData, getStepData, suspend, resume, resetAndStartFlow]);

    return (
        <WalkthroughContext.Provider value={value}>
            {children}
        </WalkthroughContext.Provider>
    );
}

export function useWalkthrough(): WalkthroughContextValue | null {
    return useContext(WalkthroughContext);
}

export default WalkthroughContext;
