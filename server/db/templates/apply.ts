/**
 * Template Application Helpers
 * 
 * Functions for applying templates to user dashboards and sharing templates.
 */

import logger from '../../utils/logger';
import { invalidateUserSettings } from '../../utils/invalidateUserSettings';
import { createTemplate, getUserCopyOfTemplate } from './crud';
import { createBackup } from './backup';
import type {
    TemplateWidget,
    DashboardTemplate,
    ShareTemplateOptions,
    ShareTemplateResult,
} from '../templates.types';

// ============================================================================
// Template Application Helpers
// ============================================================================

/**
 * Convert template widgets to dashboard widget format
 * 
 * Since TemplateWidget = FramerrWidget (unified format), this function
 * only needs to regenerate unique IDs. The layout, mobileLayout, and config
 * properties are passed through unchanged.
 * 
 * @param widgets - Template widgets to convert
 * @returns Dashboard widgets with new unique IDs
 */
export function convertTemplateWidgets(widgets: TemplateWidget[]): TemplateWidget[] {
    return widgets.map((tw, index) => ({
        ...tw,
        id: `widget-${Date.now()}-${index}`,  // Generate unique ID
        // layout, mobileLayout, type, config all pass through unchanged
    }));
}

/**
 * Apply a template to a user's dashboard
 * Used by both the apply endpoint and user creation (default template)
 * 
 * @param template - The template to apply
 * @param userId - User ID to apply to
 * @param createBackupFirst - Whether to backup current dashboard (false for new users)
 */
export async function applyTemplateToUser(
    template: DashboardTemplate,
    userId: string,
    createBackupFirst: boolean = true
): Promise<TemplateWidget[]> {
    // Dynamic import to avoid circular dependency
    const { getUserConfig, updateUserConfig } = await import('../userConfig');

    // Backup current dashboard if requested
    if (createBackupFirst) {
        const userConfig = await getUserConfig(userId);
        const currentDashboard = userConfig.dashboard || {};

        await createBackup(
            userId,
            currentDashboard.widgets || [],
            currentDashboard.mobileLayoutMode || 'linked',
            currentDashboard.mobileWidgets
        );
    }

    // Convert template widgets to dashboard format
    const dashboardWidgets = convertTemplateWidgets(template.widgets);

    // Convert mobile widgets if template has independent mobile layout
    const dashboardMobileWidgets = template.mobileLayoutMode === 'independent' && template.mobileWidgets
        ? convertTemplateWidgets(template.mobileWidgets)  // Same format, just regenerate IDs
        : undefined;

    // Apply to user's dashboard - preserve template's mobile layout settings
    await updateUserConfig(userId, {
        dashboard: {
            widgets: dashboardWidgets,
            mobileLayoutMode: template.mobileLayoutMode || 'linked',
            mobileWidgets: dashboardMobileWidgets,
        },
    });

    logger.info(`[Templates] Applied: template=${template.id} user=${userId} widgets=${dashboardWidgets.length} mobileMode=${template.mobileLayoutMode}`);

    return dashboardWidgets;
}

// ============================================================================
// Template Sharing Helper
// ============================================================================

/**
 * Share a template with a user - creates user's copy with sanitized config.
 * 
 * Used by:
 * - Manual share endpoint (POST /api/templates/:id/share)
 * - Auto-share for new users (default template)
 * 
 * @param template - The template to share
 * @param targetUserId - User to share with
 * @param sharedByAdminId - Admin performing the share
 * @param options - Sharing options
 */
