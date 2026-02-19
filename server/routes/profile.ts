import { Router, Request, Response, NextFunction } from 'express';
import { getUserById, updateUser, revokeAllUserSessions, createSession } from '../db/users';
import { getUserConfig, updateUserConfig } from '../db/userConfig';
import { hashPassword, verifyPassword } from '../auth/password';
import profileUpload from '../middleware/profileUpload';
import logger from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { invalidateUserSettings } from '../utils/invalidateUserSettings';

const router = Router();

// ============================================
// SERVER-SIDE COMPRESSION SETTINGS - Adjust as needed
// ============================================
const SERVER_COMPRESSION = {
    maxWidth: 512,       // Max width in pixels
    maxHeight: 512,      // Max height in pixels
    quality: 80,         // WebP quality (1-100)
    format: 'webp' as const,  // Output format
};
// ============================================

// Helper to get profile pictures directory (dev vs Docker)
const getProfilePicturesDir = async (): Promise<string> => {
    const dockerPath = '/config/upload/profile-pictures';
    // Check if running in Docker
    try {
        await fs.access('/config');
        // Ensure directory exists
        await fs.mkdir(dockerPath, { recursive: true });
        return dockerPath;
    } catch {
        // Development - use local directory
        const devPath = path.join(__dirname, '../public/profile-pictures');
        await fs.mkdir(devPath, { recursive: true });
        return devPath;
    }
};

// Helper to get base path for profile picture URLs
const getProfilePictureBasePath = (): string => {
    // In dev, images are served from /profile-pictures (Express static)
    // In Docker, they're served from /profile-pictures (Express static from /config/upload)
    return '/profile-pictures';
};

interface AuthenticatedUser {
    id: string;
    username: string;
    group: string;
}

type AuthenticatedRequest = Request & {
    user?: AuthenticatedUser;
    file?: Express.Multer.File;
};

interface ProfileBody {
    displayName?: string;
}

interface PasswordBody {
    currentPassword: string;
    newPassword: string;
}

// Middleware to check if user is authenticated
const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
    }
    next();
};

/**
 * GET /api/profile
 * Get current user's profile information
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const user = await getUserById(authReq.user!.id);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Get user config to fetch profilePicture and displayName
        const config = await getUserConfig(authReq.user!.id);
        const profilePicture = config.preferences?.profilePicture || null;
        const displayName = config.preferences?.displayName || user.username;

        res.json({
            id: user.id,
            username: user.username,
            group: user.group,
            profilePicture,
            displayName
        });
    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(`[Profile] Failed to get profile: user=${authReq.user?.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

/**
 * PUT /api/profile
 * Update user's profile (displayName)
 */
