---
sidebar_position: 11
title: Uptime Kuma
description: Connect Uptime Kuma to Framerr for service uptime monitoring.
---

# Uptime Kuma

Uptime Kuma is a self-hosted uptime monitoring tool. Framerr connects to Uptime Kuma to display **service status** and **uptime information** on your dashboard.

## Requirements

- Uptime Kuma running and accessible from the Framerr container
- An API key (requires the /metrics endpoint to be enabled)

## Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| **Uptime Kuma URL** | ✅ | Full URL to your Uptime Kuma instance, e.g. `http://192.168.1.5:3001` |
| **API Key** | ✅ | Your Uptime Kuma API key (stored encrypted) |

### Default Port

Uptime Kuma uses port **3001** by default.

### Docker URL Example

```
http://uptime-kuma:3001
```

## Setting Up the API Key

1. Open Uptime Kuma
2. Go to **Settings → API Keys**
3. Generate a new API key
4. Copy the key

## Available Widgets

### Service Status Widget

Displays your monitored services with:
- **Up/Down status** for each monitor
- **Response time** indicators
- **Service name** and current state

The Service Status widget also works with the **Framerr Monitor** integration.

## Notifications

Uptime Kuma supports **notifications** for:
- **Service Recovered** — when a down service comes back up
- **Service Down** — when a service goes down
- **Service Degraded** — when response times are elevated

Configure notifications in **Settings → Integrations → Notifications** within Framerr.

## Troubleshooting

### Connection Test Fails

- Verify the URL is reachable from the Framerr container
- Ensure the API key is valid

### No Monitors Showing

- Verify you have monitors configured in Uptime Kuma
- Ensure the API key has access to the monitors
