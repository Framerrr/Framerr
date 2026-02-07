/**
 * Custom HTML Widget
 * 
 * Renders user-defined HTML and CSS content.
 */

import React from 'react';
import { Code } from 'lucide-react';
import { CustomHTMLWidgetProps, CustomHTMLConfig } from './types';

const CustomHTMLWidget = ({ widget, previewMode = false }: CustomHTMLWidgetProps): React.JSX.Element => {
    const config = widget.config as CustomHTMLConfig | undefined;
    const { htmlContent = '', cssContent = '' } = config || {};

    // Preview mode: show static placeholder
    if (previewMode) {
        return (
            <div className="flex items-center justify-center h-full text-center">
                <Code size={20} className="text-theme-tertiary mr-2" />
                <span className="text-sm text-theme-tertiary">Custom HTML</span>
            </div>
        );
    }

    if (!htmlContent) {
        return (
            <div className="flex items-center justify-center h-full text-center p-4">
                <p className="text-sm text-theme-tertiary">No custom content configured</p>
            </div>
        );
    }

    return (
        <div className="custom-html-widget h-full overflow-auto">
            {cssContent && <style>{cssContent}</style>}
            <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
        </div>
    );
};

export default CustomHTMLWidget;
