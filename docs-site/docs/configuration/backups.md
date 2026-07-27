---
sidebar_position: 2
---

# Backups & Restore

Framerr includes a built-in backup system that creates portable ZIP archives of your entire configuration. Backups can be scheduled automatically, or triggered manually. Backups can also be optionally password-protected — see [Encrypted Backups](#encrypted-backups) below.
## Creating a Backup

Go to **Settings → Advanced → Backups** and click **Create Backup**.

Backups are stored on the server inside the `/config/backups/` directory. You can also download them directly from the UI.

## Scheduled Backups

Automatic backups can be configured in **Settings → Advanced → Backups → Schedule**:

| Setting | Options | Description |
|---------|---------|-------------|
| Frequency | Daily / Weekly | How often to back up |
| Time | 12:00 AM – 11:00 PM | Hour of day to run the backup |
| Day of week | Sunday – Saturday | Only for weekly backups |
| Max backups | 1 – 30 | Number of backups to keep (oldest are auto-deleted) |

**Catch-up backups:** If the server was offline when a scheduled backup was due, Framerr will automatically run it on the next startup.

## What's Included

Each backup ZIP contains:

| Item | Description |
|------|-------------|
| `framerr.db` | Full SQLite database (users, settings, widgets, integrations, layouts) |
| `profile-pictures/` | User profile images |
| `custom-icons/` | Custom user-uploaded icons |
| `favicon/` | Custom favicon files (if configured) |
| `manifest.json` | Backup metadata (version, type, timestamp, what's included) |

### What's NOT Included

These are automatically purged on restore since they're instance-specific or regenerated automatically:

- Media library cache and sync status
- Active sessions (you'll need to log in again)
- Push notification subscriptions
- Notification history
- Service monitor history and aggregates
- Media search history

:::caution Backups Contain Plaintext Credentials
Because backups decrypt credentials for portability, the backup file contains your integration API keys, tokens, and passwords **in plaintext** unless [backup encryption](#encrypted-backups) is enabled. Treat backup files like passwords — don't share them publicly or store them somewhere untrusted.
:::

## Restoring a Backup

You can restore a backup during **initial setup** — when you create a new Framerr container (or reset an existing one), the setup wizard gives you two choices:

1. **Start Fresh** — Create a new dashboard from scratch
2. **Restore from Backup** — Upload your backup file to restore your previous configuration

Upload your backup file and Framerr will restore your database, users, widgets, and assets.



### After Restoring

1. You'll be redirected to the login page — log in with the credentials from the backup
2. Integration credentials are re-encrypted with your current encryption key
3. Media library caches will rebuild automatically on next poll
4. Desktop layouts and widget positions are preserved

### Managing Backups

To **create, download, or delete** backups on a running instance, go to **Settings → Advanced → Backups**.

## Backup Types

| Type | Created By | Counted in Max Backups |
|------|-----------|----------------------|
| **Manual** | You, via the UI | ✅ Yes |
| **Scheduled** | Automatic schedule | ✅ Yes |
| **Safety** | Auto-created before restore | ❌ No (never auto-deleted) |

Safety backups are never cleaned up by the auto-delete system, so you always have a recovery point.

## Encrypted Backups

Backups can optionally be encrypted with a password. Encrypted backups use the `.framerr-backup` extension instead of `.zip` and require the password to restore.

**Enable in:** Settings → Advanced → Backups → Encryption

- Choose a password (minimum 8 characters) — new backups are encrypted from that point on
- Existing `.zip` backups are **not** retroactively encrypted, and disabling encryption does **not** decrypt existing `.framerr-backup` files
- **Change Password** re-wraps server-stored encrypted backups with the new password; backups you've already downloaded still need whatever password was active when you downloaded them
- Encrypted backups show a lock icon in the backup list

:::caution Don't Lose Your Password
There's no recovery if you forget your backup password. Write it down somewhere safe.
:::

### Restoring an Encrypted Backup

The setup wizard detects encrypted backups automatically and prompts for the password. After several incorrect attempts, you'll need to re-upload the file and try again.

## Backup Storage Location

| Environment | Path |
|-------------|------|
| Docker | `/config/backups/` |
| Development | `server/data/backups/` |

Make sure your `/config` volume is mounted to persistent storage on your host so backups survive container recreation.

