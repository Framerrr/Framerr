/**
 * IntegrationTypeCard - Expandable card for an integration type
 * 
 * Shows integration type header with count, expands to show list of instances
 * with Edit/Delete actions. Edit opens modal, Delete uses ConfirmButton.
 */

import React, { useState } from 'react';
import { LucideIcon, ChevronDown, Pencil } from 'lucide-react';
import { ConfirmButton } from '../../../shared/ui';

interface IntegrationInstance {
    id: string;
    type: string;
    displayName: string;
    config: Record<string, unknown>;
    enabled: boolean;
}

interface IntegrationTypeCardProps {
    type: string;
    name: string;
    description: string;
    icon: LucideIcon;
    instances: IntegrationInstance[];
    onEditInstance: (instanceId: string) => void;
    onDeleteInstance: (instanceId: string) => Promise<void>;
}

const IntegrationTypeCard: React.FC<IntegrationTypeCardProps> = ({
    name,
    description,
    icon: Icon,
    instances,
    onEditInstance,
    onDeleteInstance
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const instanceCount = instances.length;

    return (
        <div className="bg-theme-tertiary rounded-lg border border-theme shadow-sm overflow-hidden">
            {/* Header - Clickable to expand */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="
                    w-full p-4
                    hover:bg-theme-hover/50
                    transition-all duration-200
                    flex items-center gap-4
                    cursor-pointer group
                "
            >
                {/* Icon in accent box */}
                <div className="
                    p-3 bg-accent/20 rounded-lg flex-shrink-0
                    group-hover:bg-accent/30 transition-colors
                ">
                    <Icon size={24} className="text-accent" />
                </div>

                {/* Title + Description */}
                <div className="flex-1 min-w-0 text-left">
                    <h4 className="font-semibold text-theme-primary mb-0.5">{name}</h4>
                    <p className="text-sm text-theme-secondary truncate">{description}</p>
                </div>

                {/* Right side: Count + Chevron */}
                <div className="flex items-center gap-3 flex-shrink-0">
                    {instanceCount > 0 ? (
                        <span className="
                            px-2.5 py-1 rounded-full
                            text-xs font-semibold
                            bg-accent/20 text-accent border border-accent/30
                        ">
                            {instanceCount}
                        </span>
                    ) : (
                        <span className="
                            px-2 py-1 rounded-full
                            text-[10px] font-semibold uppercase tracking-wide
                            bg-theme-tertiary text-theme-secondary border border-theme
                        ">
                            Not Set Up
                        </span>
                    )}
                    <ChevronDown
                        size={20}
                        className={`text-theme-tertiary group-hover:text-accent transition-all duration-200 ${isExpanded ? 'rotate-180' : ''
                            }`}
                    />
                </div>
            </button>

            {/* Expanded Content - Instance List */}
            {isExpanded && (
                <div className="border-t border-theme bg-theme-secondary/30">
                    {instances.length === 0 ? (
                        <div className="p-4 text-center text-theme-secondary text-sm">
                            No instances configured. Use "Add Integration" to create one.
                        </div>
                    ) : (
                        <div>
                            {instances.map((instance, index) => (
                                <div
                                    key={instance.id}
                                    className={`flex items-center justify-between px-4 py-3 hover:bg-theme-hover/30 ${index > 0 ? 'border-t border-theme' : ''
                                        }`}
                                >
                                    {/* Instance Info */}
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-2 h-2 rounded-full ${instance.enabled
                                            ? 'bg-success'
                                            : 'bg-theme-tertiary'
                                            }`} />
                                        <span className="font-medium text-theme-primary truncate">
                                            {instance.displayName}
                                        </span>
                                        {Boolean(instance.config?.url) && (
                                            <span className="text-xs text-theme-secondary truncate hidden sm:block">
                                                {String(instance.config.url)}
                                            </span>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <button
                                            onClick={() => onEditInstance(instance.id)}
                                            className="p-2 text-theme-secondary hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
                                            title="Edit"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <ConfirmButton
                                            onConfirm={() => onDeleteInstance(instance.id)}
                                            size="sm"
                                            confirmMode="iconOnly"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default IntegrationTypeCard;