export async function shareTemplateWithUser(
    template: DashboardTemplate,
    targetUserId: string,
    sharedByAdminId: string,
    options: ShareTemplateOptions = {}
): Promise<ShareTemplateResult> {
    const {
        stripConfigs = true,
        shareIntegrations = false,
        applyToDashboard = false,
        createBackup: shouldCreateBackup = true,
    } = options;

    // Check if user already has a copy
    const existingCopy = await getUserCopyOfTemplate(targetUserId, template.id);
    if (existingCopy) {
        logger.debug(`[Templates] User already has copy: user=${targetUserId} template=${template.id}`);
        return {
            templateCopy: existingCopy,
            integrationsShared: [],
            skipped: true,
            reason: 'User already has a copy of this template'
        };
    }

    // Strip sensitive configs if requested, but respect per-widget shareSensitiveConfig flag
    let sanitizedWidgets = template.widgets;
    let sanitizedMobileWidgets = template.mobileWidgets;
    if (stripConfigs) {
        const { stripSensitiveConfig, hasSensitiveConfig } = await import('../../../shared/widgetIntegrations');

        // Sanitize desktop widgets
        sanitizedWidgets = template.widgets.map(widget => {
            // Check if widget has sensitive config AND owner hasn't opted to share it
            if (hasSensitiveConfig(widget.type) && widget.shareSensitiveConfig !== true) {
                return {
                    ...widget,
                    config: stripSensitiveConfig(widget.type, widget.config || {})
                };
            }
            // Keep config as-is (either not sensitive, or owner opted to share)
            return widget;
        });

        // Sanitize mobile widgets if they exist
        if (template.mobileWidgets && template.mobileWidgets.length > 0) {
            sanitizedMobileWidgets = template.mobileWidgets.map(widget => {
                if (hasSensitiveConfig(widget.type) && widget.shareSensitiveConfig !== true) {
                    return {
                        ...widget,
                        config: stripSensitiveConfig(widget.type, widget.config || {})
                    };
                }
                return widget;
            });
        }
    }

    // Create user's copy of the template (including mobile layout if independent)
    const userCopy = await createTemplate({
        ownerId: targetUserId,
        name: template.name,
        description: template.description || undefined,
        categoryId: template.categoryId || undefined,
        widgets: sanitizedWidgets,
        sharedFromId: template.id,
        version: template.version, // Match parent version so hasUpdate = false
        isDraft: false,
        // Include mobile layout data if template uses independent mode
        mobileLayoutMode: template.mobileLayoutMode,
        mobileWidgets: template.mobileLayoutMode === 'independent' ? sanitizedMobileWidgets || undefined : undefined,
    });

    logger.info(`[Templates] Copy created: template=${template.id} copy=${userCopy.id} user=${targetUserId} stripped=${stripConfigs}`);

    // Share required integrations if requested
    let integrationsShared: string[] = [];
    if (shareIntegrations) {
        const { getRequiredIntegrations } = await import('../../../shared/widgetIntegrations');
        // Include both desktop and mobile widgets when checking for required integrations
        const desktopTypes = template.widgets.map(w => w.type);
        const mobileTypes = template.mobileLayoutMode === 'independent' && template.mobileWidgets
            ? template.mobileWidgets.map(w => w.type)
            : [];
        const allTypes = [...new Set([...desktopTypes, ...mobileTypes])];
        const requiredIntegrations = getRequiredIntegrations(allTypes);

        if (requiredIntegrations.length > 0) {
            const integrationSharesDb = await import('../integrationShares');
            const result = await integrationSharesDb.shareIntegrationsForUsers(
                requiredIntegrations,
                [targetUserId],
                sharedByAdminId
            );
            integrationsShared = result.shared;

            logger.info(`[Templates] Integrations shared: template=${template.id} user=${targetUserId} shared=[${result.shared.join(',')}]`);
        }
    }

    // Share specific integration instances configured per-widget
    // Extract integration IDs from widget.config:
    // - config.integrationId for single-integration widgets
    // - config.*IntegrationIds for multi-integration widgets (e.g., sonarrIntegrationIds, radarrIntegrationIds)
    const allWidgets = [
        ...template.widgets,
        ...(template.mobileLayoutMode === 'independent' && template.mobileWidgets ? template.mobileWidgets : [])
    ];

    const integrationInstancesToShare = new Set<string>();

    for (const widget of allWidgets) {
        const config = widget.config || {};

        // Single-integration widgets: config.integrationId
        if (config.integrationId && typeof config.integrationId === 'string' && config.integrationId !== '__none__') {
            integrationInstancesToShare.add(config.integrationId);
        }

        // Multi-integration widgets: config.*IntegrationIds (arrays)
        // Look for any key ending in 'IntegrationIds'
        for (const [key, value] of Object.entries(config)) {
            if (key.endsWith('IntegrationIds') && Array.isArray(value)) {
                for (const integrationId of value) {
                    if (integrationId && typeof integrationId === 'string' && integrationId !== '__none__') {
                        integrationInstancesToShare.add(integrationId);
                    }
                }
            }
        }
    }

    if (integrationInstancesToShare.size > 0) {
        const integrationSharesDb = await import('../integrationShares');
        const integrationInstancesDb = await import('../integrationInstances');

        for (const integrationInstanceId of integrationInstancesToShare) {
            try {
                // Look up the integration instance to get its type
                const instance = integrationInstancesDb.getInstanceById(integrationInstanceId);
                if (!instance) {
                    logger.warn(`[Templates] Integration instance not found: id=${integrationInstanceId}`);
                    continue;
                }

                await integrationSharesDb.shareIntegrationInstance(
                    integrationInstanceId,
                    instance.type, // integrationType from the instance
                    'user',
                    [targetUserId],
                    sharedByAdminId
                );
                if (!integrationsShared.includes(integrationInstanceId)) {
                    integrationsShared.push(integrationInstanceId);
                }
            } catch (shareError) {
                logger.debug(`[Templates] Instance share: id=${integrationInstanceId} user=${targetUserId} error="${(shareError as Error).message}"`);
            }
        }
        logger.info(`[Templates] Instances shared: template=${template.id} user=${targetUserId} instances=[${Array.from(integrationInstancesToShare).join(',')}]`);
    }

    // Always share widget types with the user (so they have access to the widgets)
    // This is independent of shareIntegrations - users need widget access regardless
    const desktopWidgetTypes = template.widgets.map(w => w.type);
    const mobileWidgetTypes = template.mobileLayoutMode === 'independent' && template.mobileWidgets
        ? template.mobileWidgets.map(w => w.type)
        : [];
    const allWidgetTypes = [...new Set([...desktopWidgetTypes, ...mobileWidgetTypes])];

    if (allWidgetTypes.length > 0) {
        const widgetSharesDb = await import('../widgetShares');
        for (const widgetType of allWidgetTypes) {
            try {
                await widgetSharesDb.shareWidgetType(widgetType, 'user', [targetUserId], sharedByAdminId);
            } catch (shareError) {
                // Ignore duplicate share errors (user may already have access)
                logger.debug(`[Templates] Widget share: type=${widgetType} user=${targetUserId} error="${(shareError as Error).message}"`);
            }
        }
        logger.info(`[Templates] Widget types shared: template=${template.id} user=${targetUserId} types=[${allWidgetTypes.join(',')}]`);
    }

    // Apply to dashboard if requested
    // IMPORTANT: Use userCopy (sanitized) instead of original template
    // This ensures sensitive configs (links, custom HTML) are stripped from dashboard widgets
    if (applyToDashboard && userCopy) {
        await applyTemplateToUser(userCopy, targetUserId, shouldCreateBackup);
    }

    // Broadcast SSE events to notify the target user of permission/integration changes
    // This enables real-time UI updates without requiring a page refresh
    if (integrationsShared.length > 0 || allWidgetTypes.length > 0) {
        invalidateUserSettings(targetUserId, 'permissions');  // Widget access permissions
        invalidateUserSettings(targetUserId, 'integrations'); // Integration access
        invalidateUserSettings(targetUserId, 'notifications'); // Notification settings may depend on integrations
        logger.debug(`[Templates] SSE broadcast: permissions/integrations invalidated for user=${targetUserId}`);
    }

    return {
        templateCopy: userCopy,
        integrationsShared,
        skipped: false
    };
}
