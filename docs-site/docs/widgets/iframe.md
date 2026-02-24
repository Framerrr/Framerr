---
title: iFrame
description: Embed any webpage directly in your dashboard.
---

# iFrame

Embeds an external webpage in a sandboxed iframe on your dashboard. Useful for displaying Grafana dashboards, network maps, or any other web-based tool.

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| URL | *(empty)* | The URL of the webpage to embed |
| Auto-Refresh | Off | Automatically reload the iframe at an interval. Options: **Off**, **30 seconds**, **1 minute**, **5 minutes**, **15 minutes**, **30 minutes**, **1 hour** |
| Allow Interaction | On | Enable mouse and keyboard interaction with the embedded page. When off, the iframe is non-interactive (click-through). |

:::caution X-Frame-Options
Some websites block being embedded in iframes via `X-Frame-Options` or `Content-Security-Policy` headers. If a page shows blank or an error, the target site may be blocking iframe embedding.
:::

