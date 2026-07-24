---
sidebar_position: 12
title: AdGuard Home
description: Connect AdGuard Home to Framerr for DNS filtering stats.
---

# AdGuard Home

AdGuard Home is a network-wide DNS filter and ad blocker. Framerr polls it for the shared **[DNS Stats](/docs/widgets/dns-stats)** widget.

## Requirements

- AdGuard Home running and accessible from the Framerr container
- Username/password if your AdGuard Home instance requires authentication

## Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| **AdGuard Home URL** | ✅ | Full URL to your AdGuard Home instance, e.g. `http://192.168.1.5:3000` |
| **Username** | ❌ | Admin username (leave blank if auth is disabled) |
| **Password** | ❌ | Admin password (stored encrypted; leave blank if auth is disabled) |

### Default Port

AdGuard Home commonly uses port **3000** for its web UI / API.

### Docker URL Example

```
http://adguardhome:3000
```

## Available Widgets

### DNS Stats Widget

Shared with [Pi-hole](/docs/integrations/pihole). Shows:
- Query totals, blocked count / %, average latency
- Activity sparkline
- Top blocked domains, clients, queried domains, and upstreams
- Protection toggle (when supported by the connected instance)

## Troubleshooting

### Connection Test Fails

- Verify the URL is reachable from the Framerr container
- If auth is enabled, confirm username and password
- Include any reverse-proxy path prefix in the URL if you use one
