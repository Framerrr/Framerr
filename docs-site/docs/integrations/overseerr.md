---
sidebar_position: 6
title: Seerr
description: Connect Seerr to Framerr for media request management and discovery.
---

# Seerr

Seerr (formerly Overseerr/Jellyseerr) is a media request management and discovery tool for Plex, Jellyfin, and Emby. It lets users browse and request media that gets automatically sent to Sonarr/Radarr for download.

:::info
In Framerr, the integration is currently labeled "Overseerr" — this will be renamed to "Seerr" in a future update. The setup is identical regardless of which you use or what name appears in the UI.
:::

## Requirements

- Seerr running and accessible from the Framerr container
- An API key

## Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| **URL** | ✅ | Full URL to your Seerr instance, e.g. `http://192.168.1.5:5055` |
| **API Key** | ✅ | Your Seerr API key (stored encrypted) |
| **See All Requests** | ❌ | Toggle to show all requests regardless of user permissions (default: on) |

### Default Port

Seerr uses port **5055** by default.

### Docker URL Example

```
http://seerr:5055
```

## Finding Your API Key

1. Open Seerr and sign in
2. Go to **Settings → General**
3. Copy the **API Key** shown at the top of the page

## Configuration Options

### See All Requests

**When on (default):** The widget shows all requests from all users — everyone sees the same list. Framerr admins always see all requests regardless of this setting.

**When off:** Framerr respects Seerr's per-user permissions. Each user sees only the requests they're allowed to see based on their linked Seerr account:

1. **Automatic linking** — Framerr tries to match users by their Plex account (if both Framerr and Seerr use Plex sign-in)
2. **Manual linking** — If automatic matching doesn't work, users can link their Seerr account manually on the **Linked Accounts** page
3. **Not linked** — If no account is linked, the user will see a prompt to link their account

:::note
Account linking is only required when "See All Requests" is turned off. With the default setting, no linking is needed.
:::

## Available Widgets

### Seerr Widget

Displays media requests with:
- Request title and poster art
- Request status (pending, approved, available)
- Requester information

**View modes:** Auto, Carousel (horizontal poster scroll), Stacked (vertical backdrop list)

:::tip Works with Sonarr & Radarr
If [Sonarr](/docs/integrations/sonarr) or [Radarr](/docs/integrations/radarr) are also configured in Framerr and share the same servers as Seerr, real-time download progress will appear directly on request cards. No additional configuration is needed — Framerr links the integrations automatically.
:::

### Media Search

When attached to the Media Search widget, Seerr results appear in a "Request" section, allowing users to discover and request media that isn't in your library yet.

## Notifications

Seerr can send **[webhook notifications](../features/notifications)** to Framerr for events like new requests, approvals, and availability updates.

### Setting Up Notifications

1. In Framerr, go to **Settings → Integrations → Service Settings → [Overseerr]** → **Notifications**
2. Click **Generate Webhook URL** — this creates a unique URL for this Seerr instance
3. Copy the generated webhook URL
4. In Seerr, go to **Settings → Notifications** → add a new **Webhook** notification agent
5. Paste the Framerr webhook URL into the **Webhook URL** field
6. Enable all notification types — you can filter which events you want to receive from within Framerr

:::tip
Enable all notification types in Seerr and manage your notification preferences in Framerr instead. Framerr lets you configure which events to receive and route notifications separately for admins and regular users.
:::

## Troubleshooting

### Connection Test Fails

- Verify the URL is reachable from the Framerr container
- Ensure the API key is correct
- Check that the correct port (5055) is accessible

### No Requests Showing

- Verify there are active requests in Seerr
- Try toggling "See All Requests" on
- Check that the API key has admin-level access
