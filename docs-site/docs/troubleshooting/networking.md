---
sidebar_position: 2
---

# Networking Guide

Understanding Docker networking is key to getting Framerr working with your other services.

## How Docker Networking Works

Each Docker container has its own network namespace. When Framerr runs inside a container:

- `localhost` = the Framerr container itself (not your host)
- `host.docker.internal` = your host machine (Docker Desktop only)
- Container names = other containers on the same Docker network

## Recommended Setup: Shared Network

The simplest approach is to put all your services on the same Docker network:

```yaml title="docker-compose.yml"
services:
  framerr:
    image: pickels23/framerr:latest
    networks:
      - media

  sonarr:
    image: linuxserver/sonarr
    networks:
      - media

  radarr:
    image: linuxserver/radarr
    networks:
      - media

networks:
  media:
    driver: bridge
```

Then in Framerr, use container names as URLs:
- `http://sonarr:8989`
- `http://radarr:7878`

## Services on Different Hosts

If your services run on different machines:

```
http://192.168.1.50:8989    # Sonarr on another machine
http://nas.local:7878       # Radarr on a NAS
```

Make sure there are no firewall rules blocking traffic between the machines.

## Reverse Proxy Considerations

If you access Framerr through a reverse proxy (Nginx, Traefik, Caddy):

### Important: SSE Support

Framerr uses **Server-Sent Events (SSE)** for real-time updates. Your reverse proxy must support long-lived connections.

#### Nginx
```nginx
location / {
    proxy_pass http://framerr:3001;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 86400s;  # Keep SSE alive for 24h
}
```

#### Traefik
Traefik handles SSE connections automatically — no special configuration needed.

#### Caddy
```
framerr.yourdomain.com {
    reverse_proxy framerr:3001
}
```
Caddy handles SSE automatically.

## Debugging Connectivity

If you're having trouble connecting an integration:

```bash
# Test from inside the Framerr container
docker exec -it framerr wget -qO- http://sonarr:8989/api/v3/system/status?apikey=YOUR_KEY

# Check if containers can see each other
docker exec -it framerr ping sonarr
```