router.put('/', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { displayName } = req.body as ProfileBody;

        if (displayName !== undefined) {
            await updateUserConfig(authReq.user!.id, {
                preferences: {
                    displayName: displayName.trim() || null
                }
            });

            logger.info(`[Profile] Updated: user=${authReq.user!.id} displayName="${displayName}"`);
        }

        res.json({ success: true, message: 'Profile updated successfully' });

        // Broadcast after response
        invalidateUserSettings(authReq.user!.id, 'user-profile');
    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(`[Profile] Failed to update: user=${authReq.user?.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

/**
 * PUT /api/profile/password
 * Change user's password
 */
router.put('/password', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const { currentPassword, newPassword } = req.body as PasswordBody;

        if (!currentPassword || !newPassword) {
            res.status(400).json({ error: 'Current password and new password are required' });
            return;
        }

        if (newPassword.length < 6) {
            res.status(400).json({ error: 'New password must be at least 6 characters' });
            return;
        }

        // Get user to verify current password
        const user = await getUserById(authReq.user!.id);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Verify current password
        const isValid = await verifyPassword(currentPassword, user.passwordHash || '');
        if (!isValid) {
            logger.warn(`[Profile] Password change failed (invalid current): user=${authReq.user!.id}`);
            res.status(401).json({ error: 'Current password is incorrect' });
            return;
        }

        // Hash new password
        const newPasswordHash = await hashPassword(newPassword);

        // Update user
        await updateUser(authReq.user!.id, {
            passwordHash: newPasswordHash
        } as Parameters<typeof updateUser>[1]);

        // Invalidate all other sessions (security: revoke any compromised sessions)
        const currentSessionId = req.cookies?.sessionId;
        await revokeAllUserSessions(authReq.user!.id);

        // Re-create the current session so this user stays logged in
        if (currentSessionId) {
            const newSession = await createSession(authReq.user!.id, {
                ipAddress: req.ip || undefined,
                userAgent: req.headers['user-agent'] || undefined
            });
            res.cookie('sessionId', newSession.id, {
                httpOnly: true,
                secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
                sameSite: 'lax',
                maxAge: 86400000 // 24 hours
            });
        }

        logger.info(`[Profile] Password changed and sessions invalidated: user=${authReq.user!.id} username="${user.username}"`);

        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(`[Profile] Failed to change password: user=${authReq.user?.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

/**
 * POST /api/profile/picture
 * Upload profile picture
 */
router.post('/picture', requireAuth, profileUpload.single('profilePicture'), async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        if (!authReq.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
        if (!allowedTypes.includes(authReq.file.mimetype)) {
            await fs.unlink(authReq.file.path);
            res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed' });
            return;
        }

        // Get profile pictures directory
        const profilePicturesDir = await getProfilePicturesDir();

        // Generate unique filename - always use .webp since we convert
        const filename = `${authReq.user!.id}.webp`;
        const newPath = path.join(profilePicturesDir, filename);

        // Delete old profile picture if it exists
        const user = await getUserById(authReq.user!.id);
        const config = await getUserConfig(authReq.user!.id);
        const oldProfilePicture = config.preferences?.profilePicture as string | null | undefined;

        if (oldProfilePicture && typeof oldProfilePicture === 'string') {
            try {
                // Try to find and delete old file in the current profile pictures directory
                const oldFilename = path.basename(oldProfilePicture);
                const oldPath = path.join(profilePicturesDir, oldFilename);
                await fs.unlink(oldPath);
            } catch {
                // Old file might not exist, that's okay
            }
        }

        // Compress and resize image using sharp, then save
        const originalSize = authReq.file.size;
        await sharp(authReq.file.path)
            .resize(SERVER_COMPRESSION.maxWidth, SERVER_COMPRESSION.maxHeight, {
                fit: 'cover',
                position: 'center'
            })
            .webp({ quality: SERVER_COMPRESSION.quality })
            .toFile(newPath);

        // Remove the temp uploaded file
        await fs.unlink(authReq.file.path);

        // Get compressed file size for logging
        const compressedStats = await fs.stat(newPath);
        logger.info(`[Profile] Picture uploaded: user=${authReq.user!.id} original=${(originalSize / 1024).toFixed(1)}KB compressed=${(compressedStats.size / 1024).toFixed(1)}KB`);

        // Update user preferences with profile picture path
        const profilePicturePath = `/profile-pictures/${filename}`;
        await updateUserConfig(authReq.user!.id, {
            preferences: {
                profilePicture: profilePicturePath
            }
        });

        res.json({
            success: true,
            profilePicture: profilePicturePath
        });

        // Broadcast after response
        invalidateUserSettings(authReq.user!.id, 'user-profile');
    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(`[Profile] Failed to upload picture: user=${authReq.user?.id} error="${(error as Error).message}"`);

        // Clean up on error
        if (authReq.file) {
            try {
                await fs.unlink(authReq.file.path);
            } catch {
                // Ignore cleanup errors
            }
        }

        res.status(500).json({ error: 'Failed to upload profile picture' });
    }
});

/**
 * DELETE /api/profile/picture
 * Remove profile picture
 */
router.delete('/picture', requireAuth, async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const user = await getUserById(authReq.user!.id);
        const config = await getUserConfig(authReq.user!.id);
        const profilePicture = config.preferences?.profilePicture as string | null | undefined;

        if (profilePicture && typeof profilePicture === 'string') {
            // Delete the file
            try {
                if (profilePicture.startsWith('/profile-pictures/')) {
                    const filePath = path.join('/config/upload', profilePicture);
                    await fs.unlink(filePath);
                } else {
                    const filePath = path.join(__dirname, '../public', profilePicture);
                    await fs.unlink(filePath);
                }
            } catch {
                // File might not exist, that's okay
            }

            // Update user preferences to remove profile picture
            await updateUserConfig(authReq.user!.id, {
                preferences: {
                    profilePicture: null
                }
            });
        }

        logger.info(`[Profile] Picture removed: user=${authReq.user!.id}`);

        res.json({ success: true, message: 'Profile picture removed' });

        // Broadcast after response
        invalidateUserSettings(authReq.user!.id, 'user-profile');
    } catch (error) {
        const authReq = req as AuthenticatedRequest;
        logger.error(`[Profile] Failed to remove picture: user=${authReq.user?.id} error="${(error as Error).message}"`);
        res.status(500).json({ error: 'Failed to remove profile picture' });
    }
});

export default router;

