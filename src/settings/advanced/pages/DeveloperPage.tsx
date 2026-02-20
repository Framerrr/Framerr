import React from 'react';
import { Code, BookOpen, Webhook } from 'lucide-react';
import { SettingsPage, SettingsSection, EmptyState } from '../../../shared/ui/settings';

/**
 * DeveloperPage - Developer tools, API docs, webhooks
 */
export const DeveloperPage = (): React.JSX.Element => {
    return (
        <SettingsPage
            title="Developer"
            description="Access API documentation, webhooks, and technical tools"
        >
            <SettingsSection title="Developer Features" icon={Code}>
                <EmptyState
                    icon={Code}
                    message="Developer features coming soon"
                />
                <div className="flex gap-3 justify-center flex-wrap">
                    <div className="flex items-center gap-2 px-4 py-2 bg-theme-tertiary rounded-lg text-theme-secondary">
                        <BookOpen size={16} />
                        <span className="text-sm">API Docs</span>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-theme-tertiary rounded-lg text-theme-secondary">
                        <Webhook size={16} />
                        <span className="text-sm">Webhooks</span>
                    </div>
                </div>
            </SettingsSection>
        </SettingsPage>
    );
};

export default DeveloperPage;
