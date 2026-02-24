---
sidebar_position: 7
title: Tautulli
description: Connect Tautulli to Framerr for Plex library statistics and analytics.
---

# Tautulli

Tautulli is a monitoring and tracking tool for Plex Media Server. Framerr connects to Tautulli to display **library statistics** and **viewing analytics**.

## Requirements

- Tautulli running and accessible from the Framerr container
- An API key

## Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| **Tautulli URL** | ✅ | Full URL to your Tautulli instance, e.g. `http://192.168.1.5:8181` |
| **API Key** | ✅ | Your Tautulli API key (stored encrypted) |

### Default Port

Tautulli uses port **8181** by default.

### Docker URL Example

```
http://tautulli:8181
```

## Finding Your API Key

1. Open Tautulli
2. Go to **Settings → Web Interface**
3. Find the **API Key** field
4. Copy the key

## Available Widgets

### Tautulli Widget

Displays Plex library statistics and analytics:
- **Most watched** media with play counts
- **Library breakdown** by media type
- **Recent added** items

**Widget options:**
- Items to show: 5, 10, 15, or 20
- Stats bar: Show or Hide

## Troubleshooting

### Connection Test Fails

- Verify the URL is reachable from the Framerr container
- Ensure the API key is correct
- Check that Tautulli's API is enabled in its settings

### No Statistics Showing

- Tautulli needs time to collect data — if it's newly installed, give it a few days
- Verify Tautulli is properly connected to your Plex server
