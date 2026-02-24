---
sidebar_position: 3
---

# Multi-User & Access Control

Framerr supports multiple users with role-based access control and several authentication methods.

## User Roles

Every user has a **role** that determines what they can access:

| Role | Dashboard | Personal Settings | Admin Panel | Manage Users | Manage Integrations |
|------|-----------|-------------------|-------------|--------------|---------------------|
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **User** | ✅ | ✅ | ❌ | ❌ | ❌ |

**Admins** have full control — they can manage all settings, integrations, users, and system configuration. Admins can also reset passwords, promote/demote users, and delete accounts.

**Users** have their own dashboard and can customize their own experience (theme, layout preferences) but cannot modify integrations or access the admin panel.

The first account created during [initial setup](../getting-started/first-setup) is automatically an admin.

:::info Credential Security
Integration credentials (API keys, tokens, passwords) are **never sent to the browser** — not even to admins. Sensitive fields are redacted server-side before every API response. The only time a credential is visible is when you're actively typing it into a form field. Users you share integrations with only see widget data, never configuration.
:::

## User Groups

Users can be organized into **groups** for easier organization. Groups are for labeling only, providing easy sharing and management of users — they don't control permissions.

Manage groups in **Settings → User Management → Groups**.

## Authentication Methods

Framerr supports three ways to authenticate:

### 1. Local Login (Default)

Standard username and password login. Every user in Framerr has a local account — users who sign in through Plex are prompted to create local credentials on first login.

- Accounts are created during setup, by an admin, or automatically on first Plex login
- Passwords are hashed using bcrypt

### 2. Plex Login

Users who have **shared library access** on the admin's Plex server can sign in with their Plex account. Local Plex Home users cannot use Plex Login — only users who appear in the admin's Plex sharing settings.

**How it works:**
1. Admin links their Plex account in **Settings → Auth → Plex SSO**
2. A user clicks "Sign in with Plex" and authenticates through Plex
3. Framerr verifies the user has library access on the admin's server
4. On first login, the user is prompted to create a local Framerr account (username + password)
5. The Plex account is linked to the local account for future logins

:::tip
After the initial setup, users can sign in with either their Plex account or their local credentials.
:::

### 3. Proxy Authentication

For users running a reverse proxy with an authentication layer (like **Authentik**, **Authelia**, or **Organizr**), Framerr can trust authentication headers from the proxy.

**How it works:**
1. Your reverse proxy authenticates the user
2. The proxy forwards headers with the username (and optionally email)
3. Framerr reads those headers and creates a session
4. If the user doesn't exist yet, Framerr auto-creates their account

**Enable in:** Settings → Auth → Auth Proxy

#### Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| Username header | `X-authentik-username` | Header containing the authenticated username |
| Email header | `X-authentik-email` | Header containing the user's email (optional) |
| Trusted IP whitelist | — | IP or CIDR range of your reverse proxy (required) |

**Fallback headers** are also checked automatically:
- `X-Forwarded-User` / `Remote-User` (username)
- `X-Forwarded-Email` / `Remote-Email` (email)

#### Example: Authentik

If you're using Authentik as your identity provider, the default header names work out of the box. Just enable proxy auth in Framerr settings.

#### Example: Authelia

Authelia uses `Remote-User` and `Remote-Email` headers, which Framerr detects automatically as fallbacks. No header name changes needed.

:::warning Security Notice
Proxy authentication requires a **trusted IP whitelist**. Framerr will only accept authentication headers from IPs in this whitelist — requests from any other IP have their proxy headers stripped automatically. Make sure the whitelist contains only your reverse proxy's IP or subnet (e.g., `172.18.0.0/16` for a Docker network).
:::

### 4. iFrame Auth (OAuth for Embedded Tabs)

If you embed services like Sonarr or Radarr as iframe tabs and those services are behind an auth proxy, some browsers — particularly **Safari and iOS** — may not load them correctly. This happens because Safari's privacy protections block third-party cookies from being shared into iframe contexts, preventing the auth proxy session from carrying over.

Most **Chrome-based browsers** handle this fine without any extra configuration. iFrame Auth provides an **OAuth 2.0 flow** as a workaround for browsers that don't.

**How it works:**
1. When an iframe tab can't authenticate, click the 🔒 **lock icon** in the tab toolbar
2. Your auth provider's login page opens in a new tab
3. After authenticating, you're redirected back to Framerr
4. The iframe reloads — now authenticated via the session cookie from your proxy

**Enable in:** Settings → Auth → iFrame Auth

#### Configuration

| Setting | Description |
|---------|-------------|
| OAuth Provider Endpoint | Your auth provider's authorization URL |
| Client ID | OAuth client ID from your provider |
| Redirect URI | Auto-populated — your Framerr URL + `/login-complete` |
| Scopes | OAuth scopes (default: `openid profile email`) |

:::tip
An **"Use Authentik Template"** button is available in the settings to auto-fill the configuration for Authentik users.
:::

:::info
The OAuth provider must be the **same instance** that protects your services. The purpose isn't to get a token — it's to establish the session cookie with your auth proxy so subsequent iframe loads are authenticated.
:::

## Session Management

Framerr uses cookie-based sessions stored in the database.

| Setting | Default | Description |
|---------|---------|-------------|
| Session timeout | 24 hours | How long a session lasts without activity |
| Remember Me | 30 days | Extended session when "Remember Me" is checked at login |
| Cookie security | Auto | `Secure` flag is set automatically when accessed via HTTPS |


## Password Reset

If a user forgets their password, an admin can reset it from the user management panel.

Framerr also provides a CLI tool inside the container:

```bash
docker exec -it framerr framerr reset-password -u <username>
```

The script will:
1. **Ask for a new password**, or auto-generate one
2. **Ask if the user should be required to change it on next login** (default: yes)
3. **Revoke all existing sessions** for that user
4. Display the new password in the terminal
