/**
 * Onboarding Flow
 * 
 * The first-time user walkthrough that guides admins and users
 * through the basics of Framerr.
 * 
 * Admin flow: Welcome → Edit Mode → Add Widget → Config → Integration → Service Settings → End
 * User flow:  Welcome → Edit Mode → Add Widget → Config → End
 */

import type { WalkthroughStep } from '../types';
import { getWidgetMetadata } from '../../../widgets/registry';

const onboardingSteps: WalkthroughStep[] = [
    // Step 1: Welcome (centered, no target)
    {
        id: 'welcome',
        mode: 'centered',
        title: 'Welcome to Framerr!',
        message: "Let's take a quick tour to set up your dashboard. It'll only take a minute.",
        advanceOn: { type: 'button' },
    },

    // Step 2: Edit Mode (anchored to edit button)
    {
        id: 'edit-mode',
        mode: 'anchored',
        targetSelector: '[data-walkthrough="edit-button"]',
        title: 'Enter Edit Mode',
        message: 'Click the edit button to enter edit mode. This lets you add, rearrange, and configure widgets. On mobile, you can also swipe up on the tab bar!',
        advanceOn: { type: 'action' },
        placement: 'bottom',
    },

    // Step 3: Add Widget button (anchored to Add Widget button in DashboardEditBar)
    {
        id: 'add-widget-button',
        mode: 'anchored',
        targetSelector: '[data-walkthrough="add-widget-button"]',
        title: 'Add Your First Widget',
        message: 'Click here to open the widget catalog and add a widget to your dashboard.',
        advanceOn: { type: 'action' },
        placement: 'bottom',
        exitDelay: 250,
    },

    // Step 4.1: Add Widget Intro (centered overlay while modal is open)
    {
        id: 'add-widget-intro',
        mode: 'centered',
        title: 'Widget Catalog',
        message: "Browse available widgets here. Click 'Add to Dashboard' on any widget, or drag one directly onto your dashboard to place it.",
        advanceOn: { type: 'button' },
        enterDelay: 250,
        modalProtection: true,
    },

    // Step 4.2: Add Widget Interactive (modal focused, no card, user interacts freely)
    {
        id: 'add-widget-interact',
        mode: 'anchored',
        targetSelector: '.add-widget-modal',
        title: '',
        message: '',
        advanceOn: { type: 'custom-event', event: 'widget-added' },
        hideCard: true,
        modalProtection: true,
        interaction: {
            allow: ['.add-widget-modal'],
            block: ['[data-walkthrough="modal-close-button"]'],
            dragAware: true,
            dragClass: 'ui-draggable-dragging',
            dragTargetSelector: '[data-walkthrough="dashboard-grid"]',
        },
    },

    // Step 5a: Widget Config Gear (anchored to the just-added widget's gear button)
    {
        id: 'widget-config-gear',
        mode: 'anchored',
        targetSelector: (stepData) => {
            const widgetId = stepData.widgetId as string;
            return widgetId
                ? `[data-walkthrough="widget-config-button"][data-widget-id="${widgetId}"]`
                : '[data-walkthrough="widget-config-button"]';
        },
        title: 'Widget Settings',
        message: 'Click the settings icon to open a widget\'s configuration menu.',
        advanceOn: { type: 'action' },
        placement: 'left',
    },

    // Step 5b: Edit Button inside popover (anchored to Edit button)
    {
        id: 'widget-config-edit',
        mode: 'anchored',
        targetSelector: (stepData) => {
            const widgetId = stepData.widgetId as string;
            return widgetId
                ? `[data-walkthrough="widget-edit-button"][data-widget-id="${widgetId}"]`
                : '[data-walkthrough="widget-edit-button"]';
        },
        title: 'Edit Widget',
        message: 'Click Edit to open the widget configuration panel where you can customize this widget.',
        advanceOn: { type: 'action' },
        enterDelay: 500,
        placement: 'left',
    },

    // ─── USER FLOW: Integration info or generic config ───────────────

    // Step 6a: Integration section (USER only, widget has integrations)
    // Spotlights the integration dropdown/empty state area
    {
        id: 'user-integration-info',
        mode: 'anchored',
        targetSelector: '[data-walkthrough="widget-integration-section"]',
        title: 'Integrations',
        message: 'This is where you connect integrations to power your widgets. Integrations shared to you by your administrator will appear here.',
        advanceOn: { type: 'button' },
        placement: 'right',
        enterDelay: 500,
        modalProtection: true,
        blockTarget: true,
        spotlightTransition: 'reset',
        condition: (ctx) => {
            if (ctx.role === 'admin') return false;
            const widgetType = ctx.stepData.widgetType as string;
            if (!widgetType) return true; // Fallback: show for unknown types
            const metadata = getWidgetMetadata(widgetType);
            return !metadata?.isGlobal; // Show for integration-backed widgets
        },
    },

    // Step 6b: Generic config modal info (USER only, global widget)
    // Centered overlay: no target, just informational
    {
        id: 'user-config-info',
        mode: 'centered',
        title: 'Widget Configuration',
        message: 'This is where you can configure the settings and functions of your individual widgets. Each widget type has its own options.',
        advanceOn: { type: 'button' },
        condition: (ctx) => {
            if (ctx.role === 'admin') return false;
            const widgetType = ctx.stepData.widgetType as string;
            if (!widgetType) return false; // Fallback: don't show for unknown types
            const metadata = getWidgetMetadata(widgetType);
            return metadata?.isGlobal === true; // Show for global widgets
        },
    },

    // ─── ADMIN FLOW: Integration → Service Settings ──────────────────

    // Step 6: Admin integration info (anchored to integration section)
    {
        id: 'admin-integration-info',
        mode: 'anchored',
        targetSelector: '[data-walkthrough="widget-integration-section"]',
        title: 'Connect an Integration',
        message: 'Compatible integrations will appear here. Click next to head to Service Settings to connect your first integration!',
        advanceOn: { type: 'button' },
        placement: 'right',
        enterDelay: 500,
        modalProtection: true,
        blockTarget: true,
        spotlightTransition: 'reset',
        condition: (ctx) => ctx.role === 'admin',
    },

    // Step 7: Navigate to Service Settings and spotlight the integration grid (admin only)
    // Shows the seeded integrations and gives context before asking them to add a new one
    {
        id: 'admin-integration-grid',
        mode: 'anchored',
        navigateTo: '#settings/integrations/services',
        targetSelector: '[data-walkthrough="integration-grid"]',
        title: 'Your Integrations',
        message: "We've added some example integrations for you. You can configure, edit, or remove these anytime.",
        advanceOn: { type: 'button' },
        placement: 'bottom',
        enterDelay: 300,
        beforeEnter: 'close-modals-and-save',
        blockTarget: true,
        spotlightTransition: 'reset',
        condition: (ctx) => ctx.role === 'admin',
    },

    // Step 8: Spotlight Add Integration button (admin only)
    // Now that they've seen the grid, guide them to add their own
    {
        id: 'admin-service-settings',
        mode: 'anchored',
        targetSelector: '[data-walkthrough="add-integration-button"]',
        title: 'Add an Integration',
        message: "Ready to connect your own service? Click here to add a new one!",
        advanceOn: { type: 'action' },
        placement: 'bottom',
        spotlightTransition: 'morph',
        condition: (ctx) => ctx.role === 'admin',
    },

    // Step 8: Integration type dropdown (admin only)
    // Spotlights the opened dropdown so user can pick a service type
    {
        id: 'admin-select-type',
        mode: 'anchored',
        targetSelector: '.integration-type-dropdown',
        title: 'Select a Service',
        message: "Choose one to get started. You can add as many as you need later.",
        advanceOn: { type: 'custom-event', event: 'integration-type-selected' },
        placement: 'left-start',
        enterDelay: 300,
        modalProtection: true,
        condition: (ctx) => ctx.role === 'admin',
        interaction: {
            allow: ['.integration-type-dropdown'],
        },
    },

    // Final step: Congrats (centered)
    // Shared by all roles — modalProtection keeps the admin's integration modal open
    {
        id: 'complete',
        mode: 'centered',
        title: "You're All Set! 🎉",
        message: "You're all set! Explore your dashboard, configure your integrations, and make Framerr your own. Have fun!",
        advanceOn: { type: 'button' },
        modalProtection: true,
        enterDelay: 500,
    },
];

export default onboardingSteps;
