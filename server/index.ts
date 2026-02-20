/**
 * Framerr - Server Entry Point
 * 
 * Main server application using Express.js
 */

// Load environment variables from .env file (development only)
import 'dotenv/config';

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { createServer } from 'http';
import { initializeIntegrationManager, shutdownIntegrationManager } from './services/IntegrationManager';

import logger from './utils/logger';
import { getSystemConfig } from './db/systemConfig';
import { getUser, createUser, getUserById } from './db/users';
import { getUserConfig } from './db/userConfig';
import { hashPassword } from './auth/password';
import { validateSession } from './auth/session';
import { validateProxyWhitelist } from './middleware/proxyWhitelist';
import { csrfProtection } from './middleware/csrfProtection';
import { authRateLimit } from './middleware/rateLimit';
import { isInitialized, getDb } from './database/db';
import { checkMigrationStatus, runMigrations, setVersion, MigrationStatus, MigrationResult } from './database/migrator';


// Route imports
import setupRoutes from './routes/setup';
import authRoutes from './routes/auth';
import profileRoutes from './routes/profile';
import configRoutes from './routes/config';
import adminRoutes from './routes/admin';
import systemRoutes from './routes/system';
import integrationsRoutes from './routes/integrations';
import tabsRoutes from './routes/tabs';
import tabGroupsRoutes from './routes/tabGroups';
import widgetsRoutes from './routes/widgets';
import themeRoutes from './routes/theme';
import backupRoutes from './routes/backup';
import customIconsRoutes from './routes/custom-icons';
import advancedRoutes from './routes/advanced';
import diagnosticsRoutes from './routes/diagnostics';
import notificationsRoutes from './routes/notifications';
import plexRoutes from './routes/plex';
import plexSetupRoutes from './routes/plexSetup';
import linkedAccountsRoutes from './routes/linkedAccounts';
import webhooksRoutes from './routes/webhooks';
import requestActionsRoutes from './routes/requestActions';
import templatesRoutes from './routes/templates';
import realtimeRoutes from './routes/realtime';
// Legacy proxy routes removed - now using modular /api/integrations/:id/proxy/* pattern
import serviceMonitorsRoutes from './routes/serviceMonitors';
import widgetSharesRoutes from './routes/widgetShares';
import userGroupsRoutes from './routes/userGroups';
import cacheRoutes from './routes/cache';
import mediaRoutes from './routes/media';
import jobsRoutes from './routes/jobs';
import iconsRoutes from './routes/icons';
import metricHistoryRoutes from './routes/metricHistory';
import plexRecommendationsRoutes from './routes/plex-recommendations';
import walkthroughRoutes from './routes/walkthrough';


// Type for package.json version
interface PackageJson {
    version: string;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version }: PackageJson = require('./package.json');

// Initialize Express app
const app = express();

// Trust first proxy hop (nginx/traefik in front of Framerr)
// This ensures req.ip returns the actual client IP, not the proxy IP
app.set('trust proxy', 1);

// Environment configuration
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Body parsing middleware - increased limit for base64 image uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Proxy whitelist validation (must be before session middleware)
app.use(validateProxyWhitelist());

// Security middleware - configured for HTTP Docker deployments
app.use(helmet({
    contentSecurityPolicy: false,  // Disable CSP that forces HTTPS
    hsts: false,  // Disable HSTS in non-HTTPS environments
    crossOriginOpenerPolicy: false,  // Disable COOP warnings on HTTP
    crossOriginEmbedderPolicy: false,  // Disable COEP warnings on HTTP
    originAgentCluster: false  // Disable to prevent inconsistent header warnings
}));
app.use(cors({
    origin: false,  // Same-origin only — prevents cross-site credentialed API calls
    credentials: true
}));

// CSRF protection (requires X-Framerr-Client header on POST/PUT/DELETE)
app.use(csrfProtection());

