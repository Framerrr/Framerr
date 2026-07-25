/**
 * Template Application Helpers
 *
 * Functions for applying templates to user dashboards and sharing templates.
 */

import logger from '../../utils/logger';
import { invalidateUserSettings } from '../../utils/invalidateUserSettings';
import { createTemplate, getUserCopyOfTemplate } from './crud';
import {
    regenerateWidgetIds,
    saveDashboardWidgets,
    createDashboard,
    listDashboards,
    getDashboard,
} from '../dashboards';
import type {
    TemplateWidget,
    DashboardTemplate,
    ShareTemplateOptions,
    ShareTemplateResult,
} from '../templates.types';

export class DashboardNotFoundError extends Error {
    constructor() {
        super('Dashboard not found');
        this.name = 'DashboardNotFoundError';
    }
}

export type ApplyTemplateTarget =
    | { dashboardId: string }
    | { createNew: true; name?: string };

/**
 * Apply a template to a user's dashboard (explicit target).
 */
export async function applyTemplateToUser(
    template: DashboardTemplate,
    userId: string,
    target: ApplyTemplateTarget
): Promise<{ widgets: TemplateWidget[]; dashboardId: string }> {
    const dashboardWidgets = regenerateWidgetIds(template.widgets) as TemplateWidget[];
    const dashboardMobileWidgets =
        template.mobileLayoutMode === 'independent' && template.mobileWidgets
            ? (regenerateWidgetIds(template.mobileWidgets) as TemplateWidget[])
            : undefined;

    if ('createNew' in target && target.createNew) {
        const created = createDashboard(userId, {
            name: target.name ?? template.name,
            widgets: dashboardWidgets,
            mobileLayoutMode: template.mobileLayoutMode || 'linked',
            mobileWidgets: dashboardMobileWidgets,
        });

        logger.info(
            `[Templates] Applied (new dashboard): template=${template.id} user=${userId} dashboard=${created.id} widgets=${dashboardWidgets.length}`
        );

        return { widgets: dashboardWidgets, dashboardId: created.id };
    }

    if (!('dashboardId' in target) || typeof target.dashboardId !== 'string') {
        throw new Error('Invalid apply target');
    }

    const saved = saveDashboardWidgets(userId, target.dashboardId, {
        widgets: dashboardWidgets,
        mobileLayoutMode: template.mobileLayoutMode || 'linked',
        mobileWidgets: dashboardMobileWidgets,
    });

    if (!saved) {
        throw new DashboardNotFoundError();
    }

    logger.info(
        `[Templates] Applied: template=${template.id} user=${userId} dashboard=${target.dashboardId} widgets=${dashboardWidgets.length}`
    );

    return { widgets: dashboardWidgets, dashboardId: target.dashboardId };
}

// ============================================================================
// Template Sharing Helper
// ============================================================================

