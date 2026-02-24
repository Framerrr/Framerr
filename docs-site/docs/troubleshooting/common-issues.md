---
sidebar_position: 1
---

# Common Issues

Solutions to the most frequently reported issues.

## Widgets Show Blank / No Data

**Symptoms:** Widgets appear on the dashboard but show no data, or show a loading spinner indefinitely.

**Common causes:**

### 1. Integration URL is wrong
If Framerr is in Docker and your services are too, you need to use the correct URL:

| Your setup | URL to use |
|------------|-----------|
| Same Docker network | Container name: `http://sonarr:8989` |
| Different network / host | IP address: `http://192.168.1.100:8989` |
| Same host, no Docker network | `http://host.docker.internal:8989` |

:::caution
**Never use `localhost` or `127.0.0.1`** if Framerr is in Docker. Inside the container, localhost refers to Framerr itself, not your host machine.
:::

### 2. API key is incorrect
Go to **Settings → Integrations**, click on the integration, and use **Test Connection** to verify. If the test fails, double-check your API key.

### 3. Browser extension blocking SSE
Framerr uses Server-Sent Events (SSE) for real-time data. Some browser extensions can interfere:
- Try opening Framerr in an **incognito/private window** (extensions are disabled by default)
- If it works in incognito, disable extensions one-by-one to find the culprit.

## "Test Connection" Fails

### Connection Refused
- The service isn't running, or the URL/port is wrong
- Check that the service is accessible from the Framerr container

### Timeout
- Network connectivity issue between Framerr and the service
- Firewall blocking the connection
- Service is on a different Docker network

### Authentication Failed
- API key is incorrect or expired
- For Plex: token may have expired — regenerate it

## Container Won't Start

### Missing Encryption Key
```
Error: SECRET_ENCRYPTION_KEY is required
```
You need to set the `SECRET_ENCRYPTION_KEY` environment variable. See the [Installation Guide](../getting-started/installation#generate-an-encryption-key).

### Port Already in Use
```
Error: Bind for 0.0.0.0:3001 failed: port is already allocated
```
Another container or service is using port 3001. Either stop that service or map Framerr to a different port.

```yaml
ports:
  - "3002:3001"  # Use port 3002 instead
```

## Dashboard Not Loading

- **Hard refresh** your browser: `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (Mac)
- Clear browser cache if issues persist
- Check container logs: `docker logs framerr`
