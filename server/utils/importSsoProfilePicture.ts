/**
 * SSO Profile Picture Auto-Import
 * 
 * Downloads and saves profile pictures from SSO providers (OIDC, Plex)
 * when users log in or link accounts. Fire-and-forget — never blocks auth flows.
 * 
 * Only sets profile picture if the user doesn't already have one.
 */
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { getUserConfig, updateUserConfig } from '../db/userConfig';
import { invalidateUserSettings } from './invalidateUserSettings';
import logger from './logger';

// Same compression settings as profile.ts upload flow
const COMPRESSION = {
    maxWidth: 512,
    maxHeight: 512,
    quality: 80,
    format: 'webp' as const,
};

// Safety limits for remote downloads
const MAX_DOWNLOAD_SIZE = 5 * 1024 * 1024; // 5MB
const DOWNLOAD_TIMEOUT_MS = 5_000; // 5 seconds (synchronous — blocks auth response)

/**
 * Get profile pictures directory (dev vs Docker)
 * Mirrors the logic in profile.ts
 */
async function getProfilePicturesDir(): Promise<string> {
    const dockerPath = '/config/upload/profile-pictures';
    try {
        await fs.access('/config');
        await fs.mkdir(dockerPath, { recursive: true });
        return dockerPath;
    } catch {
        const devPath = path.join(__dirname, '../public/profile-pictures');
        await fs.mkdir(devPath, { recursive: true });
        return devPath;
    }
}

/**
 * Import a profile picture from an SSO provider URL.
 * 
 * - Skips if user already has a profile picture
 * - Downloads, resizes (512x512), converts to WebP
 * - Saves to local profile-pictures directory
 * - Updates user_config.preferences.profilePicture
 * 
 * Designed to be called fire-and-forget — catches all errors internally.
 */
export async function importSsoProfilePicture(userId: string, avatarUrl: string | undefined | null): Promise<boolean> {
    if (!avatarUrl) return false;

    try {
        // Check if user already has a profile picture — never overwrite manual uploads
        const config = await getUserConfig(userId);
        if (config.preferences?.profilePicture) {
            logger.debug(`[SSOAvatar] Skipping import — user already has profile picture: userId="${userId}"`);
            return false;
        }

        // Validate URL scheme — only allow http/https (reject file://, ftp://, data:, etc.)
        try {
            const parsed = new URL(avatarUrl);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                logger.warn(`[SSOAvatar] Rejected non-HTTP URL scheme: userId="${userId}" scheme="${parsed.protocol}"`);
                return false;
            }
        } catch {
            logger.warn(`[SSOAvatar] Invalid avatar URL: userId="${userId}" url="${avatarUrl.substring(0, 80)}"`);
            return false;
        }

        // Download the image with safety limits
        const response = await fetch(avatarUrl, {
            signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
            headers: {
                'Accept': 'image/*',
            },
        });

        if (!response.ok) {
            logger.warn(`[SSOAvatar] Download failed: userId="${userId}" status=${response.status} url="${avatarUrl}"`);
            return false;
        }

        // Check content-length if available
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength, 10) > MAX_DOWNLOAD_SIZE) {
            logger.warn(`[SSOAvatar] Image too large: userId="${userId}" size=${contentLength} max=${MAX_DOWNLOAD_SIZE}`);
            return false;
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        // Safety check on actual size
        if (buffer.length > MAX_DOWNLOAD_SIZE) {
            logger.warn(`[SSOAvatar] Downloaded image too large: userId="${userId}" size=${buffer.length}`);
            return false;
        }

        if (buffer.length === 0) {
            logger.warn(`[SSOAvatar] Empty image response: userId="${userId}"`);
            return false;
        }

        // Process with sharp — same pipeline as profile.ts upload
        const profilePicturesDir = await getProfilePicturesDir();
        const filename = `${userId}.webp`;
        const outputPath = path.join(profilePicturesDir, filename);

        await sharp(buffer)
            .resize(COMPRESSION.maxWidth, COMPRESSION.maxHeight, {
                fit: 'cover',
                position: 'center',
            })
            .webp({ quality: COMPRESSION.quality })
            .toFile(outputPath);

        // Update user preferences
        const profilePicturePath = `/profile-pictures/${filename}`;
        await updateUserConfig(userId, {
            preferences: {
                profilePicture: profilePicturePath,
            },
        });

        const stats = await fs.stat(outputPath);
        logger.info(`[SSOAvatar] Imported: userId="${userId}" size=${(stats.size / 1024).toFixed(1)}KB source="${avatarUrl.substring(0, 80)}"`);

        // Broadcast SSE invalidation so sidebar/mobile bar updates without refresh
        invalidateUserSettings(userId, 'user-profile');

        return true;
    } catch (error) {
        // Never let avatar import failures affect login/setup
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`[SSOAvatar] Import failed (non-blocking): userId="${userId}" error="${message}"`);
        return false;
    }
}
