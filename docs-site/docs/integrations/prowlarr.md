---
sidebar_position: 8
title: Prowlarr
description: Connect Prowlarr to Framerr for indexer health, apps, and recent activity.
---

# Prowlarr

Prowlarr is an indexer manager for torrents and Usenet. Framerr connects to Prowlarr for **indexer health**, **connected apps**, and **recent activity**.

## Requirements

- Prowlarr running and accessible from the Framerr container
- An API key

## Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| **Prowlarr URL** | ✅ | Full URL to your Prowlarr instance, e.g. `http://192.168.1.100:9696` |
| **API Key** | ✅ | Your Prowlarr API key (stored encrypted) |

### Default Port

Prowlarr uses port **9696** by default.

### Docker URL Example

```
http://prowlarr:9696
```

## Finding Your API Key

1. Open Prowlarr
2. Go to **Settings → General**
3. Under **Security**, find the **API Key** field
4. Copy the key

## Available Widgets

### Prowlarr Widget

Dedicated widget showing:
- **Summary** — total, enabled, healthy, failing, and disabled indexer counts
- **Applications** — apps connected to Prowlarr
- **Indexers** — per-indexer health, protocol, and failure details
- **Recent Activity** — recent grabs / history
- **Messages** — health messages when present

## Troubleshooting

### Connection Test Fails

- Verify the URL is reachable from the Framerr container
- Ensure the API key is correct (copy it fresh from Prowlarr settings)
- Check that Prowlarr is not using a URL base — if it is, include it in the URL
