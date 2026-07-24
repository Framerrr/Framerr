---
sidebar_position: 5
title: Lidarr
description: Connect Lidarr to Framerr for music library management, calendar, and missing album tracking.
---

# Lidarr

Lidarr is a music collection manager for Usenet and BitTorrent users. Framerr connects to Lidarr for **album release calendar views**, **library statistics**, and **missing album tracking**.

## Requirements

- Lidarr running and accessible from the Framerr container
- An API key

## Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| **Lidarr URL** | ✅ | Full URL to your Lidarr instance, e.g. `http://192.168.1.100:8686` |
| **API Key** | ✅ | Your Lidarr API key (stored encrypted) |

### Default Port

Lidarr uses port **8686** by default.

### Docker URL Example

```
http://lidarr:8686
```

## Finding Your API Key

1. Open Lidarr
2. Go to **Settings → General**
3. Under **Security**, find the **API Key** field
4. Copy the key

## Available Widgets

### Lidarr Widget

Dedicated Lidarr widget showing:
- **Summary statistics** — upcoming releases, missing albums, cutoff upgrades, active downloads
- **Upcoming albums** — carousel of upcoming releases
- **Needs Attention** — missing and cutoff-unmet albums

**View modes:** Auto, Stacked, Column

### Calendar Widget

The combined Calendar widget can include Lidarr as a third source alongside Sonarr and Radarr:
- Album release events appear on the shared calendar
- Use the **Music** filter chip to isolate Lidarr events

## Notifications

Lidarr can send **[webhook notifications](../features/notifications)** to Framerr for events like album grabs, imports, and health issues.

### Setting Up Notifications

1. In Framerr, go to **Settings → Integrations → Service Settings → [Lidarr]** → **Notifications**
2. Click **Generate Webhook URL** — this creates a unique URL for this Lidarr instance
3. Copy the generated webhook URL
4. In Lidarr, go to **Settings → Connect** → add a new **Webhook** connection
5. Paste the Framerr webhook URL into the **URL** field
6. Under **Notification Triggers**, select **all events** — filter preferences in Framerr

## Troubleshooting

### Connection Test Fails

- Verify the URL is reachable from the Framerr container
- Ensure the API key is correct (copy it fresh from Lidarr settings)
- Check that Lidarr is not using a URL base — if it is, include it in the URL