// Rate limiting for auth endpoints only (brute force protection)
// Proxy/API endpoints are protected by authentication instead
app.use('/api/auth/login', authRateLimit);
app.use('/api/auth/plex-login', authRateLimit);

// Global session middleware - proxy auth takes precedence over local session
app.use(async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Load fresh config from DB to respect runtime toggle changes
        const systemConfig = await getSystemConfig();

        // Try proxy auth first (if enabled and headers present)
        if (systemConfig?.auth?.proxy?.enabled) {
            // Get configured header names (with fallbacks to Authentik defaults)
            const headerName = (systemConfig.auth.proxy.headerName || 'X-authentik-username').toLowerCase();
            const emailHeaderName = (systemConfig.auth.proxy.emailHeaderName || 'X-authentik-email').toLowerCase();

            // Check configured header first, then common fallbacks
            const username = (req.headers[headerName] ||
                req.headers['x-forwarded-user'] ||
                req.headers['remote-user']) as string | undefined;
            const email = (req.headers[emailHeaderName] ||
                req.headers['x-forwarded-email'] ||
                req.headers['remote-email']) as string | undefined;

            if (username) {
                let user = await getUser(username);

                // Auto-create user from proxy auth if doesn't exist
                if (!user) {
                    logger.info(`[ProxyAuth] Auto-creating user: ${username}`);
                    const passwordHash = await hashPassword('PROXY_AUTH_PLACEHOLDER');

                    user = await createUser({
                        username,
                        email: email || `${username}@proxy.local`,
                        passwordHash,  // createUser expects passwordHash, not password
                        group: 'user'  // New proxy users are regular users by default
                    });
                }

                req.user = user as unknown as Express.Request['user'];
                req.proxyAuth = true;  // Flag to indicate proxy auth was used
                return next();
            }
        }

        // Fall back to session-based auth if proxy auth not used
        const sessionId = req.cookies?.sessionId;
        if (sessionId) {
            const session = await validateSession(sessionId);
            if (session) {
                const user = await getUserById(session.userId);
                if (user) {
                    req.user = user as unknown as Express.Request['user'];
                }
            }
        }
    } catch (error) {
        logger.error(`[Auth Middleware] error="${(error as Error).message}" name=${(error as Error).name}`);
    }
    next();
});

// Request logging middleware (only in development)
if (NODE_ENV !== 'production') {
    app.use((req: Request, res: Response, next: NextFunction) => {
        logger.debug(`[Request] ${req.method} ${req.path} ip=${req.ip} authenticated=${!!req.user}`);
        next();
    });
}

// Serve static files with CORS for proxy compatibility

// Default Framerr favicons (always available, never deleted)
// Always serve from server's public folder (these are bundled with the server, not the frontend)
const defaultFaviconPath = path.join(__dirname, 'public/favicon-default');
app.use('/favicon-default', cors(), express.static(defaultFaviconPath));

// Custom user favicons (uploaded via Settings UI)
// ALWAYS serve from DATA_DIR for persistence across container restarts
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const customFaviconPath = path.join(DATA_DIR, 'public/favicon');
// Ensure directory exists
if (!fs.existsSync(customFaviconPath)) {
    fs.mkdirSync(customFaviconPath, { recursive: true });
}

// Favicon with fallback: custom (if enabled) → default
app.use('/favicon', cors(), async (req: Request, res: Response) => {
    try {
        // Check if custom favicon is enabled in config
        const systemConfig = await getSystemConfig();
        const customEnabled = systemConfig.favicon?.enabled === true &&
            systemConfig.favicon?.htmlSnippet;

        if (customEnabled) {
            const customFile = path.join(customFaviconPath, req.path);
            if (fs.existsSync(customFile)) {
                // Short cache to allow relatively quick updates
                res.setHeader('Cache-Control', 'public, max-age=300');
                return res.sendFile(customFile);
            }
            // Custom enabled but this specific file missing - fall through to default
        }

        // Default Framerr favicon (always available as fallback)
        const defaultFile = path.join(defaultFaviconPath, req.path);
        if (fs.existsSync(defaultFile)) {
            res.setHeader('Cache-Control', 'public, max-age=300');
            return res.sendFile(defaultFile);
        }

        res.status(404).json({ error: 'Favicon not found' });
    } catch (error) {
        // On config error, fallback to default
        logger.error(`[Favicon] Route error: error="${(error as Error).message}"`);
        const defaultFile = path.join(defaultFaviconPath, req.path);
        if (fs.existsSync(defaultFile)) {
            return res.sendFile(defaultFile);
        }
        res.status(500).json({ error: 'Failed to serve favicon' });
    }
});

