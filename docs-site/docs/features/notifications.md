---
sidebar_position: 5
---

# Notifications

Framerr delivers real-time notifications from your media stack — media requests, download events, health issues, and service status changes. 

## Delivery Channels

| Channel | When Used | Requirement |
|---------|-----------|-------------|
| **In-app** | Browser tab is open | Always active |
| **Web Push** | Browser is closed or backgrounded | HTTPS + browser permission |
| **Sound** | Configurable per-user | Enabled in notification settings |

## Notification Center

The notification center opens from the mail icon in the sidebar. It displays notifications grouped by source:

- **Overseerr** — media requests, approvals, availability
- **Sonarr** — episode grabs, downloads, health issues
- **Radarr** — movie grabs, downloads, health issues
- **System** — service monitoring alerts, maintenance events

Each notification shows a timestamp, icon, and type badge (success, error, warning, info). You can:

- **Filter** by All, Unread, or type
- **Mark as read** individually or all at once
- **Dismiss** individual notifications
- **Clear all** to remove everything

## Event Types

### Webhook Events (Overseerr, Sonarr, Radarr)

These integrations send events to Framerr via webhooks. Framerr generates a unique webhook URL for each integration instance — you paste this URL into the integration's notification settings.

**[Overseerr](../integrations/overseerr#notifications)** (10 events): Request Pending, Auto-Approved, Approved, Declined, Media Available, Processing Failed, Issue Reported, Issue Comment, Issue Resolved, Issue Reopened

**[Sonarr](../integrations/sonarr#notifications)** (13 events): Episode Grabbed, Downloaded, Upgraded, Import Complete, Series Added/Deleted, Health Issue/Restored, Application Update, Manual Interaction Required, and more

**[Radarr](../integrations/radarr#notifications)** (13 events): Movie Grabbed, Downloaded, Upgraded, Import Complete, Movie Added/Deleted, Health Issue/Restored, Application Update, Manual Interaction Required, and more

### Service Monitoring Events (Local)

Service monitoring notifications are generated automatically by Framerr when monitored services change state. No webhook setup is needed.

**Service Monitoring** (5 events): Service Down, Service Recovered, Service Degraded, Maintenance Started, Maintenance Ended

:::tip Batching
When multiple services change status at the same time (e.g., a server going offline), Framerr batches notifications within a 10-second window to prevent spam. Instead of 5 separate "Service Down" alerts, you'll see one notification: "5 Services Down."
:::

## Admin vs. User

Notifications use a two-tier model. Admins control which events exist and how webhooks are configured. Regular users choose which of the allowed events they want to receive.

### Admin View

Admins see the full notification settings panel in **Settings → Notifications**:

- **General**: master enable/disable, notification sound, receive unmatched alerts, test notification button
- **Web Push**: global enable/disable for Web Push across all users, device management
- **Integrations**: per-integration webhook configuration including:
  - Webhook URL generation and token management
  - Webhook base URL override (useful when Framerr is behind a reverse proxy)
  - **Admin Receives** — which events the admin gets notifications for
  - **Users Can Receive** — which events are *available* to non-admin users (this does not subscribe users automatically — it sets the menu of options users can choose from)

### User View

Non-admin users see a simplified settings panel:

- **General**: enable/disable notifications, sound toggle, test button
- **Integrations**: for each integration shared with them that has user-visible events, users can toggle individual events on or off

Users only see integrations that have been [shared](sharing) with them **and** have at least one user-eligible event configured by the admin.

:::info Receive Unmatched
Admins have a "Receive Unmatched Alerts" toggle that delivers webhook events that can't be matched to a specific user. This is useful for catching events that fall through the cracks — for example, an Overseerr request from a user not mapped in Framerr.
:::

## Web Push

Web Push sends notifications to your device even when Framerr isn't open. It uses the standard [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) with VAPID keys (generated automatically on first use).

### Requirements

- **HTTPS** — Web Push requires a secure context. If you access Framerr over HTTP, Web Push will not be available.
- **Browser support** — most modern browsers support Web Push (Chrome, Firefox, Edge, Safari 16+)

### Setup

1. Admin enables Web Push globally in **Settings → Notifications → Web Push**
2. Each user subscribes their device(s) from the same section
3. Framerr asks for browser notification permission
4. Once subscribed, notifications arrive even when the tab is closed

### Multi-Device

Each user can subscribe multiple devices. The settings panel shows all registered devices with the option to remove individual subscriptions. When Framerr sends a Web Push notification, it skips devices that currently have an active SSE connection (to avoid duplicates).

## Webhook Setup

For Sonarr, Radarr, and Overseerr, you need to configure webhooks in the source application.

### Steps

1. Go to **Settings → Integrations → Service Settings → [Sonarr/Radarr/Overseerr]** in Framerr
2. Select the desired integration (e.g., "Sonarr-4k")
3. Enable webhook notifications with the toggle
4. Click **Generate Webhook Token**
5. Copy the webhook URL
6. In Sonarr/Radarr/Overseerr, add a new **Webhook** notification connection
7. Paste the Framerr webhook URL
8. Enable **all notification types** in the source application — Framerr handles filtering on its end based on your event selections

:::caution Base URL
If the auto-detected webhook URL is not accessible by the source application, use the "Webhook Base URL" in **Settings → Notifications** field to set the correct externally-reachable URL (e.g., `https://framerr.yourdomain.com`). The source application must be able to reach this URL.
:::

