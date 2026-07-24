import { BaseAdapter } from '../BaseAdapter';
import { PluginInstance, TestResult } from '../types';
import { extractAdapterErrorMessage } from '../errors';

export class AdGuardAdapter extends BaseAdapter {
    readonly testEndpoint = '/control/status';

    getAuthHeaders(instance: PluginInstance): Record<string, string> {
        const username = typeof instance.config.username === 'string' ? instance.config.username : '';
        const password = typeof instance.config.password === 'string' ? instance.config.password : '';
        if (username && password) {
            const encoded = Buffer.from(`${username}:${password}`, 'utf8').toString('base64');
            return { Authorization: `Basic ${encoded}` };
        }
        return {};
    }

    validateConfig(instance: PluginInstance): boolean {
        const hasUrl = typeof instance.config.url === 'string' && instance.config.url.length > 0;
        const hasUsername = typeof instance.config.username === 'string' && instance.config.username.length > 0;
        const hasPassword = typeof instance.config.password === 'string' && instance.config.password.length > 0;
        // Both credentials or neither (auth-disabled AdGuard Home)
        return hasUrl && hasUsername === hasPassword;
    }

    async testConnection(config: Record<string, unknown>): Promise<TestResult> {
        const hasUsername = typeof config.username === 'string' && config.username.length > 0;
        const hasPassword = typeof config.password === 'string' && config.password.length > 0;
        if (hasUsername !== hasPassword) {
            return {
                success: false,
                error: 'AdGuard Home requires both username and password, or leave both empty if authentication is disabled',
            };
        }

        try {
            return await super.testConnection(config);
        } catch (error) {
            return {
                success: false,
                error: extractAdapterErrorMessage(error),
            };
        }
    }
}
