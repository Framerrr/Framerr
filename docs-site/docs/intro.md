---
slug: /
sidebar_position: 1
---

# Framerr

A self-hosted dashboard for your media server stack. Plex, Sonarr, Radarr, Seerr, and more — all in one place.

## Key Features

- 🎬 **Real-time media streaming** — See who's watching on Plex, Jellyfin, or Emby
- 📥 **Download monitoring** — Track Sonarr, Radarr, and qBittorrent/SABnzbd activity
- 📊 **System status** — Monitor server health at a glance
- 🎨 **Fully customizable** — Themes, layouts, widget configurations, and more
- 🔒 **Multi-user support** — Admin and user roles with easy sharing between family and friends
- 📱 **Responsive design** — Works beautifully on desktop, tablet, and mobile
- 🐳 **Docker-first** — Simple deployment with a single container

## Quick Start

Get Framerr running in under a minute:

```bash
docker run -d \
  --name framerr \
  -p 3001:3001 \
  -v /path/to/appdata/framerr:/config \
  -e SECRET_ENCRYPTION_KEY=your-64-char-hex-key \
  pickels23/framerr:latest
```

Then open `http://your-server:3001` and follow the setup wizard.

## Need Help?

- 📖 Check the [Troubleshooting Guide](troubleshooting/common-issues)
- 🐛 Report issues on [GitHub](https://github.com/Framerrr/Framerr/issues)
