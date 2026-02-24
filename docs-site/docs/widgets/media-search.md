---
title: Media Search
description: Search across your media libraries and request new content through Seerr.
---

# Media Search

A search bar widget that searches across your media libraries (Plex, Jellyfin, Emby) and optionally shows content available to request via Seerr. Results from Seerr appear in a "Request" section in the search results.

## Supported Integrations

| Integration | Role |
|-------------|------|
| [Plex](/docs/integrations/plex) | Library search source |
| [Jellyfin](/docs/integrations/jellyfin) | Library search source |
| [Emby](/docs/integrations/emby) | Library search source |
| [Seerr](/docs/integrations/overseerr) | Request source (titles not in library) |

:::info Multi-Integration
This is a multi-integration widget. You can assign multiple library Seerr instances simultaneously. Results are grouped by source.
:::

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| Focus Mode | On | Spotlight-style search takeover — dims the dashboard and centers the search results |
| Hide Available Titles | On | Hides titles already available in Seerr results (only shows requestable content) |


