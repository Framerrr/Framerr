---
sidebar_position: 4
title: Sonarr
description: Connect Sonarr to Framerr for TV show management, calendar, and library statistics.
---

# Sonarr

Sonarr is a PVR for Usenet and BitTorrent users that monitors and manages TV show downloads. Framerr connects to Sonarr for **TV calendar views**, **library statistics**, and **missing episode tracking**.

:::tip Works with Seerr
If [Seerr](/docs/integrations/overseerr) is also configured in Framerr and shares the same Sonarr server, real-time download progress will appear directly on Seerr request cards. No additional configuration is needed — Framerr links the two integrations automatically.
:::

## Requirements

- Sonarr v3 or v4 running and accessible from the Framerr container
- An API key

## Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| **Sonarr URL** | ✅ | Full URL to your Sonarr instance, e.g. `http://192.168.1.100:8989` |
| **API Key** | ✅ | Your Sonarr API key (stored encrypted) |

### Default Port

Sonarr uses port **8989** by default.

### Docker URL Example

```
http://sonarr:8989
```

## Finding Your API Key

1. Open Sonarr
2. Go to **Settings → General**
3. Under **Security**, find the **API Key** field
4. Copy the key

## Available Widgets

### Sonarr Widget

Dedicated Sonarr widget showing:
- **Library statistics** — total series, episodes, monitored items
- **Missing episodes** — episodes that are monitored but not yet downloaded

**View modes:** Auto, Stacked, Column

### Calendar Widget

Combined Sonarr + Radarr calendar showing upcoming and recent releases:
- **Month view** — traditional calendar grid
- **Agenda view** — chronological list of upcoming episodes
- **Both** — side-by-side month and agenda

The Calendar widget supports **multi-integration**, allowing you to attach multiple Sonarr and Radarr instances to a single calendar.

## Notifications

Sonarr can send **[webhook notifications](../features/notifications)** to Framerr for events like episode grabs, imports, and health issues.

### Setting Up Notifications

1. In Framerr, go to **Settings → Integrations → Service Settings → [Sonarr]** → **Notifications**
2. Click **Generate Webhook URL** — this creates a unique URL for this Sonarr instance
3. Copy the generated webhook URL
4. In Sonarr, go to **Settings → Connect** → add a new **Webhook** connection
5. Paste the Framerr webhook URL into the **URL** field
6. Under **Notification Triggers**, select **all events** — you can filter which events you want to receive from within Framerr

:::tip
Select all triggers in Sonarr and manage your notification preferences in Framerr instead. Framerr lets you configure which events to receive and route notifications separately for admins and regular users.
:::

## Troubleshooting

### Connection Test Fails

- Verify the URL is reachable from the Framerr container
- Ensure the API key is correct (copy it fresh from Sonarr settings)
- Check that Sonarr is not using a URL base (e.g., `/sonarr`) — if it is, include it in the URL

