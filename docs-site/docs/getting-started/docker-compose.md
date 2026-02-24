---
sidebar_position: 3
---

# Docker Compose Examples

Here are some common Docker Compose configurations for running Framerr alongside your other services.

## Standalone

The simplest setup — just Framerr:

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
      - SECRET_ENCRYPTION_KEY=your-64-char-hex-key
    restart: unless-stopped
```

## With Media Stack

Running Framerr alongside Sonarr, Radarr, and Plex on the same network:

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
      - SECRET_ENCRYPTION_KEY=your-64-char-hex-key
    networks:
      - media
    restart: unless-stopped

  sonarr:
    image: linuxserver/sonarr
    container_name: sonarr
    ports:
      - "8989:8989"
    volumes:
      - ./sonarr-config:/config
      - /path/to/media:/media
    networks:
      - media
    restart: unless-stopped

  radarr:
    image: linuxserver/radarr
    container_name: radarr
    ports:
      - "7878:7878"
    volumes:
      - ./radarr-config:/config
      - /path/to/media:/media
    networks:
      - media
    restart: unless-stopped

networks:
  media:
    driver: bridge
```

:::tip Container Names as URLs
When all services share the same Docker network, use the container name as the URL in Framerr:
- Sonarr: `http://sonarr:8989`
- Radarr: `http://radarr:7878`
:::

## With Reverse Proxy (Nginx Proxy Manager)

If you're using a reverse proxy to access services via domain names:

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
      - SECRET_ENCRYPTION_KEY=your-64-char-hex-key
    networks:
      - proxy
    restart: unless-stopped

networks:
  proxy:
    external: true
```

:::tip
Most reverse proxies work with Framerr out of the box. If real-time updates aren't working, see the **[Troubleshooting → Networking](../troubleshooting/networking)** page.
:::
