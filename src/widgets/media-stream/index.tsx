/**
 * Media Stream Widget
 *
 * Displays active streaming sessions from Plex, Jellyfin, or Emby.
 *
 * Phase 4: Refactored from Plex-only to support all media servers.
 */

// Widget component - MediaStreamWidget (PlexWidget kept as alias for backward compatibility)
export { MediaStreamWidget, MediaStreamWidget as PlexWidget } from './MediaStreamWidget';
export { default } from './MediaStreamWidget';

// Export MediaSession type from adapters
export type { MediaSession, IntegrationType } from './adapters';

// Legacy type exports for backward compatibility
export type { PlexWidgetProps, PlexSessionData } from './types';
