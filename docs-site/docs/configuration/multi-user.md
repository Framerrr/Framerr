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

Framerr supports multiple ways to sign in. 

### 1. Local Login (Default)

Standard username and password login.

- Admin account created on first start up.
- Accounts can be created during setup, by an admin, or automatically the first time someone signs in through another method (when auto-create is enabled)
- Local passwords are hashed using bcrypt

### 2. Plex Login

Users who have **shared library access** on the admin's Plex server can sign in with their Plex account. Local Plex Home users cannot use Plex Login — only users who appear in the admin's Plex sharing settings.

**Enable in:** Settings → Auth → Plex SSO

:::tip
Plex users can also set a local password later if they want a backup sign-in method.
:::

### 3. Proxy Authentication

If you already protect Framerr with a reverse proxy auth layer like **Authentik** or **Authelia**, Framerr can sign users in through that same login.

**How it works:**
1. Your reverse proxy authenticates the user
2. If the user doesn't exist yet in Framerr, their account is created automatically

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
Proxy authentication requires a **trusted IP whitelist**. Only allow your reverse proxy's IP or subnet (e.g., `172.18.0.0/16` for a Docker network) — otherwise other clients could try to spoof login headers.
:::

### 4. OpenID Connect (OIDC) SSO

Sign in with an identity provider such as **Authentik**, **Authelia**, **Keycloak**, or any other OpenID Connect–compatible SSO.

**How it works:**
1. Admin turns on OpenID Connect in **Settings → Auth → OpenID Connect** and enters the provider details
2. A "Sign in with [Display Name]" button appears on the login page
3. On first login, Framerr can create the user automatically (if **Auto-create Users** is enabled)
4. Existing users can link their own SSO account from **Settings → Account → Connected Accounts**

**Enable in:** Settings → Auth → OpenID Connect

#### Configuration

| Setting | Description |
|---------|-------------|
| Issuer URL | Base URL of your OIDC provider (e.g. `https://auth.example.com`) |
| Client ID / Client Secret | Credentials from your provider's application registration |
| Display Name | Text shown on the login button (e.g. "Company SSO") |
| Scopes | Space-separated OAuth scopes — must include `openid` (default: `openid profile email`) |
| Auto-create Users | Create a Framerr account automatically on first OIDC login; if disabled, accounts must already exist and be linked manually |

**Callback URL:** register `<your-framerr-url>/api/auth/oidc/callback` in your identity provider's application settings.

:::tip
Built-in setup guides for **Authentik**, **Authelia**, and **Keycloak** are available directly in Settings → Auth → OpenID Connect.
:::

### 5. iFrame Auth (OAuth for Embedded Tabs)

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
