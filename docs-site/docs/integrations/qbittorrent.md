---
sidebar_position: 8
title: qBittorrent
description: Connect qBittorrent to Framerr for download monitoring and management.
---

# qBittorrent

qBittorrent is an open-source BitTorrent client. Framerr connects to qBittorrent to display and manage torrents.

## Requirements

- qBittorrent with Web UI enabled, accessible from the Framerr container
- Web UI credentials (if authentication is enabled)

## Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| **qBittorrent URL** | ✅ | URL to your qBittorrent Web UI, e.g. `http://192.168.1.100:8080` |
| **Username** | ❌ | Web UI username (leave empty if auth is disabled) |
| **Password** | ❌ | Web UI password (stored encrypted, leave empty if auth is disabled) |

### Default Port

qBittorrent Web UI uses port **8080** by default.

### Docker URL Example

```
http://qbittorrent:8080
```

## Enabling the Web UI

1. Open qBittorrent
2. Go to **Tools → Options → Web UI**
3. Check **Enable the Web User Interface**
4. Set a username and password (recommended)
5. Note the port number

:::tip
If running qBittorrent in Docker, the Web UI is typically enabled by default. Check your container's documentation for the default credentials.
:::

## Available Widgets

### Downloads Widget

Unified download manager showing:
-**Torrent Management** — Pause, Resume, Remove, and manage torrents
- **Active torrents** with progress, speed, and ETA
- **Upload/download speeds** in the stats bar
- **Torrent status** — downloading, seeding, paused, etc.

The Downloads widget works with both qBittorrent and SABnzbd.

**Widget options:**
- Stats bar: Show or Hide

## Troubleshooting

### Connection Test Fails

- Verify the Web UI URL is correct and accessible
- If authentication is enabled, ensure credentials are correct
- Check that the Web UI is enabled in qBittorrent settings
- Some Docker images use a randomized default password — check container logs

