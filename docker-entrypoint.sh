#!/bin/sh
set -e

# PUID/PGID: control host file ownership. Default to root.
PUID=${PUID:-0}
PGID=${PGID:-0}

echo ""
echo "  Framerr"
echo "  PUID: $PUID"
echo "  PGID: $PGID"
echo "  TZ:   ${TZ:-UTC}"
echo ""

# Ensure data directories exist
mkdir -p /config /config/upload/temp /config/upload/profile-pictures /config/upload/custom-icons

# Migrate old custom icons if they exist
if [ -d "/config/custom-icons" ] && [ "$(ls -A /config/custom-icons 2>/dev/null)" ]; then
    echo "Migrating custom icons to new location..."
    cp -r /config/custom-icons/* /config/upload/custom-icons/ 2>/dev/null || true
    echo "Custom icons migrated"
fi

# Fix ownership (skip if running as root with default 0:0)
if [ "$PUID" != "0" ] || [ "$PGID" != "0" ]; then
    echo "Setting ownership on /config..."
    chown -R "$PUID:$PGID" /config 2>/dev/null || echo "Warning: Could not chown /config; continuing anyway"
fi

# Drop privileges if non-root PUID requested and we ARE root
if [ "$(id -u)" = "0" ] && [ "$PUID" != "0" ]; then
    echo "Starting Framerr (UID:$PUID, GID:$PGID)"
    exec su-exec "$PUID:$PGID" "$@"
else
    echo "Starting Framerr"
    exec "$@"
fi