// Profile pictures - serve from different paths based on environment
const profilePicsDockerPath = '/config/upload/profile-pictures';
const profilePicsDevPath = path.join(__dirname, 'public/profile-pictures');
// Ensure dev directory exists
if (!fs.existsSync('/config') && !fs.existsSync(profilePicsDevPath)) {
    fs.mkdirSync(profilePicsDevPath, { recursive: true });
}
const profilePicsPath = fs.existsSync('/config') ? profilePicsDockerPath : profilePicsDevPath;
app.use('/profile-pictures', cors(), express.static(profilePicsPath));

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
    const healthData: Record<string, string> = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version,
        environment: NODE_ENV
    };

    // Only expose logLevel to authenticated users
    if (req.user) {
        healthData.logLevel = process.env.LOG_LEVEL || 'info';
    }

    res.json(healthData);
});

// Routes
app.use('/api/auth/setup', setupRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/config', configRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/tabs', tabsRoutes);
app.use('/api/tab-groups', tabGroupsRoutes);
app.use('/api/widgets', widgetsRoutes);
app.use('/api/theme', themeRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/custom-icons', customIconsRoutes);
app.use('/api/advanced', advancedRoutes);
app.use('/api/diagnostics', diagnosticsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/plex', plexRoutes);
app.use('/api/auth/plex-setup', plexSetupRoutes);
app.use('/api/linked-accounts', linkedAccountsRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/request-actions', requestActionsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/realtime', realtimeRoutes);
app.use('/api/service-monitors', serviceMonitorsRoutes);
app.use('/api/widget-shares', widgetSharesRoutes);
app.use('/api/user-groups', userGroupsRoutes);
app.use('/api/cache', cacheRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/icons', iconsRoutes);
app.use('/api/metric-history', metricHistoryRoutes);
app.use('/api/plex/recommendations', plexRecommendationsRoutes);
app.use('/api/walkthrough', walkthroughRoutes);


// Theme splash color map — server injects these into index.html template
const THEME_SPLASH_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
    'dark-pro': { bg: '#0a0e1a', text: '#94a3b8', accent: '#3b82f6' },
    'light': { bg: '#ffffff', text: '#6b7280', accent: '#3b82f6' },
    'nord': { bg: '#2e3440', text: '#81a1c1', accent: '#88c0d0' },
    'catppuccin': { bg: '#1e1e2e', text: '#bac2de', accent: '#89b4fa' },
    'dracula': { bg: '#282a36', text: '#e6e6e6', accent: '#bd93f9' },
    'noir': { bg: '#0f0f12', text: '#888888', accent: '#8a9ba8' },
    'nebula': { bg: '#0d0d1a', text: '#94a3b8', accent: '#a855f7' },
};
const DEFAULT_SPLASH_COLORS = THEME_SPLASH_COLORS['dark-pro'];

// In production, serve built frontend
if (NODE_ENV === 'production') {
    // In compiled TypeScript, __dirname is server/dist/server, so go up to app root then into dist
    // Production: /app/server/dist/server -> /app/dist
    const distPath = path.join(__dirname, '../../../dist');

    // Cache the HTML template for theme injection
    let indexHtmlTemplate: string | null = null;

    // Service Worker - prevent caching to ensure updates are picked up
    app.get('/sw.js', (req: Request, res: Response) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Content-Type', 'application/javascript');
        res.sendFile(path.join(distPath, 'sw.js'));
    });

    // Serve static files
    app.use(express.static(distPath));

    // OAuth callback route - serve login-complete.html directly
    app.get('/login-complete', (req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'login-complete.html'));
    });

    // SPA fallback - inject user's theme into index.html before sending
    app.get('*', async (req: Request, res: Response, next: NextFunction) => {
        // Skip API routes and static assets
        if (req.path.startsWith('/api') || req.path.startsWith('/favicon') || req.path.startsWith('/profile-pictures')) {
            return next();
        }

        try {
            // Load template once and cache
            if (!indexHtmlTemplate) {
                indexHtmlTemplate = fs.readFileSync(path.join(distPath, 'index.html'), 'utf8');
            }

            // Determine splash theme for this request
            let themeName = 'dark-pro';
            let splashColors = DEFAULT_SPLASH_COLORS;

            if (req.user) {
                // Authenticated — use the user's personal theme
                try {
                    const userId = (req.user as { id?: string }).id;
                    if (userId) {
                        const config = await getUserConfig(userId);
                        const userTheme = (config?.theme as { preset?: string; mode?: string; customColors?: Record<string, string> });
                        const preset = userTheme?.preset || userTheme?.mode || 'dark-pro';
                        themeName = preset;

                        if (preset === 'custom' && userTheme?.customColors?.['bg-primary']) {
                            splashColors = {
                                bg: userTheme.customColors['bg-primary'],
                                text: userTheme.customColors['text-secondary'] || DEFAULT_SPLASH_COLORS.text,
                                accent: userTheme.customColors['accent'] || DEFAULT_SPLASH_COLORS.accent,
                            };
                        } else {
                            splashColors = THEME_SPLASH_COLORS[preset] || DEFAULT_SPLASH_COLORS;
                        }
                    }
                } catch (err) {
                    logger.debug(`[SPA] Could not load user theme, using default: ${(err as Error).message}`);
                }
            } else {
                // Not authenticated — use loginTheme from system config (admin's theme)
                try {
                    const sysConfig = await getSystemConfig();
                    const loginTheme = sysConfig.loginTheme || 'dark-pro';
                    themeName = loginTheme;
                    splashColors = THEME_SPLASH_COLORS[loginTheme] || DEFAULT_SPLASH_COLORS;
                } catch {
                    // Fall through to defaults
                }
            }

            // Inject theme into template
            const html = indexHtmlTemplate
                .replace('{{SPLASH_THEME}}', themeName)
                .replace('{{SPLASH_BG}}', splashColors.bg)
                .replace('{{SPLASH_TEXT}}', splashColors.text)
                .replace('{{SPLASH_ACCENT}}', splashColors.accent);

            res.setHeader('Content-Type', 'text/html');
            res.send(html);
        } catch (err) {
            logger.error(`[SPA] Failed to serve index.html: ${(err as Error).message}`);
            // Fallback to static file
            res.sendFile(path.join(distPath, 'index.html'));
        }
    });
}

