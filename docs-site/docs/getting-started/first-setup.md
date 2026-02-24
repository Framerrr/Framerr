---
sidebar_position: 2
---

# First Setup

After installing Framerr, you'll be greeted with a setup wizard that walks you through the initial configuration.

## Setup Wizard

When you first open Framerr, the setup wizard will guide you through:

1. **Create Admin Account** — Set your username and password
2. **Server Name** — Give your dashboard a name (e.g., "Media Server", "Home Lab")
3. **Optional Plex SSO setup** — Connect your Plex account for easy login

## Walkthrough

After first login you will be greeted with an optional walkthrough. This walkthrough will guide you through the process of adding your first widget and integration. 

## Adding Your First Integration

To connect an integration:

1. Go to **Settings → Integrations → Service Settings**
2. Click **Add Integration** in the top right of the page
3. Select the service type
4. Enter the required credentials for the service
5. Click **Test Connection** to verify
6. Save

## Adding Widgets

Once a compatible integration is added, you can add a widget to your dashboard that utilizes that integration.

1. Click the **Edit** button in the top right of the dashboard (or swipe up on the tab bar on mobile) to enter edit mode
2. Click **+ Add** in the edit mode action bar
3. Select a widget from the widget catalog (a green badge will appear next to each widget type when a compatible integration is setup and enabled)
4. Click **Add to Dashboard** or drag and drop the desired widget onto the dashboard
5. Widgets will attempt to auto-bind to the first available, compatible integration. If you have multiple integrations of the same type, you can change the binding by clicking the gear icon on the widget and selecting the desired integration.
6. Click **Save**

### Finding API Keys

| Service | Where to find the API key |
|---------|--------------------------|
| **Sonarr** | Settings → General → API Key |
| **Radarr** | Settings → General → API Key |
| **Plex** | Press **Connect to Plex** in the Plex integration form, claim a token at [plex.tv](https://www.plex.tv/claim/), or find it in your Plex server settings |
| **Seerr** | Settings → General → API Key |
| **Tautulli** | Settings → Web Interface → API Key |
| **qBittorrent** | Uses username/password, or leave blank if authentication is disabled |
| **SABnzbd** | Config → General → API Key |
| **Glances** | Uses password, or leave blank if authentication is disabled |

### Docker Networking

If your services are running in Docker on the same host:

- **Same Docker network:** Use container names (e.g., `http://sonarr:8989`)
- **Host networking:** Use `http://host.docker.internal:8989`
- **Different hosts:** Use the actual IP or hostname

:::caution Common Mistake
Don't use `localhost` or `127.0.0.1` as the URL if Framerr is in Docker — those refer to the Framerr container itself, not your host machine.
:::

## Customizing Your Dashboard

After adding widgets to your dashboard, you can:

- **Rearrange widgets** — Click "Edit Dashboard" and drag widgets to reorder
- **Resize widgets** — Drag the edges of widgets to resize
- **Configure widgets** — Click the gear icon on any widget to customize
