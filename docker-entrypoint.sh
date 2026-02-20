#!/bin/sh
set -e

# Get PUID/PGID from environment (default to Unraid standard: 99/100)
PUID=${PUID:-99}
PGID=${PGID:-100}

# Detect if running as root (needed for user setup and su-exec)
IS_ROOT=0
[ "$(id -u)" -eq 0 ] && IS_ROOT=1

# Helper: run a command as PUID:PGID (via su-exec if root, directly if not)
RUN_AS() {
    if [ "$IS_ROOT" -eq 1 ]; then
        su-exec "$PUID:$PGID" "$@"
    else
        "$@"
    fi
}

echo ""
echo "  Framerr - Starting Container"
echo "  PUID: $PUID"
echo "  PGID: $PGID"
echo "  TZ:   ${TZ:-UTC}"
echo ""

# Only handle user/group creation and chown when running as root.
# If the container was started with Docker's user: field, we skip all
# of this since Docker already set the user.
if [ "$IS_ROOT" -eq 1 ]; then

    # Clean up Dockerfile's default framerr user/group (UID/GID 10000)
    # so we can recreate with the requested PUID/PGID
    deluser framerr 2>/dev/null || true
    delgroup framerr 2>/dev/null || true

    # --- Handle GID ---
    if getent group "$PGID" >/dev/null 2>&1; then
        TARGET_GROUP=$(getent group "$PGID" | cut -d: -f1)
        echo "GID $PGID already in use by group '$TARGET_GROUP', will run with numeric IDs"
    else
        addgroup -g "$PGID" framerr
        TARGET_GROUP="framerr"
    fi

    # --- Handle UID ---
    if getent passwd "$PUID" >/dev/null 2>&1; then
        EXISTING_USER=$(getent passwd "$PUID" | cut -d: -f1)
        echo "UID $PUID already in use by user '$EXISTING_USER', will run with numeric IDs"
    else
        adduser -D -u "$PUID" -G "$TARGET_GROUP" framerr
    fi

    # --- Ensure directories and ownership ---
    mkdir -p /config
    mkdir -p /config/upload/temp
    mkdir -p /config/upload/profile-pictures
    mkdir -p /config/upload/custom-icons

    echo "Setting ownership on /config..."
    chown -R "$PUID:$PGID" /config

    # Migrate old custom icons if they exist
    if [ -d "/config/custom-icons" ] && [ "$(ls -A /config/custom-icons 2>/dev/null)" ]; then
        echo "Migrating custom icons to new location..."
        cp -r /config/custom-icons/* /config/upload/custom-icons/ 2>/dev/null || true
        echo "Custom icons migrated successfully"
    fi

else
    echo "Not running as root; skipping user/group setup and chown."
    mkdir -p /config /config/upload/temp /config/upload/profile-pictures /config/upload/custom-icons
fi

# --- AUTO-MIGRATION: JSON to SQLite ---
echo ""
echo "Checking for database migration..."
if [ -f "/config/users.json" ] && [ ! -f "/config/.migration-complete" ]; then
    echo "JSON files detected - running automatic migration to SQLite..."
    echo "This will preserve all your data in the new database format."
    echo ""

    if RUN_AS node /app/server/scripts/migrate-to-sqlite.js; then
        echo ""
        echo "✓ Migration successful!"
        RUN_AS touch /config/.migration-complete
        echo "  ✓ Migration complete"
    else
        echo ""
        echo "⚠️  Migration failed - server will start but may not work correctly"
        echo "    Please check logs and report this issue"
    fi
elif [ -f "/config/.migration-complete" ]; then
    echo "Database already migrated (marker file exists)"
else
    echo "No JSON files found - starting with fresh SQLite database"
fi
echo ""

# --- Start the app ---
echo "Starting Framerr (UID:$PUID, GID:$PGID)"
echo ""
if [ "$IS_ROOT" -eq 1 ]; then
    exec su-exec "$PUID:$PGID" "$@"
else
    exec "$@"
fi