// Root API endpoint (will be overridden by SPA in production)
app.get('/', (req: Request, res: Response) => {
    res.json({
        message: 'Framerr API',
        version,
        endpoints: {
            health: '/api/health'
        }
    });
});

// 404 handler
app.use((req: Request, res: Response) => {
    logger.warn(`[Router] 404 Not Found: path=${req.path} method=${req.method}`);
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: 'Endpoint not found'
        }
    });
});

// Error handling middleware
interface ServerError extends Error {
    status?: number;
    code?: string;
}

app.use((err: ServerError, req: Request, res: Response, next: NextFunction) => {
    logger.error(`[Server] Error: path=${req.path} error="${err.message}"`);

    res.status(err.status || 500).json({
        success: false,
        error: {
            code: err.code || 'INTERNAL_ERROR',
            message: NODE_ENV === 'production'
                ? 'An error occurred'
                : err.message
        }
    });
});

// Start server with proper async initialization
(async () => {
    try {
        // Print banner first - before any other output
        logger.startup('Framerr', { version, env: NODE_ENV });

        // Validate encryption setup FIRST in production
        // This ensures we fail early with clear instructions if SECRET_ENCRYPTION_KEY is missing
        if (NODE_ENV === 'production') {
            const { encrypt } = await import('./utils/encryption');
            // Trigger encryption key validation by calling encrypt with test data
            // This will exit with clear instructions if key is not set
            try {
                encrypt('startup-validation-test');
            } catch {
                // encrypt() calls process.exit(1) if key is missing, so we won't reach here
                // But if we do, something unexpected happened
                logger.error('Encryption validation failed unexpectedly');
                process.exit(1);
            }
            logger.info('Encryption key validated');
        }

        // Initialize database schema if this is a fresh database
        if (!isInitialized()) {
            // Fresh databases start at v0 and run all migrations
            const result = runMigrations(getDb()) as MigrationResult;
            if (!result.success) {
                logger.error(`[Startup] Migration failed: error="${result.error}"`);
                process.exit(1);
            }
            logger.info(`Database ready (v${result.migratedTo}, ${result.migratedTo} migrations applied)`);
        } else {
            // Check if migrations are needed
            const status = checkMigrationStatus(getDb()) as MigrationStatus;

            if (status.isDowngrade) {
                // Database is newer than app expects - refuse to start
                logger.error(`Database schema (v${status.currentVersion}) is newer than this version of Framerr expects (v${status.expectedVersion}).`);
                logger.error('Please upgrade Framerr or restore from a backup.');
                process.exit(1);
            }

            if (status.needsMigration) {
                const result = runMigrations(getDb()) as MigrationResult;

                if (!result.success) {
                    logger.error(`[Startup] Migration failed: error="${result.error}"`);
                    process.exit(1);
                }

                const count = (result.migratedTo || 0) - (result.migratedFrom || 0);
                logger.info(`Database migrated (v${result.migratedFrom} → v${result.migratedTo}, ${count} migrations)`);
            } else {
                logger.info(`Database ready (v${status.currentVersion})`);
            }
        }

        // Load system config BEFORE starting server
        const systemConfig = await getSystemConfig();
        app.set('systemConfig', systemConfig);
        logger.info('System config loaded');

        // Load log level from systemConfig if set
        if (systemConfig.debug?.logLevel) {
            logger.setLevel(systemConfig.debug.logLevel as string);
        }

        // Seed default integrations on fresh install (idempotent)
        const { seedDefaultIntegrations } = await import('./services/seedDefaultIntegrations');
        seedDefaultIntegrations();


        // Now start server with config loaded
        const portNum = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;

        // Create HTTP server for WebSocket attachment
        const httpServer = createServer(app);

        // Initialize IntegrationManager (starts services if users exist)
        await initializeIntegrationManager();

        // Auto-match Framerr users to Overseerr accounts by Plex username (fire-and-forget)
        import('./services/overseerrAutoMatch').then(m => m.tryAutoMatchAllUsers()).catch(() => { });

        // Register Overseerr per-user SSE topic filter (for seeAllRequests toggle)
        import('./integrations/overseerr/topicFilter').then(m => m.registerOverseerrTopicFilters()).catch(() => { });

        httpServer.listen(portNum, () => {
            logger.info(`[Server] Listening on port ${portNum}`);
            logger.info('[Server] Ready ✓');
        });
    } catch (error) {
        logger.error(`[Startup] Failed to start server: error="${error instanceof Error ? error.message : String(error)}"`);
        process.exit(1);
    }
})();

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    const { metricHistoryService } = await import('./services/MetricHistoryService');
    await metricHistoryService.shutdown();
    shutdownIntegrationManager();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    const { metricHistoryService } = await import('./services/MetricHistoryService');
    await metricHistoryService.shutdown();
    shutdownIntegrationManager();
    process.exit(0);
});

export default app;
