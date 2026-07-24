---
title: Calendar
description: Upcoming TV, movie, and music releases from Sonarr, Radarr, and Lidarr.
---

# Calendar

A combined calendar showing TV episode air dates from Sonarr, movie releases from Radarr, and album releases from Lidarr. View in month, agenda, or split view.

## Supported Integrations

| Integration | Data Shown |
|-------------|------------|
| [Sonarr](/docs/integrations/sonarr) | TV episode air dates |
| [Radarr](/docs/integrations/radarr) | Movie release dates |
| [Lidarr](/docs/integrations/lidarr) | Album release dates |

:::info Multi-Integration
This is a multi-integration widget. You can assign multiple Sonarr, Radarr, and Lidarr instances — their calendars are merged into a single view.
:::

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| View Mode | Month | **Month** — traditional calendar grid. **Agenda** — chronological list. **Both** — split view with calendar and agenda side by side. |
| Look Ahead | 60d | How far into the future to load events (`30d` / `60d` / `90d` / `180d` / `All`) |
| Look Back | 30d | How far into the past to load events (`0d` / `7d` / `30d` / `90d` / `All`) |
| Start Week On | Sunday | First day of the week in Month or Both modes |
| Movie Release Dates | All | Which Radarr date to plot: **Cinema**, **Digital**, **Physical**, or **All** |

## Filters

- Filter chips for **TV**, **Movies**, and **Music**
