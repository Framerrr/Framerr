---
sidebar_position: 10
title: Glances
description: Connect Glances to Framerr for system monitoring — CPU, memory, temperature, disk, and network.
---

# Glances

Glances is a cross-platform system monitoring tool with a REST API. Framerr connects to Glances to display **CPU usage**, **memory**, **temperature**, **disk usage**, **network throughput**, and **uptime**.

## Requirements

- Glances running in **web server mode** (`glances -w`) and accessible from the Framerr container
- Optional: password protection

## Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| **Glances URL** | ✅ | URL to your Glances instance, e.g. `http://192.168.1.5:61208` |
| **Password** | ❌ | Glances password (leave empty if no authentication is set) |

### Default Port

Glances uses port **61208** by default.

### Docker URL Example

```
http://glances:61208
```

## Running Glances in Web Mode

Glances must be running with its web server enabled:

```bash
glances -w
```

### Docker Setup

When running Glances in Docker, you need to mount host system paths and use host networking for accurate metrics. Without this, Glances reports container resource usage instead of host system stats.

```yaml
services:
  glances:
    image: nicolargo/glances:latest
    restart: unless-stopped
    pid: host
    network_mode: host
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    environment:
      - GLANCES_OPT=-w
```

:::important
Without `pid: host` and `network_mode: host`, Glances will report the **container's own metrics** instead of your host system. If your CPU or network stats seem unusually low, this is likely the cause.
:::

:::tip
For monitoring a remote server's hardware, install Glances on that machine and point Framerr to its URL.
:::

## Available Widgets

### System Status Widget

Configurable system monitoring dashboard showing:
- **CPU usage** — percentage with real-time updates
- **Memory usage** — used/total with percentage
- **Temperature** — CPU/system temperature readings
- **Uptime** — system uptime
- **Disk usage** — per-mount-point usage with configurable visibility
- **Network** — upload and download throughput

**Layout modes:** Grid (compact tiles) or Stacked (vertical list)

Each metric can be individually shown or hidden via widget settings. Disk partitions can be configured individually via the disk configuration panel.

## Troubleshooting

### Connection Test Fails

- Verify Glances is running in web server mode (`-w` flag)
- Ensure the URL is reachable from the Framerr container
- If using a password, ensure it matches

### Some Metrics Show "N/A"

- Not all systems expose all metrics (e.g., temperature may not be available in VMs)
- Glances needs appropriate permissions — run with `--pid host` in Docker for accurate CPU data
- Temperature sensors may require `lm-sensors` to be installed on the host. Check out the [Glances documentation](https://glances.readthedocs.io/en/latest/install.html#install-glances-on-linux) for more information.
