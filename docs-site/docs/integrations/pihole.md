---
sidebar_position: 13
title: Pi-hole
description: Connect Pi-hole to Framerr for DNS filtering stats.
---

# Pi-hole

Pi-hole is a network-wide ad blocker. Framerr polls Pi-hole **v5 and v6** for the shared **[DNS Stats](/docs/widgets/dns-stats)** widget.

## Requirements

- Pi-hole running and accessible from the Framerr container
- Your Pi-hole web password (or app password, depending on version)

## Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| **Pi-hole URL** | ✅ | Full URL to your Pi-hole instance, e.g. `http://192.168.1.5` |
| **Password** | ✅ | Pi-hole web password (stored encrypted) |

### Docker URL Example

```
http://pihole
```

## Available Widgets

### DNS Stats Widget

Shared with [AdGuard Home](/docs/integrations/adguard). Shows:
- Query totals, blocked count / %, average latency
- Activity sparkline
- Top blocked domains, clients, queried domains, and upstreams
- Protection toggle (when supported by the connected instance)

## Troubleshooting

### Connection Test Fails

- Verify the URL is reachable from the Framerr container
- Confirm the password matches Pi-hole's web UI / API password
- For Pi-hole v6, use the password configured for the new API
- Include any reverse-proxy path prefix in the URL if you use one
