import type { CreateLinkData } from '../../../api/endpoints/linkLibrary';
import type { Link, LinkFormData } from '../types';
import { dashboardHash } from './linkNavigation';

export function buildLinkFromFormData(
    formData: LinkFormData,
    existingId?: string,
    options?: { forceIconCaptionVisible?: boolean },
): Link {
    const isDashboardLink =
        formData.type === 'link' &&
        formData.linkTarget === 'dashboard' &&
        !!formData.dashboardId;

    return {
        id: existingId || `link-${Date.now()}`,
        title: formData.title,
        icon: formData.icon,
        size: formData.size,
        type: formData.type,
        linkTarget: formData.type === 'link' ? formData.linkTarget : undefined,
        dashboardId: isDashboardLink ? formData.dashboardId : undefined,
        url: isDashboardLink
            ? dashboardHash(formData.dashboardId)
            : formData.url,
        openInNewTab:
            formData.type === 'link' && !isDashboardLink
                ? formData.openInNewTab
                : undefined,
        style: {
            showIcon: options?.forceIconCaptionVisible ? true : formData.showIcon,
            showText: options?.forceIconCaptionVisible ? true : formData.showText,
        },
        action: formData.type === 'action' ? formData.action : undefined,
    };
}

export function buildLibraryPayloadFromFormData(formData: LinkFormData): CreateLinkData {
    const isDashboardLink =
        formData.type === 'link' &&
        formData.linkTarget === 'dashboard' &&
        !!formData.dashboardId;

    return {
        title: formData.title,
        icon: formData.icon,
        size: formData.size,
        type: formData.type,
        url: isDashboardLink
            ? dashboardHash(formData.dashboardId)
            : formData.url,
        style: {
            showIcon: formData.showIcon,
            showText: formData.showText,
            ...(formData.type === 'link' && !isDashboardLink
                ? { openInNewTab: formData.openInNewTab }
                : {}),
            ...(isDashboardLink
                ? { linkTarget: 'dashboard', dashboardId: formData.dashboardId }
                : {}),
        },
        action: formData.type === 'action' ? formData.action : undefined,
    };
}
