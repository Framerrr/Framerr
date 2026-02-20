# Changelog

All notable changes to Framerr will be documented in this file.

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
