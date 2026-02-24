---
sidebar_position: 5
---

# Updating

Framerr updates are delivered through new Docker image versions. Your data is preserved in the `/config` volume — updates only replace the application code.

:::tip Backup First
It's good practice to [create a backup](../configuration/backups) before updating, especially for major version changes.
:::

:::warning Early Development
Framerr is in early development (`0.x.x`). Updates may include breaking changes. Always back up before updating, and check the [changelog](https://github.com/Framerrr/Framerr/blob/main/CHANGELOG.md) for any migration notes.
:::

## Docker Compose (Recommended)

```bash
docker compose pull
docker compose up -d
```

Docker Compose will pull the latest image and recreate the container with your existing configuration.

## Docker Run

```bash
# Pull the latest image
docker pull pickels23/framerr:latest

# Stop and remove the old container
docker stop framerr
docker rm framerr

# Start with the same settings
docker run -d \
  --name framerr \
  -p 3001:3001 \
  -v /path/to/appdata/framerr:/config \
  -e SECRET_ENCRYPTION_KEY=your-key-here \
  pickels23/framerr:latest
```

## Unraid

1. Go to the **Docker** tab
2. Click on the Framerr container
3. Select **Force Update** or **Update**
4. The container will pull the latest image and restart

## Version Pinning

If you want to stay on a specific version instead of `latest`:

```yaml title="docker-compose.yml"
services:
  framerr:
    image: pickels23/framerr:0.1.6  # Pin to specific version
```

Available tags:
- `latest` — Latest stable release
- `0.1.6`, `0.1.5`, etc. — Specific versions
- `develop` — Pre-release builds (may be unstable)

## Downgrading

:::caution
Downgrading is **not supported** if the newer version included database migrations. Framerr will detect the database is newer than expected and refuse to start.

If you need to downgrade, restore from a [backup](../configuration/backups) taken before the upgrade.
:::

## Changelog

See the [full changelog](https://github.com/Framerrr/Framerr/blob/main/CHANGELOG.md) for a detailed list of what changed in each version.
