---
sidebar_position: 3
---

# Logs & Debugging

When something isn't working right, Framerr's logs and built-in diagnostics are the first place to look.

## Viewing Container Logs

### Docker CLI

```bash
# View recent logs
docker logs framerr

# Follow logs in real-time
docker logs -f framerr

# Show last 100 lines
docker logs --tail 100 framerr

# Show logs with timestamps
docker logs -t framerr
```

### Docker Compose

```bash
docker compose logs framerr
docker compose logs -f framerr
```

## Log Levels

Framerr supports five log levels, from least to most verbose:

| Level | What It Shows | When to Use |
|-------|--------------|-------------|
| `error` | Errors only | Minimal logging |
| `warn` | Errors + warnings | Quieter production setups |
| `info` | General operational messages | **Default** — good for most users |
| `verbose` | Detailed operational info | Investigating issues |
| `debug` | Internal state and request details | Active debugging |

### Setting the Log Level

**Environment variable** (set on the container):

```yaml title="docker-compose.yml"
environment:
  - LOG_LEVEL=debug
```

**Runtime** (no restart needed): You can also change the log level from **Settings → Advanced → Debug** without restarting the container. This takes effect immediately and persists across restarts. If both the environment variable and a UI selection are set, the UI selection takes priority.

## Built-in Diagnostics

Framerr includes a diagnostics panel accessible to admins at **Settings → Advanced → Debug**. It provides:

| Tool | Purpose |
|------|---------|
| **Database check** | Tests SQLite connection and reports database size, user count, and latency |
| **API health check** | Tests critical API endpoints and response times |
| **SSE status** | Shows the number of active real-time connections |
| **Network speed test** | Tests latency and throughput between your browser and the Framerr server |
| **Live log viewer** | View server logs in real-time from the browser |

## Common Log Messages

### Startup Messages

```
╔═══════════════════════════════════════════════════════════╗
║  Framerr                                                  ║
╚═══════════════════════════════════════════════════════════╝
Version: 0.1.6
Environment: production
Encryption key validated
Database ready (v22)
System config loaded
[Server] Listening on port 3001
[Server] Ready ✓
```

If you see these messages, Framerr started successfully.

### Integration Errors

```
[Poller:sonarr] Connection error: ECONNREFUSED
```
The integration can't reach the configured URL. Check the URL and that the service is running. See [Common Issues](common-issues#widgets-show-blank--no-data).

```
[Poller:plex] HTTP 401 Unauthorized
```
The API key or token is invalid. Go to **Settings → Integrations** and re-enter the credentials.

### Encryption Errors

```
SECRET_ENCRYPTION_KEY not found
```
You didn't set the encryption key. See [Environment Variables](../configuration/environment-variables#required).

```
Invalid SECRET_ENCRYPTION_KEY
```
The key must be exactly 64 hexadecimal characters. Generate a new one with `openssl rand -hex 32`.

```
Failed to decrypt data. The encryption key may have changed.
```
You changed the encryption key but have integration credentials encrypted with the old key. [Restore from a backup](../configuration/backups#restoring-a-backup) taken before the key change, or re-enter all integration credentials.

### Database Migration

```
Database migrated (v20 → v22, 2 migrations)
```
Normal — Framerr upgraded the database schema after an update. No action needed.

```
Database schema (v25) is newer than this version of Framerr expects (v22).
```
You downgraded Framerr to an older version. See [Downgrading](../getting-started/updating#downgrading).

## Health Endpoint

Framerr exposes a health endpoint at `/api/health` that returns the server's current status:

```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "version": "0.1.6",
  "channel": "latest",
  "environment": "production"
}
```

## Getting Help

If you can't resolve an issue from the logs:

1. Check the [Common Issues](common-issues) page
2. Check the [Docker Networking](networking) guide
3. Search [GitHub Issues](https://github.com/Framerrr/Framerr/issues) for similar problems
4. Open a new issue with:
   - Your Docker Compose file (remove your encryption key!)
   - Relevant log output
   - Steps to reproduce the problem
