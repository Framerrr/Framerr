<p align="center">
  <img src="docs/branding/framerr-banner.png" alt="Framerr" width="100%">
</p>

<p align="center">
  Self-hosted homelab dashboard with iframe tabs, real-time widgets, and Plex SSO.
</p>

<p align="center">
  <a href="https://hub.docker.com/r/pickels23/framerr"><img src="https://img.shields.io/docker/pulls/pickels23/framerr" alt="Docker Pulls"></a>
  <img src="https://img.shields.io/github/package-json/v/Framerrr/Framerr" alt="Version">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/Framerrr/Framerr" alt="License"></a>
</p>

> [!WARNING]
> Framerr is in early development (`0.x.x`). Expect breaking changes between releases. Not recommended for critical production use yet.

---

<p align="center">
  <img src="docs/branding/screenshots/framerr-dashboard-desktop-1.png" alt="Framerr Dashboard" width="100%">
</p>
<h3 align="center">⚡ Powerful, Modern Dashboard</h3>
<p align="center">Real-time widgets, drag-and-drop layout, and deep integration with your homelab services — all in one customizable view.</p>

<p align="center">
  <img src="docs/branding/screenshots/framerr-dashboard-mobile-1.png" alt="Framerr Mobile" width="280">
</p>
<h3 align="center">📱 Responsive Mobile Design</h3>
<p align="center">Dedicated mobile layout with independent widget arrangement and touch-friendly controls. Your dashboard, anywhere.</p>

## Features

- **Iframe tabs** — embed any web app or service as a tab in the sidebar, organized into groups
- **Real-time widgets** — media streams (Plex, Jellyfin, Emby), Sonarr/Radarr calendars, Overseerr requests, qBittorrent downloads, system stats via Glances, service health via Uptime Kuma, weather, clock, and more (more coming soon!)
- **Plex SSO** — quickly sign into Framerr with your Plex account
- **Auth proxy** — works behind Authelia, Authentik, Nginx Proxy Manager with trusted IP whitelist
- **Customizable** — many built-in themes to choose from, plus a full custom color picker
- **Dashboard templates** — build, save, share, and import/export layouts
- **Drag and drop** — easily rearrange widgets with intuitive mobile and touch support
- **Multi-user** — securely share access to widgets and integrations with friends and family
- **Encrypted secrets** — integration API keys and tokens are encrypted at rest with AES-256-GCM
- **Mobile responsive** — dedicated mobile layout with bottom navigation

## Quick Start

### Docker Compose

```yaml
services:
  framerr:
    image: pickels23/framerr:latest
    container_name: framerr
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=America/New_York
      - SECRET_ENCRYPTION_KEY=   # Run: openssl rand -hex 32
    volumes:
      - ./config:/config
    ports:
      - 3001:3001
    restart: unless-stopped
```

Generate your encryption key by running `openssl rand -hex 32` in a terminal and paste the output as the value. This key encrypts integration credentials (API keys, tokens) at rest.

Then open `http://localhost:3001` and follow the setup wizard.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_ENCRYPTION_KEY` | — | **Required.** Encryption key for integration secrets. |
| `PORT` | `3001` | Application port |
| `PUID` | `99` | User ID for file permissions |
| `PGID` | `100` | Group ID for file permissions |
| `TZ` | `UTC` | Timezone |
| `DATA_DIR` | `/config` | Data directory |

All persistent data (database, uploads, backups) is stored in `/config`.

## Supported Integrations

| Integration | Widget |
|------------|--------|
| Plex / Jellyfin / Emby | Live media streams with progress |
| Sonarr / Radarr | Calendar and upcoming releases |
| Overseerr | Recent requests with status |
| qBittorrent | Downloads and transfer speeds |
| Glances | CPU, memory, temperature, uptime |
| Uptime Kuma | Service health monitoring |

## Tech Stack

- **Frontend:** React 19, Vite 7, Tailwind CSS 4
- **Backend:** Node.js 20, Express, SQLite
- **Deployment:** Docker (Alpine)

## Development

```bash
git clone https://github.com/pickels23/framerr.git
cd framerr
npm install
cd server && npm install && cd ..
npm run dev:all
```

## License

[MIT](LICENSE)