/**
 * Share a template with a user - creates user's copy with sanitized config.
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
    } = options;

    const existingCopy = await getUserCopyOfTemplate(targetUserId, template.id);
    if (existingCopy) {
        logger.debug(`[Templates] User already has copy: user=${targetUserId} template=${template.id}`);
        return {
            templateCopy: existingCopy,
            integrationsShared: [],
            skipped: true,
            reason: 'User already has a copy of this template',
        };
    }

    let sanitizedWidgets = template.widgets;
    let sanitizedMobileWidgets = template.mobileWidgets;
    if (stripConfigs) {
        const { stripSensitiveConfig, hasSensitiveConfig } = await import('../../../shared/widgetIntegrations');

        sanitizedWidgets = template.widgets.map(widget => {
            if (hasSensitiveConfig(widget.type) && widget.shareSensitiveConfig !== true) {
                return {
                    ...widget,
                    config: stripSensitiveConfig(widget.type, widget.config || {}),
                };
            }
            return widget;
        });

        if (template.mobileWidgets && template.mobileWidgets.length > 0) {
            sanitizedMobileWidgets = template.mobileWidgets.map(widget => {
                if (hasSensitiveConfig(widget.type) && widget.shareSensitiveConfig !== true) {
                    return {
                        ...widget,
                        config: stripSensitiveConfig(widget.type, widget.config || {}),
                    };
                }
                return widget;
            });
        }
    }

    const userCopy = await createTemplate({
        ownerId: targetUserId,
        name: template.name,
        description: template.description || undefined,
        categoryId: template.categoryId || undefined,
        widgets: sanitizedWidgets,
        sharedFromId: template.id,
        version: template.version,
        isDraft: false,
        mobileLayoutMode: template.mobileLayoutMode,
        mobileWidgets:
            template.mobileLayoutMode === 'independent'
                ? sanitizedMobileWidgets || undefined
                : undefined,
    });

    logger.info(
        `[Templates] Copy created: template=${template.id} copy=${userCopy.id} user=${targetUserId} stripped=${stripConfigs}`
    );

    let integrationsShared: string[] = [];
    if (shareIntegrations) {
        const { getRequiredIntegrations } = await import('../../../shared/widgetIntegrations');
        const desktopTypes = template.widgets.map(w => w.type);
        const mobileTypes =
            template.mobileLayoutMode === 'independent' && template.mobileWidgets
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

            logger.info(
                `[Templates] Integrations shared: template=${template.id} user=${targetUserId} shared=[${result.shared.join(',')}]`
            );
        }
    }

    const allWidgets = [
        ...template.widgets,
        ...(template.mobileLayoutMode === 'independent' && template.mobileWidgets
            ? template.mobileWidgets
            : []),
    ];

    const integrationInstancesToShare = new Set<string>();

    for (const widget of allWidgets) {
        const config = widget.config || {};

        if (
            config.integrationId &&
            typeof config.integrationId === 'string' &&
            config.integrationId !== '__none__'
        ) {
            integrationInstancesToShare.add(config.integrationId);
        }

        for (const [key, value] of Object.entries(config)) {
            if (key.endsWith('IntegrationIds') && Array.isArray(value)) {
                for (const integrationId of value) {
                    if (
                        integrationId &&
                        typeof integrationId === 'string' &&
                        integrationId !== '__none__'
                    ) {
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
                const instance = integrationInstancesDb.getInstanceById(integrationInstanceId);
                if (!instance) {
                    logger.warn(
                        `[Templates] Integration instance not found: id=${integrationInstanceId}`
                    );
                    continue;
                }

                await integrationSharesDb.shareIntegrationInstance(
                    integrationInstanceId,
                    instance.type,
                    'user',
                    [targetUserId],
                    sharedByAdminId
                );
                if (!integrationsShared.includes(integrationInstanceId)) {
                    integrationsShared.push(integrationInstanceId);
                }
            } catch (shareError) {
                logger.debug(
                    `[Templates] Instance share: id=${integrationInstanceId} user=${targetUserId} error="${(shareError as Error).message}"`
                );
            }
        }
        logger.info(
            `[Templates] Instances shared: template=${template.id} user=${targetUserId} instances=[${Array.from(integrationInstancesToShare).join(',')}]`
        );
    }

    const desktopWidgetTypes = template.widgets.map(w => w.type);
    const mobileWidgetTypes =
        template.mobileLayoutMode === 'independent' && template.mobileWidgets
            ? template.mobileWidgets.map(w => w.type)
            : [];
    const allWidgetTypes = [...new Set([...desktopWidgetTypes, ...mobileWidgetTypes])];

    if (allWidgetTypes.length > 0) {
        const widgetSharesDb = await import('../widgetShares');
        for (const widgetType of allWidgetTypes) {
            try {
                await widgetSharesDb.shareWidgetType(
                    widgetType,
                    'user',
                    [targetUserId],
                    sharedByAdminId
                );
            } catch (shareError) {
                logger.debug(
                    `[Templates] Widget share: type=${widgetType} user=${targetUserId} error="${(shareError as Error).message}"`
                );
            }
        }
        logger.info(
            `[Templates] Widget types shared: template=${template.id} user=${targetUserId} types=[${allWidgetTypes.join(',')}]`
        );
    }

    if (applyToDashboard && userCopy) {
        const { homeDashboardId } = listDashboards(targetUserId);
        const home = getDashboard(targetUserId, homeDashboardId);
        const target: ApplyTemplateTarget = home
            ? { dashboardId: homeDashboardId }
            : { createNew: true, name: 'Dashboard' };

        await applyTemplateToUser(userCopy, targetUserId, target);
    }

    if (integrationsShared.length > 0 || allWidgetTypes.length > 0) {
        invalidateUserSettings(targetUserId, 'permissions');
        invalidateUserSettings(targetUserId, 'integrations');
        invalidateUserSettings(targetUserId, 'notifications');
        logger.debug(
            `[Templates] SSE broadcast: permissions/integrations invalidated for user=${targetUserId}`
        );
    }

    return {
        templateCopy: userCopy,
        integrationsShared,
        skipped: false,
    };
}
