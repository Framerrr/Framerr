/**
 * Iframe Widget
 *
 * Renders a sandboxed iframe embedding an external URL.
 * Supports optional auto-refresh and scroll control.
 */

import React, { useEffect, useRef } from 'react';
import { Globe, AlertTriangle } from 'lucide-react';
import type { IframeWidgetProps, IframeConfig } from './types';
import './styles.css';

const IframeWidget = ({ widget, previewMode = false }: IframeWidgetProps): React.JSX.Element => {
    const config = widget.config as IframeConfig | undefined;
    const { url = '', refreshInterval = '0', allowInteraction = true } = config || {};
    const refreshMs = Number(refreshInterval) * 1000;

    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Auto-refresh by reassigning src (reloads page without remounting iframe)
    useEffect(() => {
        if (refreshMs <= 0 || !url) return;
        const timer = setInterval(() => {
            if (iframeRef.current) {
                iframeRef.current.src = url;
            }
        }, refreshMs);
        return () => clearInterval(timer);
    }, [refreshMs, url]);

    // Preview mode
    if (previewMode) {
        return (
            <div className="iframe-placeholder">
                <Globe size={20} className="text-theme-tertiary" />
                <span className="text-sm text-theme-tertiary">Iframe</span>
            </div>
        );
    }

    // No URL configured
    if (!url) {
        return (
            <div className="iframe-placeholder">
                <Globe size={24} className="text-theme-tertiary" />
                <span className="text-sm text-theme-tertiary">No URL configured</span>
            </div>
        );
    }

    return (
        <div className={`iframe-container${!allowInteraction ? ' iframe-no-interact' : ''}`}>
            <iframe
                ref={iframeRef}
                src={url}
                title={widget.config?.headerTitle as string || 'Embedded page'}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                className="iframe-embed"
                loading="lazy"
            />
        </div>
    );
};

export default IframeWidget;
