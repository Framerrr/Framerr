/**
 * FormActionBar - Action bar for MonitorForm with add and import buttons
 * Extracted from MonitorForm.tsx during Phase 1.5.2 refactor
 */

import React from 'react';
import { Plus, Download, ChevronDown } from 'lucide-react';
import { Button } from '../../../shared/ui';
import { Popover } from '../../../shared/ui';
import { getIconComponent } from '../../../utils/iconUtils';

interface ConfiguredIntegration {
    id: string;
    name: string;
    icon: string;
    url: string;
    type: string;
}

interface FormActionBarProps {
    onAddMonitor: () => void;
    importDropdownOpen: boolean;
    onImportDropdownToggle: () => void;
    onImportDropdownClose: () => void;
    importTriggerRef: React.RefObject<HTMLButtonElement | null>;
    availableIntegrations: ConfiguredIntegration[];
    onImport: (integration: ConfiguredIntegration) => void;
}

const FormActionBar: React.FC<FormActionBarProps> = ({
    onAddMonitor,
    importDropdownOpen,
    onImportDropdownToggle,
    onImportDropdownClose,
    importTriggerRef,
    availableIntegrations,
    onImport,
}) => {
    const hasAvailableIntegrations = availableIntegrations.length > 0;

    return (
        <div className="flex items-center justify-between gap-3 flex-shrink-0">
            <Button
                onClick={onAddMonitor}
                icon={Plus}
                size="sm"
            >
                Add Monitor
            </Button>

            {/* Import from Integration Dropdown */}
            <div className="relative">
                <Popover open={importDropdownOpen} onOpenChange={(open) => !open && onImportDropdownClose()} closeOnScroll={false}>
                    <Popover.Trigger asChild>
                        <button
                            ref={importTriggerRef}
                            onClick={() => {
                                if (hasAvailableIntegrations) {
                                    onImportDropdownToggle();
                                }
                            }}
                            disabled={!hasAvailableIntegrations}
                            className={`
                                flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                                border border-theme transition-colors
                                ${!hasAvailableIntegrations
                                    ? 'bg-theme-tertiary text-theme-tertiary cursor-not-allowed'
                                    : 'bg-theme-secondary text-theme-primary hover:bg-theme-hover cursor-pointer'
                                }
                            `}
                        >
                            <Download size={16} />
                            Import from Integration
                            <ChevronDown size={16} className={`transition-transform ${importDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                    </Popover.Trigger>
                    <Popover.Content align="end" sideOffset={4} className="p-1 min-w-[256px]" maxWidth="320px">
                        <div
                            className="max-h-[320px] overflow-y-scroll overscroll-contain"
                        >
                            {availableIntegrations.map((integration) => {
                                const IconComponent = getIconComponent(integration.icon);
                                return (
                                    <button
                                        key={integration.id}
                                        onClick={() => {
                                            onImport(integration);
                                            onImportDropdownClose();
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-theme-hover rounded-lg transition-colors text-left cursor-pointer"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-theme-tertiary flex items-center justify-center">
                                            <IconComponent size={16} className="text-theme-secondary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-theme-primary truncate">
                                                {integration.name}
                                            </p>
                                            <p className="text-xs text-theme-tertiary truncate">
                                                {integration.url}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </Popover.Content>
                </Popover>
            </div>
        </div>
    );
};

export default FormActionBar;
