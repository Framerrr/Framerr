---
sidebar_position: 5
title: Radarr
description: Connect Radarr to Framerr for movie management, calendar, and library statistics.
---

# Radarr

Radarr is a movie collection manager for Usenet and BitTorrent users. Framerr connects to Radarr for **movie calendar views**, **library statistics**, and **missing movie tracking**.

:::tip Works with Seerr
If [Seerr](/docs/integrations/overseerr) is also configured in Framerr and shares the same Radarr server, real-time download progress will appear directly on Seerr request cards. No additional configuration is needed — Framerr links the two integrations automatically.
:::

## Requirements

- Radarr v3 or later running and accessible from the Framerr container
- An API key

## Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| **Radarr URL** | ✅ | Full URL to your Radarr instance, e.g. `http://192.168.1.100:7878` |
| **API Key** | ✅ | Your Radarr API key (stored encrypted) |

### Default Port

Radarr uses port **7878** by default.

### Docker URL Example

```
http://radarr:7878
```

## Finding Your API Key

1. Open Radarr
2. Go to **Settings → General**
3. Under **Security**, find the **API Key** field
4. Copy the key

## Available Widgets

### Radarr Widget

Dedicated Radarr widget showing:
- **Library statistics** — total movies, monitored, unmonitored
- **Missing movies** — movies that are monitored but not yet downloaded

**View modes:** Auto, Stacked, Column

### Calendar Widget

Combined Sonarr + Radarr calendar showing upcoming and recent releases. The Calendar widget supports **multi-integration**, allowing multiple Sonarr and Radarr instances on a single calendar.

## Notifications

Radarr can send **[webhook notifications](../features/notifications)** to Framerr for events like movie grabs, imports, and health issues.

### Setting Up Notifications

1. In Framerr, go to **Settings → Integrations → Service Settings → [Radarr]** → **Notifications**
2. Click **Generate Webhook URL** — this creates a unique URL for this Radarr instance
3. Copy the generated webhook URL
4. In Radarr, go to **Settings → Connect** → add a new **Webhook** connection
5. Paste the Framerr webhook URL into the **URL** field
6. Under **Notification Triggers**, select **all events** — you can filter which events you want to receive from within Framerr

:::tip
Select all triggers in Radarr and manage your notification preferences in Framerr instead. Framerr lets you configure which events to receive and route notifications separately for admins and regular users.
:::

## Troubleshooting

### Connection Test Fails

- Verify the URL is reachable from the Framerr container
- Ensure the API key is correct
- Check for a URL base (e.g., `/radarr`) and include it in the URL if configured

### No Movies in Widget

- Verify Radarr has monitored movies
- Check that the API key has read permissions
