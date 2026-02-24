---
sidebar_position: 0
---

# Prerequisites

Before installing Framerr, make sure your system meets these requirements.

## System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **Docker** | 20.10+ | Latest stable |
| **RAM** | 256 MB | 512 MB+ |
| **Disk** | 100 MB (app) + space for backups | 500 MB+ |
| **Architecture** | `amd64` or `arm64` | — |

Framerr runs as a single container with an embedded SQLite database — no separate database server, Redis, or other dependencies needed.

## Supported Platforms

Framerr's Docker image is built for both architectures. Docker will pull the correct one automatically.

| Platform | Architecture | Status |
|----------|-------------|--------|
| Linux x86_64 | `amd64` | ✅ Supported |
| Linux ARM64 (Raspberry Pi 4/5, Apple Silicon) | `arm64` | ✅ Supported |
| Unraid | `amd64` / `arm64` | ✅ Supported |
| Synology DSM | `amd64` / `arm64` | ✅ Supported |
| Windows (via Docker Desktop / WSL2) | `amd64` | ✅ Supported |
| macOS (via Docker Desktop) | `arm64` / `amd64` | ✅ Supported |

## Network Considerations

Framerr needs to reach your other services (Sonarr, Radarr, Plex, etc.) over the network:

- **Same Docker network:** Use container names as hostnames (e.g. `http://sonarr:8989`)
- **Host network or different Docker network:** Use your server's IP address (e.g. `http://192.168.1.100:8989`)


See [Docker Networking](../troubleshooting/networking) for more details.

