#!/bin/sh
set -e

# Get PUID/PGID from environment (default to Unraid standard: 99/100)  
PUID=${PUID:-99}
PGID=${PGID:-100}

echo ""
echo ""
echo "  Framerr - Starting Container"
echo ""
echo "  PUID: $PUID"
echo "  PGID: $PGID"
echo "  TZ:   ${TZ:-UTC}"
echo ""
echo ""

# Update user/group IDs if they don't match defaults
if [ "$PUID" != "10000" ] || [ "$PGID" != "10000" ]; then
    echo "Updating user permissions to PUID=$PUID, PGID=$PGID..."
    
    # Delete existing framerr user/group
    deluser framerr 2>/dev/null || true
    delgroup framerr 2>/dev/null || true
    
    # --- Handle GID ---
    if ! getent group "$PGID" > /dev/null 2>&1; then
        addgroup -g "$PGID" framerr
        TARGET_GROUP="framerr"
    else
        # GID already exists — reuse existing group
        TARGET_GROUP=$(getent group "$PGID" | cut -d: -f1)
        echo "GID $PGID already in use by group '$TARGET_GROUP', using existing group"
    fi
    
    # --- Handle UID ---
    if ! getent passwd "$PUID" > /dev/null 2>&1; then
        # UID available — create framerr user with it
        adduser -D -u "$PUID" -G "$TARGET_GROUP" framerr
    else
        # UID already exists — reuse existing user
        EXISTING_USER=$(getent passwd "$PUID" | cut -d: -f1)
        echo "UID $PUID already in use by user '$EXISTING_USER', reusing as framerr"
        
        # Create a symlink-like alias: make 'framerr' point to the existing user
        # by just using the existing user for ownership instead
        # We still need a 'framerr' user for su-exec, so create with a different UID
        adduser -D -G "$TARGET_GROUP" framerr 2>/dev/null || true
        
        # Update framerr's UID to match the requested PUID
        sed -i "s/^framerr:x:[0-9]*:/framerr:x:${PUID}:/" /etc/passwd
    fi
fi

# Ensure /config exists and has correct permissions
if [ ! -d "/config" ]; then
    echo "Creating /config directory..."
    mkdir -p /config
fi

echo "Setting ownership on /config..."
chown -R $PUID:$PGID /config

# Create upload directories if they don't exist
echo "Creating upload directories..."
mkdir -p /config/upload/temp
mkdir -p /config/upload/profile-pictures
mkdir -p /config/upload/custom-icons

# Migrate old custom icons if they exist
if [ -d "/config/custom-icons" ] && [ "$(ls -A /config/custom-icons 2>/dev/null)" ]; then
    echo "Migrating custom icons to new location..."
    cp -r /config/custom-icons/* /config/upload/custom-icons/ 2>/dev/null || true
    echo "Custom icons migrated successfully"
fi

# Also ensure app directory ownership
chown -R $PUID:$PGID /app

# Ensure /config directory and all contents have correct ownership
echo "Ensuring /config has correct permissions..."
chown -R $PUID:$PGID /config

# AUTO-MIGRATION: Check if JSON files exist and database doesn't
echo ""
echo "Checking for database migration..."
if [ -f "/config/users.json" ] && [ ! -f "/config/.migration-complete" ]; then
    echo "JSON files detected - running automatic migration to SQLite..."
    echo "This will preserve all your data in the new database format."
    echo ""
    
    # Run migration as framerr user
    if su-exec framerr node /app/server/scripts/migrate-to-sqlite.js; then
        echo ""
        echo "✓ Migration successful!"
        echo "  Creating marker file to prevent re-migration..."
        su-exec framerr touch /config/.migration-complete
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

echo "Starting Framerr as user: framerr (UID:$PUID, GID:$PGID)"
echo ""

# Execute the command as the framerr user
exec su-exec framerr "$@"