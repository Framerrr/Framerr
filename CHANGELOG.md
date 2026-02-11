# Changelog

All notable changes to Framerr will be documented in this file.

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
