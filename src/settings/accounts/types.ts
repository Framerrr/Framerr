/**
 * Types for the accounts feature
 * Handles linked external service accounts (Plex, Overseerr, etc.)
 */

// Database-stored linked account data
export interface LinkedAccountData {
    linked: boolean;
    externalId?: string;
    externalUsername?: string | null;
    externalEmail?: string | null;
    linkedAt?: number;
    metadata?: {
        thumb?: string;
        linkedVia?: string;
        plexUsername?: string;
    };
}

// Collection of linked accounts from database
export interface DbLinkedAccounts {
    plex?: LinkedAccountData;
    overseerr?: LinkedAccountData;
    [key: string]: unknown;
}

// API Response types
export interface PlexSSOStatusResponse {
    enabled: boolean;
}

export interface PlexPinResponse {
    pinId: number;
    authUrl: string;
}

export interface PlexTokenResponse {
    authToken?: string;
    user?: {
        id: string;
        username: string;
    };
}



// Hook return type
export interface UseAccountSettingsReturn {
    // State
    loading: boolean;
    dbLinkedAccounts: DbLinkedAccounts;
    plexSSOEnabled: boolean;

    hasOverseerrAccess: boolean;
    isAdmin: boolean;

    // Plex state
    plexLinking: boolean;
    plexUnlinking: boolean;

    // Overseerr state
    overseerrModalOpen: boolean;
    overseerrUsername: string;
    overseerrPassword: string;
    overseerrLinking: boolean;
    overseerrUnlinking: boolean;
    overseerrError: string;

    // Plex handlers
    handleConnectPlex: () => Promise<void>;
    handleDisconnectPlex: () => Promise<void>;

    // Overseerr handlers
    handleOpenOverseerrModal: () => void;
    handleCloseOverseerrModal: () => void;
    handleLinkOverseerr: (e: React.FormEvent) => Promise<void>;
    handleDisconnectOverseerr: () => Promise<void>;
    setOverseerrUsername: (value: string) => void;
    setOverseerrPassword: (value: string) => void;
}
