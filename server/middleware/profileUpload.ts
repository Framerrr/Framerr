import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

// Determine temp upload directory based on environment
// Docker uses /config/upload/temp, dev uses local temp directory
const getTempDir = (): string => {
    const dockerPath = '/config/upload/temp';
    // Check if running in Docker (the config directory exists)
    if (fs.existsSync('/config')) {
        // Ensure temp directory exists
        if (!fs.existsSync(dockerPath)) {
            fs.mkdirSync(dockerPath, { recursive: true });
        }
        return dockerPath;
    }
    // Development - use local temp directory
    const devPath = path.join(__dirname, '../../temp-uploads');
    if (!fs.existsSync(devPath)) {
        fs.mkdirSync(devPath, { recursive: true });
    }
    return devPath;
};

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
    destination: (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
        cb(null, getTempDir());
    },
    filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
        // Use timestamp + random suffix to avoid conflicts
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Multer configuration for profile pictures
// No fileFilter here - validation happens at route level for better error messages
const profileUpload = multer({
    storage: storage,
    limits: {
        fileSize: 20 * 1024 * 1024 // 20MB limit (client compresses before upload)
    }
});

export default profileUpload;
