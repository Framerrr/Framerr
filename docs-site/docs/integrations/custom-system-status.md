---
sidebar_position: 14
title: Custom System Status
description: Connect your own system monitoring API to Framerr for custom hardware metrics.
---

# Custom System Status

The Custom System Status integration lets you connect **your own monitoring API endpoint** to Framerr. This is useful for monitoring systems that don't have a dedicated Framerr integration, or for custom hardware setups.

## Requirements

- A web server providing a JSON API at a `/status` endpoint
- Optional: bearer token authentication

## Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| **API URL** | ✅ | URL to your monitoring API, e.g. `http://192.168.1.5:8080` |
| **Bearer Token** | ❌ | Optional authentication token (leave empty if not required) |

## API Endpoint Requirements

Your API must provide a `GET /status` endpoint returning JSON with the following fields:

```json
{
  "cpu": 45.2,
  "memory": 67.8,
  "temperature": 52,
  "uptime": "5 days, 3:42:15"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `cpu` | number | ✅ | CPU usage percentage (0–100) |
| `memory` | number | ✅ | Memory usage percentage (0–100) |
| `temperature` | number | ❌ | Temperature in °C |
| `uptime` | string or number | ❌ | Uptime as a human-readable string or seconds |

### Optional: Metric History

For metric history graphs, optionally provide a `GET /history` endpoint:

```
GET /history?metric=cpu&range=1h
```

Response format:

```json
{
  "data": [
    { "t": 1700000000, "v": 42.5 },
    { "t": 1700000060, "v": 43.1 }
  ],
  "availableRange": "24h",
  "resolution": "1m"
}
```

## Available Widgets

### System Status Widget

Displays your custom system metrics alongside any other system monitoring integrations (Glances, Unraid):
- **CPU usage**
- **Memory usage**
- **Temperature** (if provided)
- **Uptime** (if provided)

## Example Implementation

A minimal Python implementation:

```python
from flask import Flask, jsonify
import psutil

app = Flask(__name__)

@app.route('/status')
def status():
    return jsonify({
        'cpu': psutil.cpu_percent(),
        'memory': psutil.virtual_memory().percent,
        'uptime': str(psutil.boot_time())
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
```

## Troubleshooting

### Connection Test Fails

- Verify the API URL is reachable from the Framerr container
- Ensure the `/status` endpoint returns valid JSON
- Check that the bearer token is correct (if using authentication)

### Metrics Show "N/A"

- Verify your API returns the expected JSON structure
- Ensure `cpu` and `memory` are numbers between 0 and 100
