---
sidebar_position: 1
title: Plex
description: Connect Plex Media Server to Framerr for real-time streaming activity and library search.
---

# Plex

Plex is a media server that organizes and streams your personal media collection. Framerr connects to Plex to display **real-time streaming activity** and enable **library search**.

## Requirements

- Plex Media Server running and accessible from the Framerr container
- A Plex account (for the Connect to Plex button) or a manual authentication token

## Setup

### Connect to Plex (Recommended)

The easiest way to set up Plex is the **Connect to Plex** button at the top of the integration form. This opens the official Plex OAuth flow — sign in with your Plex account and Framerr will automatically import your **server URL**, **token**, and **server list**.

After connecting, select the Plex server you want to use from the **Plex Server** dropdown.

### Manual Setup

If you prefer not to use OAuth, you can fill in the fields manually:

## Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| **Plex URL** | ✅ | Full URL to your Plex server, e.g. `http://192.168.1.100:32400` |
| **Token** | ✅ | Your Plex authentication token (stored encrypted) |
| **Plex Server** | ✅ | Select which Plex server to connect to (populated after connecting or entering a valid token) |
| **Library Sync** | ✅* | Syncs your Plex library to Framerr — **required** for the [Media Search](/docs/widgets/media-search) widget |

:::info
**Library Sync** must be enabled if you want to use the Media Search widget. Framerr searches a local index of your library — it does not query Plex directly.
:::

### Default Port

Plex uses port **32400** by default.

### Docker URL Example

If running Plex in Docker on the same network as Framerr:

```
http://plex:32400
```

:::tip Plex on Host Networking?
Plex commonly runs with `network_mode: host` for DLNA and remote access. Containers on host networking aren't on the Docker bridge network, so other containers can't reach them by name. Use your **host machine's LAN IP** instead:
```
http://192.168.1.100:32400
```
:::

## Finding Your Plex Token

If you're setting up manually and need your token:

1. Open the Plex Web App and sign in
2. Browse to any media item and click **Get Info** (or **⋯ → Get Info**)
3. Click **View XML** at the bottom
4. In the URL that opens, look for `X-Plex-Token=` — the value after it is your token

:::tip
You can also find it in the Plex preferences XML file:
- **Windows:** `%LOCALAPPDATA%\Plex Media Server\Preferences.xml`
- **Linux:** `/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Preferences.xml`
- **Docker:** Inside the container at the path above, or check your mounted config volume
:::

## Available Widgets

### Media Stream

Displays currently active Plex streaming sessions with:
- Media title, year, and type (movie/episode)
- Currently playing user
- Stream quality and progress
- Transcode vs. direct play indicator

**View modes:** Auto, Carousel (horizontal scroll), Stacked (vertical list)

The widget can be configured to **hide when nothing is playing**.

### Media Search

Search across your Plex library with instant results. When combined with Seerr, results appear in a "Request" section for easy requesting.

## Real-time Updates

Plex uses a **WebSocket connection** for real-time updates. Streaming sessions appear and update instantly without polling delays.

## Troubleshooting

### Connection Test Fails

- Verify the URL is reachable from the Framerr container (not `localhost` if using Docker)
- Ensure the token is correct — try accessing `http://your-plex-url:32400/identity?X-Plex-Token=YOUR_TOKEN` in a browser
- Check that no firewall is blocking port 32400

### Widget Shows "No Streams"

- This is normal when nobody is actively streaming
- Enable "Hide when empty" in widget settings to auto-hide the widget when idle
