---
sidebar_position: 2
---

# Metric History

Metric History records CPU, memory, and temperature data from your system status integrations over time. Once enabled, each metric on a System Status widget becomes clickable and shows an interactive history graph.

## Enabling Metric History

Metric History is an experimental feature and must be enabled globally before any data is recorded.

1. Go to **Settings → Advanced → Experimental**
2. Toggle **Metric History Recording** on

Once enabled, Framerr begins recording metrics for all system status integrations automatically. This can be toggled off for individual integrations in their respective configuration forms. 

## Viewing History Graphs

After enabling Metric History:

1. Navigate to any **System Status** widget bound to an integration with metric history enabled
2. Click on a metric bar (CPU, Memory, or Temperature)
3. A popover opens showing the historical graph

The graph includes:

- **Time range selector** — switch between 1h, 6h, 1d, 3d, 7d, and 30d views (available ranges depend on how much data has been recorded)
- **Hover tooltips** — show exact values at any point in time
- **Min/max bands** — shaded regions showing the range of values within each aggregation window
- **Data source badge** — indicates whether data is coming from local recording or an external source

## Per-Integration Configuration

Each system status integration can be configured individually. Open the integration in **Settings → Integrations → Service Settings → [Integration Name]**, then scroll to the **Metric History** section.

### Source Mode

Controls where history data comes from:

| Mode | Behavior |
|------|----------|
| **Auto** (default) | Uses the integration's built-in history API if available, otherwise records locally |
| **Internal** | Always records locally, ignoring any external history API |
| **External** | Only uses the integration's built-in history API (no data if unavailable) |
| **Off** | Disables metric history for this integration entirely |

**Auto** is recommended for most setups. Framerr probes each integration on startup and every 6 hours to detect whether it supports an external history API.

### Retention

How long to keep recorded data before it expires. Adjustable from **1 to 30 days** (default: 3 days). Expired data is cleaned up automatically every hour.

:::note
Setting a longer retention period increases database size. For a single integration recording 3 metrics, expect roughly **1–2 MB per day** of retained data at the default settings.
:::

## Global Defaults

Default values for source mode and retention are applied whenever a new integration is added. You can change these defaults in **Settings → Background Jobs → Defaults** under the Metric History heading.

Changes to defaults only affect new integrations — existing integrations keep their current settings.

## Disabling Metric History

To stop recording:

1. Go to **Settings → Advanced → Experimental**
2. Toggle **Metric History Recording** off
3. Confirm in the dialog

Disabling stops all new recording but **preserves existing data**. Old data continues to expire naturally based on each integration's retention setting. You can re-enable at any time and recording resumes.

To disable for a single integration without turning off the global feature, set that integration's source mode to **Off**.
