---
sidebar_position: 13
title: Framerr Monitor
description: Built-in service monitoring with customizable health checks — no external tools required.
---

# Framerr Monitor

Framerr Monitor is a **first-party, built-in** service monitoring integration. It provides customizable health checks for any URL or service without requiring external monitoring tools.

:::info
This is a built-in integration — no external server or API key is needed. Monitors are configured in the integration's instance settings.
:::

## Requirements

None — Framerr Monitor runs entirely within Framerr itself.

## Configuration


No configuration fields are required to add the integration. Simply add "Framerr Monitor" from the integrations page.

### Adding Monitors

After adding the integration, configure monitors in **Settings → Integrations → Service Settings → [Framerr Monitor]**:

1. Click **Add Monitor** to create a new monitor manually, or use **Import** to automatically create monitors from your configured integrations (e.g., Sonarr, Radarr, Plex)
2. Give the monitor a **name** and choose an **icon**
3. Select a **check type**:
   - **HTTP** — checks a URL and validates the response status code
   - **TCP** — checks if a host and port are reachable
   - **Ping** — checks if a host responds to ping
4. Enter the **URL** (for HTTP) or **Host/Port** (for TCP/Ping)
5. Optionally configure advanced settings:
   - **Check interval** — how often to check (default: 60 seconds)
   - **Timeout** — how long to wait for a response (default: 10 seconds)
   - **Retries before down** — consecutive failures before marking as down (default: 3)
   - **Degraded threshold** — response time above which the service is marked as degraded
   - **Expected status codes** — valid HTTP response codes (default: 200-299)
6. Optionally set up a **maintenance schedule** — scheduled windows where the monitor is paused and notifications are suppressed

Monitors can be reordered by dragging up or down the list.
## Available Widgets

### Service Status Widget

Displays monitored services with:
- **Up/Down/Degraded status** for each monitor
- **Response time** indicators
- **Service name** and health state
- **24-hour uptime history** — click any monitor to view its heartbeat history

You can bind multiple monitors to a single Framerr monitor instance, and one Framerr monitor to a single widget, allowing different widgets to track different sets of services.

## Notifications

Framerr Monitor supports **notifications** for:
- **Service Recovered** — when a down service comes back up
- **Service Down** — when a service stops responding
- **Service Degraded** — when response times exceed thresholds
- **Maintenance Started** — when a service enters maintenance mode
- **Maintenance Ended** — when maintenance mode is cleared

Configure notifications in **Settings → Integrations → Service Settings → Framerr Monitor Instance → Notifications**.


