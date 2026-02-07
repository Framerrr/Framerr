/**
 * Integration Types
 * 
 * Shared types for integration routes.
 */
import { Request } from 'express';

export interface AuthenticatedUser {
    id: string;
    username: string;
    group: string;
}

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

export interface TestResult {
    success: boolean;
    message?: string;
    version?: string;
    error?: string;
}

export interface IntegrationConfig {
    url?: string;
    apiKey?: string;
    token?: string;
    username?: string;
    password?: string;
    [key: string]: unknown;
}
