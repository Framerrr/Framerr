/**
 * Template Types
 * 
 * Shared types for template routes.
 */
import { Request } from 'express';

export interface AuthenticatedUser {
    id: string;
    username: string;
    group: string;
}

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };
