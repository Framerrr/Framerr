---
sidebar_position: 12
title: Unraid
description: Connect Unraid to Framerr for server monitoring via the built-in GraphQL API.
---

# Unraid

Unraid is an operating system for personal and small business use. Framerr connects to Unraid's **built-in GraphQL API** (available in Unraid 7.2+) to display **system metrics** on your dashboard.

:::warning
This integration requires **Unraid 7.2 or later**. Earlier versions do not include the GraphQL API that Framerr uses.
:::

## Requirements

- Unraid 7.2+ with API access enabled
- An API key with at least "Viewer" role

## Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| **Unraid URL** | ✅ | Your Unraid server address, e.g. `http://tower.local` |
| **API Key** | ✅ | Unraid API key (stored encrypted) |

### Docker URL Example

If Framerr runs on your Unraid server:

```
http://tower.local
```

Or use the server's IP address directly.

## Generating an API Key

1. Open the Unraid web UI
2. Go to **Settings → Management Access → API Keys**
3. Create a new API key with the **Viewer** role (read-only is sufficient)
4. Copy the generated key

:::tip
Use the **Viewer** role for the API key. Framerr only needs read access to monitor your system.
:::

## Available Widgets

### System Status Widget

Displays Unraid system metrics:
- **CPU usage** — percentage utilization
- **Memory usage** — used/total with percentage
- **Temperature** — CPU/system temperature
- **Uptime** — server uptime
- **Disk usage** — per-disk or disk-aggregated usage
- **Network** — upload and download throughput

**Widget options:**
- Disk Display: Collapsed (disk-aggregated) or Individual (per-disk)

The System Status widget also works with **Glances** and **Custom System Status** integrations.

## Troubleshooting

### Connection Test Fails

- Verify you are running **Unraid 7.2 or later**
- Ensure the API is enabled in Unraid settings
- Check that the API key has at least "Viewer" permissions
- Verify the URL is reachable from the Framerr container

### No Metrics Showing

- Some metrics may not be available depending on your Unraid setup
- Temperature monitoring may require IPMI or specific hardware support
