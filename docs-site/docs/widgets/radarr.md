---
title: Radarr Library
description: Movie library management with missing movies and download queue.
---

# Radarr Library

Displays your Radarr movie library with upcoming and missing movies from your library.

## Supported Integrations

| Integration | Features |
|-------------|----------|
| [Radarr](/docs/integrations/radarr) | Movie list, missing movies, queue, stats |

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| View Mode | Auto | **Auto** — adapts layout to widget size. **Stacked** — sections stacked vertically. **Column** — sections in columns side by side. |
| Summary Bar | Show | Show or hide the statistics bar at the top (movie count, monitored count, etc.) |
| Sort By | Next Date | Sort upcoming by next date, cinema, digital, or physical |
| Look Ahead | 30d | How far ahead to show upcoming movies (`7d` / `30d` / `90d` / `All`) |
| Show Release Types | Cinema + Digital + Physical | Toggle which release-type pills appear |
| Needs Attention | Missing + Upgrades | Toggle visibility of missing and cutoff-unmet groups independently |
