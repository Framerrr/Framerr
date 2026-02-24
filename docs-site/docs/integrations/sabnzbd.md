---
sidebar_position: 9
title: SABnzbd
description: Connect SABnzbd to Framerr for Usenet download monitoring.
---

# SABnzbd

SABnzbd is a free, open-source Usenet binary newsreader. Framerr connects to SABnzbd to display and manage Usenet downloads.

## Requirements

- SABnzbd running and accessible from the Framerr container
- An API key

## Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| **SABnzbd URL** | ✅ | URL to your SABnzbd web interface, e.g. `http://192.168.1.100:8080` |
| **API Key** | ✅ | Your SABnzbd API key (stored encrypted) |

### Default Port

SABnzbd uses port **8080** by default (may vary by installation method).

### Docker URL Example

```
http://sabnzbd:8080
```

## Finding Your API Key

1. Open SABnzbd
2. Go to **Config → General**
3. Find the **API Key** field
4. Copy the key

:::tip
SABnzbd has both an "API Key" (full access) and an "NZB Key" (limited). Use the **full API Key** for Framerr.
:::

## Available Widgets

### Downloads Widget

Unified download manager showing:
- **Download Management** — Pause, Resume, Remove, and manage downloads
- **Active NZB downloads** with progress, speed, and ETA
- **Download speed** in the stats bar
- **Download status** — downloading, paused, etc.

The Downloads widget works with both SABnzbd and qBittorrent.

**Widget options:**
- Stats bar: Show or Hide

## Troubleshooting

### Connection Test Fails

- Verify the URL is reachable from the Framerr container
- Ensure you're using the full API Key (not the NZB Key)
- Check that SABnzbd's API is not restricted to specific IP addresses

### No Downloads Showing

- The widget shows active queue items only
- Completed downloads are not displayed in the widget
