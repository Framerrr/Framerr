# Changelog

All notable changes to Framerr will be documented in this file.

## [0.1.8] - 2026-03-01

### Added
- Glances multi-disk support — disk selection UI works for any integration providing disk data, not just Unraid
- Library sync retry with exponential backoff on timeout/network errors
- Library sync partial failure reporting — shows which specific library view failed and why
- Calendar air time display on TV show popovers and agenda cards

### Fixed
- Glances temperature showing NVMe sensor instead of CPU
- Library sync timeout on large libraries. Libraries are now indexed and synced per page, with timeout per page
- Library sync stale error message persisting after successful sync
- System Status config dropping newly toggled metrics not in saved order
- System Status drag-drop re-ordering not persisting
- System Status disk bar height and label text shrinking on narrow cards
- Sidebar not applying solid-ui mode on startup
- Calendar timezone grouping bug for non-UTC users
- Link Grid icon sizing — scales relative to circle diameter instead of fixed sizes
- Overseerr request button disabled when selecting first server (ID=0)
- Overseerr 429 rate limit — auto-retry with backoff
- Setup wizard softlock — account creation now comes before theme selection
- Setup wizard double animation from auth redirect race condition

### Changed
- Startup logs now show user count for easier troubleshooting
- Better error messages on database initialization failure

---

## [0.1.7] - 2026-02-24

### Added
- The wiki is live — docs site with integration guides, feature walkthroughs, and configuration reference
- Jellyfin/Emby: Connect with username + password instead of manual API key
- Library sync progress — real-time status messages during fetch phase
- Tabs: "Open in new tab" toggle per tab
- Global API rate limiting (300 req/min per user, stricter 10/min for auth)
- Path sanitization on file upload and backup restore routes
- Beta channel badge in sidebar for `:develop` Docker images

### Changed
- Overseerr/Jellyseerr renamed to "Seerr" in all user-facing labels
- Default notification events now defined per-integration in schema plugins

