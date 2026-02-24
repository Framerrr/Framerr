---
sidebar_position: 1
---

# Tabs & Tab Groups

Tabs let you embed external web pages (like Sonarr, Radarr, or any URL) directly inside Framerr as iframe panels. They appear in the sidebar alongside your dashboard and can be organized into collapsible groups.

## Creating a Tab

1. Go to **Settings → Tabs**
2. Click **Add Tab**
3. Fill in the fields:

| Field | Description |
|-------|-------------|
| **Tab Name** | Display name shown in the sidebar (a URL slug is auto-generated) |
| **URL** | Full URL to embed (e.g., `http://192.168.1.50:8989` for Sonarr) |
| **Icon** | Choose from the built-in icon library |
| **Group** | Optionally assign the tab to a group |
| **Enabled** | Toggle to show or hide the tab without deleting it |

4. Click **Create Tab**

The new tab appears in the sidebar. Clicking it loads the URL in an embedded iframe within Framerr.

## Tab Groups

Groups let you organize related tabs into collapsible sections in the sidebar. For example, you might group all your *arr apps under a "Media Management" group.

### Creating a Group

1. Go to **Settings → Tab Groups**
2. Click **Add Group**
3. Enter a group name
4. Click **Create**

### Assigning Tabs to Groups

When creating or editing a tab, use the **Group** dropdown to assign it. Tabs without a group appear at the top level of the sidebar.

### Reordering

Both tabs and groups support **drag-to-reorder** in their respective settings pages.

## iFrame Authentication

If the services behind your tabs are protected by a reverse proxy with authentication (Authentik, Authelia, etc.), some browsers may not carry the auth session into the iframe — particularly **Safari and iOS**.

For these cases, Framerr provides an **iFrame Auth** feature (OAuth flow) that establishes the proxy session before loading the iframe. See [iFrame Auth](../configuration/multi-user#4-iframe-auth-oauth-for-embedded-tabs) for setup instructions.

## Per-User Tabs

Each user manages their own set of tabs and groups. Tabs are **not shared** between users — every user can create their own sidebar tabs independently.

## Mobile

On mobile devices, tabs appear in the **bottom tab bar** for quick access alongside the dashboard.

:::tip
Disable any tabs you're not actively using instead of deleting them — this keeps the URL and settings saved for when you want them again.
:::
