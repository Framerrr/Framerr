---
sidebar_position: 1
---

# Environment Variables

All Framerr configuration is done through environment variables set on the Docker container. Most are optional — only `SECRET_ENCRYPTION_KEY` is required.

## Required

| Variable | Description |
|----------|-------------|
| `SECRET_ENCRYPTION_KEY` | **Required.** 64-character hex string used to encrypt stored API keys, tokens, and passwords with AES-256-GCM. Generate one with `openssl rand -hex 32`. |

:::caution Save Your Encryption Key
If you lose your encryption key and recreate the container, all stored integration credentials become unrecoverable. You'll need to re-enter every API key and password. **Store it somewhere safe.**
:::

## Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Port the server listens on inside the container. Change the Docker port mapping instead of this unless you have a specific reason. |
| `PUID` | `0` (root) | User ID to run the Framerr process as. See [File Permissions](#file-permissions). |
| `PGID` | `0` (root) | Group ID to run the Framerr process as. See [File Permissions](#file-permissions). |
| `TZ` | `UTC` | Timezone for scheduled backups, logs, and timestamps. Use [TZ database names](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones) (e.g. `America/New_York`, `Europe/London`). |
| `LOG_LEVEL` | `info` | Server log verbosity. Options: `error`, `warn`, `info`, `verbose`, `debug`, `trace`. See [Logs & Debugging](../troubleshooting/logs-debugging). |
| `DATA_DIR` | `/config` | **Advanced.** Path where Framerr stores its database and files inside the container. You should almost never change this. |
| `FRAMERR_DB_PATH` | `<DATA_DIR>/framerr.db` | **Advanced.** Override the database file path. Only useful if you need to put the database in a non-standard location. |

## Docker Compose Example

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
      - PUID=1000
      - PGID=1000
      - TZ=America/New_York
    restart: unless-stopped
```

## File Permissions

By default, Framerr runs as root inside the container — no configuration needed. This works on all platforms out of the box.

If you want the container to run as a non-root user (for host file ownership or security), set `PUID` and `PGID` to match your host user. Framerr will create a user with those IDs, set ownership on `/config`, and run the process as that user.

**Common values:**

| Platform | PUID | PGID |
|----------|------|------|
| Most Linux distros | `1000` | `1000` (first non-root user) |
| Unraid | `99` | `100` (matches `nobody:users`) |
| Synology DSM | Your user's UID | `100` or your user's GID |

To find your user's IDs on Linux:

```bash
id $USER
# Output: uid=1000(youruser) gid=1000(youruser) ...
```

:::tip
If you see permission errors in the container logs, your PUID/PGID likely don't match the owner of the host directory you've mounted to `/config`.
:::

## Encryption Details

Framerr uses **AES-256-GCM** encryption to protect sensitive data stored in the database — API keys, tokens, and passwords for all your integrations.

**In production (Docker):**
- A valid `SECRET_ENCRYPTION_KEY` is required or the server will not start
- If the key is missing, the server output will include a generated key you can copy
- All integration credentials are encrypted before being written to the database

**In development mode:**
- Encryption is bypassed — credentials are stored as plaintext for easier debugging

**Backup portability:**
- Backups automatically [decrypt credentials](backups#how-backups-work) so they can be restored on a different instance with a different encryption key
- On restore, credentials are re-encrypted with the new instance's key
- ⚠️ This means backup files contain plaintext credentials — [treat them like passwords](backups#how-backups-work)
