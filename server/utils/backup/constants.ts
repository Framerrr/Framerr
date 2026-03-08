/**
 * Backup Module — Constants
 *
 * Shared constants and asset path resolution for the backup system.
 */

import fs from 'fs';
import path from 'path';

// Environment paths
export const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
export const DB_PATH = process.env.FRAMERR_DB_PATH || path.join(DATA_DIR, 'framerr.db');

// Docker detection
export const DOCKER_CONFIG = '/config';
export const isDocker = fs.existsSync(DOCKER_CONFIG);

// Backup storage directory
export const BACKUPS_DIR = isDocker
    ? path.join(DOCKER_CONFIG, 'backups')
    : path.join(DATA_DIR, 'backups');

/**
 * Get asset directories (relative to DATA_DIR or Docker paths)
 */
export function getAssetPaths() {
    const base = isDocker ? DOCKER_CONFIG : DATA_DIR;
    return {
        profilePictures: isDocker
            ? path.join(DOCKER_CONFIG, 'upload', 'profile-pictures')
            : path.join(__dirname, '..', '..', 'public', 'profile-pictures'),
        customIcons: isDocker
            ? path.join(DOCKER_CONFIG, 'upload', 'custom-icons')
            : path.join(DATA_DIR, 'upload', 'custom-icons'),
        favicon: path.join(base, 'public', 'favicon')
    };
}
