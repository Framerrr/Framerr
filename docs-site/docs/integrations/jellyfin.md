---
sidebar_position: 2
title: Jellyfin
description: Connect Jellyfin to Framerr for real-time streaming activity and library search.
---

# Jellyfin

Jellyfin is a free, open-source media server. Framerr connects to Jellyfin to display **real-time streaming activity** and enable **library search**.

## Requirements

- Jellyfin server running and accessible from the Framerr container
- A Jellyfin **admin** account

## Setup

Enter your **Jellyfin URL**, then provide your **username** and **password** and click **Connect**. Framerr will authenticate with Jellyfin and automatically configure the API key. You can change the API key later if needed.

## Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| **Jellyfin URL** | ✅ | Full URL to your Jellyfin server, e.g. `http://192.168.1.100:8096` |
| **Username** | ✅ | Your Jellyfin username (admin recommended) |
| **Password** | ✅ | Your Jellyfin password (leave empty if no password is set) |
| **Web Interface URL** | ❌ | Optional URL for "Open in Jellyfin" deep links (if different from the server URL) |
| **Library Sync** | ✅* | Syncs your Jellyfin library to Framerr — **required** for the [Media Search](/docs/widgets/media-search) widget |

:::info
**Library Sync** must be enabled if you want to use the Media Search widget. Framerr searches a local index of your library — it does not query Jellyfin directly.
:::

### Default Port

Jellyfin uses port **8096** by default (HTTP) or **8920** for HTTPS.

### Docker URL Example

If running Jellyfin in Docker on the same network as Framerr:

```
http://jellyfin:8096
```

## Available Widgets

### Media Stream

Displays currently active Jellyfin streaming sessions with:
- Media title, year, and type (movie/episode)
- Currently playing user
- Stream quality and progress
- Transcode vs. direct play indicator

**View modes:** Auto, Carousel (horizontal scroll), Stacked (vertical list)

The widget can be configured to **hide when nothing is playing**.

### Media Search

Search across your Jellyfin library with instant results. When combined with Seerr, results appear in a "Request" section for easy requesting.

## Real-time Updates

Jellyfin uses a **WebSocket connection** for real-time session updates.

## Troubleshooting

### Connection Fails

- Verify the URL is reachable from the Framerr container (not `localhost` if using Docker)
- Double-check the username and password are correct
- Ensure no firewall is blocking port 8096

### Widget Shows "No Streams"

- This is normal when nobody is actively streaming
- Enable "Hide when empty" in widget settings to auto-hide the widget when idle
