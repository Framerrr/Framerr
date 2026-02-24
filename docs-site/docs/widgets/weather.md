---
title: Weather
description: Current weather conditions and forecast with configurable location.
---

# Weather

Displays current weather conditions and forecast for a configurable location. Uses the free [Open-Meteo API](https://open-meteo.com/) — no API key required.

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| Location | City Search | **Auto** — uses browser geolocation. **City Search** — search for a city by name. **Manual** — enter latitude/longitude directly. |
| Search City | New York | Type-ahead city search with auto-populated coordinates. Visible in City Search mode. |
| Latitude | 40.7128 | Latitude coordinate. Editable in Manual mode, read-only in City Search mode. |
| Longitude | -74.006 | Longitude coordinate. Editable in Manual mode, read-only in City Search mode. |
| °C | Off | Switch between Fahrenheit and Celsius |
| Decimals | Off | Show decimal values for temperature |
| City | On | Show the city name in the widget |

:::warning Auto Location
**Auto** mode requires HTTPS — browser geolocation is not available over plain HTTP. How often you're prompted to allow location access depends on your browser; some remember the permission, others ask each session.
:::
