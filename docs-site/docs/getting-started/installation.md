---
sidebar_position: 1
---

# Installation

Framerr runs as a single Docker container. No database server, no external dependencies — just one container and you're up.

## Requirements

- **Docker** (20.10 or later recommended)
- A **64-character hexadecimal encryption key** for securing API keys and tokens

## Generate an Encryption Key

Framerr encrypts all stored API keys and tokens. You need to generate a key once:

```bash
# Linux/Mac
openssl rand -hex 32

# Or with Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

:::caution Save This Key
Store your encryption key somewhere safe. If you lose it and recreate the container, you'll need to re-enter all your integration credentials.
:::

## Docker Run

The simplest way to get started:

```bash
docker run -d \
  --name framerr \
  -p 3001:3001 \
  -v /path/to/appdata/framerr:/config \
  -e SECRET_ENCRYPTION_KEY=your-64-char-hex-key-here \
  pickels23/framerr:latest
```

Then open **http://your-server:3001** in your browser.

## Docker Compose (Recommended)

For easier management, use Docker Compose:

```yaml title="docker-compose.yml"
services:
  framerr:
    image: pickels23/framerr:latest
    container_name: framerr
    ports:
      - "3001:3001"
    volumes:
      - /path/to/appdata/framerr:/config
    environment:
      - SECRET_ENCRYPTION_KEY=your-64-char-hex-key-here
    restart: unless-stopped
```

```bash
docker compose up -d
```

## Configuration

All Framerr data (database, settings, backups) is stored in the `/config` volume. Mount this to a persistent location on your host.

| Path | Description |
|------|-------------|
| `/config/framerr.db` | SQLite database (settings, users, widgets) |
| `/config/backups/` | Automatic and manual backups |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_ENCRYPTION_KEY` | ✅ Yes | 64-character hex key for encrypting stored credentials |
| `PUID` / `PGID` | No | User/group ID for file permissions (default: `0`/`0` — root) |
| `TZ` | No | Timezone (default: `UTC`) |
| `LOG_LEVEL` | No | Logging verbosity (default: `info`) |

See the full **[Environment Variables Reference](../configuration/environment-variables)** for all options.

## Updating

See the **[Updating Guide](updating)** for detailed instructions on updating via Docker Compose, Docker Run, and Unraid.