### Fixed
- Jellyfin/Emby library sync now scans all library views — fixes movies not indexed in custom library types (#3)
- Library sync progress count now matches final indexed total
- Media Search Request modal server select blocked by dialog portal conflict (#7)
- Templates: Category filter clear button was missing
- Request modal server picker logic — no longer shows for single-instance setups
- Calendar today highlight uses local timezone instead of UTC (#6)
- Docker PUID/PGID defaults changed from 99/100 to 0/0 — works on all platforms out of the box
- Tabs enable/disable — disabled tabs are now properly disabled
- Weather auto-mode no longer re-prompts for location after 7 days

---

## [0.1.6] - 2026-02-22

### Added
- ARM64 (aarch64) Docker image support — Raspberry Pi, Apple Silicon, UGREEN NAS, and other ARM devices
- Link Library for Link Widget — save links to reuse across widgets
- User role management — admins can now promote and demote users (previously locked to role assigned at creation)
- Media recommendations for Jellyfin and Emby (previously Plex-only)
- Recommendation cards show source badge when multiple media server types are bound
- Preset integrations pre-populate service settings on first install (disabled, ready to configure)

### Changed
- Pollers now throw on errors instead of failing silently — feeds into retry and backoff pipeline
- Config errors (missing URL/API key) detected immediately without burning retries
- Standardized integration error backoff: 15s → 30s → 60s → 120s → 180s cap (was per-poller, max 5 min)
- Calendar widget "Agenda" view now defaults to "Today". Can now filter out "Past Events"
- Search overlay and info modal stay open when clicking "Open in Plex/Jellyfin/Emby"
- Walkthrough skip now shows a confirmation dialog
- Uptime tick tooltips show status label (Up/Down/Degraded/Maintenance/Unavailable)

### Fixed
- Proxy auth placeholder was a valid password hash
- Docker entrypoint UID/GID collision handling
- Favicon upload failing in Docker
- Sensitive field masking — clearing fields now works correctly
- Walkthrough event and modal interaction issues during onboarding flow
- New integration forms showing false "unsaved changes" on close
- qBittorrent widget not working with auth enabled — added cookie-based session auth
- Widget fallback persistence
- Mobile-only widgets returning 404 on config save
- Stale data flash when widget falls back to a different integration
- Auth errors (401/403) skip retries and show "Authentication Failed" with settings link
- Jellyfin metadata fetch and library sync fixes
- Image caching extended to Jellyfin/Emby large posters
- `librarySyncEnabled` not persisting across reloads
- Double border on input focus
- Sync Now badge showing stale "Complete" after re-opening modal

---

## [0.1.5] - 2026-02-20

### Added
- Page height lock during widget resize — prevents page from collapsing when resizing widgets near the bottom of the grid

### Changed
- UI refinements

### Fixed
- Metric history not working after backup restore
- Template builder widget filtering
- Template revert returning 404
- Integration settings discard not resetting form state

---

## [0.1.4] - 2026-02-18

### Added
- Tautulli integration — connect Tautulli instances with a new widget showing server stats and top items
- Overseerr media requesting — bind Overseerr to the Media Search widget to search and request media
- Overseerr widget — per-user request filtering based on Overseerr permissions
- Iframe widget — embed any web page on your dashboard
- Search bar recommendations from Plex library
- Walkthrough — guided onboarding for new users
- Pull-to-refresh on mobile dashboard
- Password reset CLI tool (`framerr reset-password`) with force-change-on-login
- System Status widget — configurable history logging for system status integrations

### Changed
- Sonarr widget redesigned — upcoming carousel, missing episodes with pagination, episode detail modal with search and grab
- Radarr widget redesigned — upcoming movies carousel, missing list, movie detail modal with search and grab
- Calendar widget redesigned — month grid, agenda list, and split view modes
- qBittorrent widget redesigned — torrent detail modal, pause/resume/delete actions, global playback control
- Hover effects disabled on touch devices to prevent phantom highlights on iOS
- Widget resize handles repositioned for easier interaction on mobile
- Link Grid reordering moved to config modal to prevent conflicts with dashboard widget drag

### Fixed
- Widget content flashing on drop when dragging from Add Widget catalog
- Edit bar detaching from top of page on scroll
- Template builder drag and drop overlays mispositioned and incorrectly scaled
- First edit on mobile would sometimes propagate to desktop
- Mobile empty state not showing when mobile layout has no widgets
- Reduced memory usage for long-running tabs

---

## [0.1.3] - 2026-02-11

### Fixed
- TMDB poster images failing behind reverse proxy auth (Authentik) — images now load via authenticated fetch with automatic TMDB CDN fallback

---

## [0.1.2] - 2026-02-11

### Added
- Custom HTML widget — fully functional with HTML and CSS config fields
- Sidebar auto-hide with two-zone edge hover (peek → snap-open)
- Square cells option in Settings (experimental)
- Media Stream and Overseerr view modes (Auto/Card/List)
- Dashboard header with personalized greetings — time-of-day and season aware, 9 configurable tones

### Changed
- Weather widget defaults to City Search mode instead of geolocation
- Weather and clock widgets rewritten with more responsive container queries
- Media Stream/Overseerr: Carousel cards redesigned with full-bleed poster backgrounds
- Widget design enhancements

### Fixed
- Non-admin users unable to access global widgets (Clock, Weather, Custom HTML, Link Grid)
- First external widget drop flashing blank before animating
- Add-widget modal not closing on off-grid drops
- Touch drag stall when tapping config button
- Template import freezing the application
- Integration deletion not cleaning up widget configs or library cache
- Media search empty popover rendering on focus
- Splash screen double-loading and theme race conditions

## [0.1.1] - 2026-02-08

### Fixed
- Reduced migration log noise on fresh installs (per-migration logs now debug-level)
- Background services now start after restoring from backup during setup
- Uptime Kuma integration form now renders credential fields correctly
- Library cache settings now show integration display names instead of raw IDs
- Monitor delete button uses in-app confirmation dialog instead of browser prompt
- Fixed dashboard scroll lock on iOS after navigating back from iframe tabs

## [0.1.0] - 2026-02-07

Initial public release.

### Added
- Widget-based dashboard with drag-and-drop grid layout
- Integration support for Plex, Sonarr, Radarr, Overseerr, qBittorrent, and more
- System monitoring via Framerr Monitor
- Dashboard templates with import/export and cross-user sharing
- Mobile-responsive layout with independent mobile editing
- Notification system with webhook support
- Docker deployment with automated setup
