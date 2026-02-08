# Changelog

All notable changes to Framerr will be documented in this file.

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
