/**
 * StandardIntegrationForm - Generic form for simple integrations
 * Renders enable toggle, optional info message, and fields based on schema.
 * 
 * P4 Phase 4.4: Supports server-side schema (serverSchema) with fallback to client definitions.
 * 
 * Field types supported: text, password, url, number, checkbox, select
 * 
 * Used for: Sonarr, Radarr, qBittorrent, Overseerr, Glances, Custom System Status, etc.
 * NOT used for: Plex, Monitor, Uptime Kuma (these have dedicated form components)
 */

import React, { ChangeEvent } from 'react';
import { Info, Code, Lightbulb } from 'lucide-react';
import { Input } from '../../components/common/Input';
import { ServiceDefinition, IntegrationConfig } from './definitions';
import { ConfigSchema, ConfigField } from '../../api/endpoints/integrations';

interface StandardIntegrationFormProps {
    service: ServiceDefinition;
    config: IntegrationConfig;
    onFieldChange: (field: string, value: string) => void;
    serverSchema?: ConfigSchema; // From API - takes precedence if provided
}

const StandardIntegrationForm: React.FC<StandardIntegrationFormProps> = ({
    service,
    config,
    onFieldChange,
    serverSchema
}) => {
    // Use server schema if provided, fallback to client definition
    const infoMessage = serverSchema?.infoMessage ?? service.infoMessage;
    const fields: ConfigField[] = serverSchema?.fields ?? (service.fields?.map(f => ({
        key: f.key,
        type: f.type as ConfigField['type'],
        label: f.label,
        placeholder: f.placeholder,
        hint: f.hint,
        required: f.required,
    })) ?? []);

    // Icon mapping for info message
    const InfoIcon = infoMessage?.icon === 'code' ? Code
        : infoMessage?.icon === 'lightbulb' ? Lightbulb
            : Info;

    // Render a single field based on type
    const renderField = (field: ConfigField) => {
        const value = config[field.key] ?? field.default;

        switch (field.type) {
            case 'checkbox':
                return (
                    <div key={field.key} className="flex items-center justify-between p-3 bg-theme-tertiary/30 rounded-xl">
                        <div>
                            <p className="text-sm font-medium text-theme-primary">{field.label}</p>
                            {field.hint && <p className="text-xs text-theme-tertiary">{field.hint}</p>}
                        </div>
                        <button
                            onClick={() => onFieldChange(field.key, value ? '' : 'true')}
                            className={`
                                relative w-12 h-6 rounded-full transition-colors
                                ${value ? 'bg-success' : 'bg-theme-tertiary'}
                            `}
                        >
                            <div className={`
                                absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform
                                ${value ? 'translate-x-6' : 'translate-x-0'}
                            `} />
                        </button>
                    </div>
                );

            case 'select':
                return (
                    <div key={field.key} className="space-y-1">
                        <label className="block text-sm font-medium text-theme-primary">
                            {field.label}
                        </label>
                        <select
                            value={(value as string) || ''}
                            onChange={(e) => onFieldChange(field.key, e.target.value)}
                            className="w-full px-3 py-2 bg-theme-secondary border border-theme rounded-lg 
                                       text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent"
                        >
                            <option value="">Select...</option>
                            {field.options?.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                        {field.hint && <p className="text-xs text-theme-tertiary">{field.hint}</p>}
                    </div>
                );

            case 'number':
                return (
                    <Input
                        key={field.key}
                        label={field.label}
                        type="number"
                        value={(value as string) || ''}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            onFieldChange(field.key, e.target.value)
                        }
                        placeholder={field.placeholder}
                    />
                );

            case 'url':
            case 'text':
            default:
                return (
                    <Input
                        key={field.key}
                        label={field.label}
                        type={field.type === 'url' ? 'text' : field.type}
                        redacted={field.sensitive}
                        value={(value as string) || ''}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            onFieldChange(field.key, e.target.value)
                        }
                        placeholder={field.placeholder}
                    />
                );
        }
    };

    return (
        <div className="space-y-2">
            {/* Info Message Banner (optional) */}
            {infoMessage && (
                <div className="bg-info/10 rounded-xl p-4">
                    <div className="flex gap-3">
                        <InfoIcon className="text-info flex-shrink-0 mt-0.5" size={18} />
                        <div className="text-sm">
                            <p className="font-medium text-theme-primary mb-1">{infoMessage.title}</p>
                            <p className="text-theme-secondary whitespace-pre-line">{infoMessage.content}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Configuration Fields - rendered from schema */}
            {fields.map(field => renderField(field))}
        </div>
    );
};

export default StandardIntegrationForm;
