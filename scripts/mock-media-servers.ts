/**
 * Mock Media Servers
 * 
 * Simulates Overseerr, Radarr, and Sonarr APIs for testing
 * multi-instance correlation without real infrastructure.
 * 
 * Usage:
 *   npx tsx scripts/mock-media-servers.ts
 * 
 * Then configure Framerr integrations:
 *   - Overseerr: http://localhost:9999/overseerr (API key: mock-overseerr-key)
 *   - Radarr 1080p: http://localhost:9999/radarr-1080p (API key: mock-radarr-1080p-key)
 *   - Radarr 4K: http://localhost:9999/radarr-4k (API key: mock-radarr-4k-key)
 *   - Sonarr: http://localhost:9999/sonarr (API key: mock-sonarr-key)
 */

import express, { Request, Response, NextFunction } from 'express';

const app = express();
const PORT = 9999;

// =============================================================================
// MOCK DATA - Edit these to simulate different scenarios
// =============================================================================

/** API keys that must match between Overseerr settings and integration config */
const API_KEYS = {
    overseerr: 'mock-overseerr-key',
    radarr1080p: 'mock-radarr-1080p-key',
    radarr4k: 'mock-radarr-4k-key',
    sonarr: 'mock-sonarr-key',
};

/** Simulate Overseerr's connected Radarr/Sonarr servers (from /settings/radarr) */
const OVERSEERR_RADARR_SETTINGS = [
    {
        id: 0,
        name: 'Radarr 1080p',
        hostname: 'localhost',
        port: 9999,
        apiKey: API_KEYS.radarr1080p,  // This is the key for matching!
        useSsl: false,
        baseUrl: '/radarr-1080p',
        is4k: false,
        isDefault: true,
        activeDirectory: '/movies',
        activeProfileId: 1,
        activeProfileName: 'HD-1080p',
    },
    {
        id: 1,
        name: 'Radarr 4K',
        hostname: 'localhost',
        port: 9999,
        apiKey: API_KEYS.radarr4k,  // Different key for 4K instance
        useSsl: false,
        baseUrl: '/radarr-4k',
        is4k: true,
        isDefault: false,
        activeDirectory: '/movies-4k',
        activeProfileId: 2,
        activeProfileName: 'UHD-4K',
    },
];

const OVERSEERR_SONARR_SETTINGS = [
    {
        id: 0,
        name: 'Sonarr',
        hostname: 'localhost',
        port: 9999,
        apiKey: API_KEYS.sonarr,
        useSsl: false,
        baseUrl: '/sonarr',
        is4k: false,
        isDefault: true,
        activeDirectory: '/tv',
        activeProfileId: 1,
        activeProfileName: 'HD-1080p',
    },
];

/** Simulate Overseerr requests (movies/shows users requested) */
const OVERSEERR_REQUESTS = [
    {
        id: 1,
        status: 2, // approved
        type: 'movie',
        media: {
            id: 1,
            tmdbId: 98,  // Gladiator
            mediaType: 'movie',
            status: 3,
            title: 'Gladiator',
            posterPath: '/ehGpN04mLJIrSnxcZBMvHeG0eDc.jpg',
        },
        requestedBy: { id: 1, displayName: 'Alex' },
        serverId: 0, // Sent to Radarr 1080p
        createdAt: new Date().toISOString(),
    },
    {
        id: 2,
        status: 2,
        type: 'movie',
        media: {
            id: 2,
            tmdbId: 693134,  // Dune: Part Two
            mediaType: 'movie',
            status: 3,
            title: 'Dune: Part Two',
            posterPath: '/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg',
        },
        requestedBy: { id: 2, displayName: 'Sarah' },
        serverId: 1, // Sent to Radarr 4K
        createdAt: new Date().toISOString(),
    },
    {
        id: 3,
        status: 2,
        type: 'tv',
        media: {
            id: 3,
            tmdbId: 1399,  // Game of Thrones
            mediaType: 'tv',
            status: 3,
            title: 'Game of Thrones',
            posterPath: '/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg',
        },
        requestedBy: { id: 3, displayName: 'Marcus' },
        serverId: 0, // Sent to Sonarr
        createdAt: new Date().toISOString(),
    },
    {
        id: 4,
        status: 2,
        type: 'movie',
        media: {
            id: 4,
            tmdbId: 872585,  // Oppenheimer
            mediaType: 'movie',
            status: 5,  // Available
            title: 'Oppenheimer',
            posterPath: '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
        },
        requestedBy: { id: 1, displayName: 'Alex' },
        serverId: 0,
        createdAt: new Date().toISOString(),
    },
    {
        id: 5,
        status: 1, // pending
        type: 'movie',
        media: {
            id: 5,
            tmdbId: 402431,  // Wicked
            mediaType: 'movie',
            status: 1,  // Unknown/Pending
            title: 'Wicked',
            posterPath: '/2C0A2gj4kqW2s9z2jOJD8WvmA5s.jpg',
        },
        requestedBy: { id: 4, displayName: 'Jordan' },
        serverId: 0,
        createdAt: new Date().toISOString(),
    },
    {
        id: 6,
        status: 2,
        type: 'tv',
        media: {
            id: 6,
            tmdbId: 94997,  // House of the Dragon
            mediaType: 'tv',
            status: 4,  // Partially Available
            title: 'House of the Dragon',
            posterPath: '/t9XkeE7HzOsdQcDDDapDYh8Rrmt.jpg',
        },
        requestedBy: { id: 2, displayName: 'Sarah' },
        serverId: 0,
        createdAt: new Date().toISOString(),
    },
    {
        id: 7,
        status: 2,
        type: 'movie',
        media: {
            id: 7,
            tmdbId: 558449,  // Gladiator II
            mediaType: 'movie',
            status: 3,
            title: 'Gladiator II',
            posterPath: '/2cxhvwyEwRlysAmRH4iodkvo0z5.jpg',
        },
        requestedBy: { id: 5, displayName: 'Emily' },
        serverId: 1, // 4K
        createdAt: new Date().toISOString(),
    },
    {
        id: 8,
        status: 2,
        type: 'tv',
        media: {
            id: 8,
            tmdbId: 66732,  // Stranger Things
            mediaType: 'tv',
            status: 5,  // Available
            title: 'Stranger Things',
            posterPath: '/x2LSRK2Cm7MZhjluni1msVJ3wDF.jpg',
        },
        requestedBy: { id: 3, displayName: 'Marcus' },
        serverId: 0,
        createdAt: new Date().toISOString(),
    },
];

/** Simulate Radarr 1080p queue (active downloads) */
const RADARR_1080P_QUEUE = {
    page: 1,
    pageSize: 20,
    totalRecords: 2,
    records: [
        {
            id: 1,
            movieId: 1,
            title: 'Gladiator',
            status: 'downloading',
            trackedDownloadStatus: 'ok',
            trackedDownloadState: 'downloading',
            size: 4294967296, // 4GB
            sizeleft: 1073741824, // 1GB left = 75%
            timeleft: '00:15:32',
            estimatedCompletionTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            protocol: 'torrent',
            movie: {
                id: 1,
                title: 'Gladiator',
                tmdbId: 98,
                year: 2000,
            },
        },
        {
            id: 2,
            movieId: 2,
            title: 'Wicked',
            status: 'downloading',
            trackedDownloadStatus: 'ok',
            trackedDownloadState: 'importing',
            size: 3221225472, // 3GB
            sizeleft: 0, // Done downloading, importing
            timeleft: '00:00:00',
            estimatedCompletionTime: new Date().toISOString(),
            protocol: 'torrent',
            movie: {
                id: 2,
                title: 'Wicked',
                tmdbId: 402431,
                year: 2024,
            },
        },
    ],
};

/** Simulate Radarr 4K queue */
const RADARR_4K_QUEUE = {
    page: 1,
    pageSize: 20,
    totalRecords: 2,
    records: [
        {
            id: 1,
            movieId: 1,
            title: 'Gladiator (4K)',   // Same movie as 1080p for multi-bar demo
            status: 'downloading',
            trackedDownloadStatus: 'ok',
            trackedDownloadState: 'downloading',
            size: 42949672960, // 40GB (4K file)
            sizeleft: 21474836480, // 20GB left = 50%
            timeleft: '02:30:00',
            estimatedCompletionTime: new Date(Date.now() + 150 * 60 * 1000).toISOString(),
            protocol: 'torrent',
            movie: {
                id: 1,
                title: 'Gladiator',
                tmdbId: 98,  // SAME tmdbId as 1080p queue!
                year: 2000,
            },
        },
        {
            id: 2,
            movieId: 2,
            title: 'Dune: Part Two',
            status: 'downloading',
            trackedDownloadStatus: 'ok',
            trackedDownloadState: 'downloading',
            size: 21474836480, // 20GB (4K file)
            sizeleft: 16106127360, // 15GB left = 25%
            timeleft: '01:23:45',
            estimatedCompletionTime: new Date(Date.now() + 84 * 60 * 1000).toISOString(),
            protocol: 'torrent',
            movie: {
                id: 2,
                title: 'Dune: Part Two',
                tmdbId: 693134,
                year: 2024,
            },
        },
    ],
};

/** Simulate Sonarr queue (TV episodes) */
const SONARR_QUEUE = {
    page: 1,
    pageSize: 20,
    totalRecords: 3,
    records: [
        {
            id: 1,
            seriesId: 1,
            episodeId: 101,
            title: 'Winter Is Coming',
            status: 'downloading',
            trackedDownloadStatus: 'ok',
            trackedDownloadState: 'downloading',
            size: 1073741824, // 1GB
            sizeleft: 536870912, // 50%
            timeleft: '00:08:22',
            estimatedCompletionTime: new Date(Date.now() + 8 * 60 * 1000).toISOString(),
            protocol: 'torrent',
            series: {
                id: 1,
                title: 'Game of Thrones',
                tmdbId: 1399,
                year: 2011,
            },
            episode: {
                id: 101,
                seasonNumber: 1,
                episodeNumber: 1,
                title: 'Winter Is Coming',
            },
        },
        {
            id: 2,
            seriesId: 1,
            episodeId: 102,
            title: 'The Kingsroad',
            status: 'downloading',
            trackedDownloadStatus: 'ok',
            trackedDownloadState: 'downloading',
            size: 1073741824,
            sizeleft: 268435456, // 75%
            timeleft: '00:04:11',
            estimatedCompletionTime: new Date(Date.now() + 4 * 60 * 1000).toISOString(),
            protocol: 'torrent',
            series: {
                id: 1,
                title: 'Game of Thrones',
                tmdbId: 1399,
                year: 2011,
            },
            episode: {
                id: 102,
                seasonNumber: 1,
                episodeNumber: 2,
                title: 'The Kingsroad',
            },
        },
        {
            id: 3,
            seriesId: 1,
            episodeId: 103,
            title: 'Lord Snow',
            status: 'downloading',
            trackedDownloadStatus: 'ok',
            trackedDownloadState: 'downloading',
            size: 1073741824,
            sizeleft: 805306368, // 25%
            timeleft: '00:12:33',
            estimatedCompletionTime: new Date(Date.now() + 12 * 60 * 1000).toISOString(),
            protocol: 'torrent',
            series: {
                id: 1,
                title: 'Game of Thrones',
                tmdbId: 1399,
                year: 2011,
            },
            episode: {
                id: 103,
                seasonNumber: 1,
                episodeNumber: 3,
                title: 'Lord Snow',
            },
        },
    ],
};

// =============================================================================
// CALENDAR MOCK DATA
// =============================================================================

/** Helper to create dates relative to now */
const daysFromNow = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
};

/** Simulate Radarr 1080p calendar (upcoming movie releases) */
const RADARR_1080P_CALENDAR = [
    { id: 1, title: 'Mission: Impossible 8', year: 2026, tmdbId: 575264, digitalRelease: daysFromNow(0), monitored: true, hasFile: false },
    { id: 2, title: 'Avatar 3', year: 2026, tmdbId: 83533, digitalRelease: daysFromNow(1), monitored: true, hasFile: false },
    { id: 3, title: 'Spider-Man 4', year: 2026, tmdbId: 1051887, digitalRelease: daysFromNow(2), monitored: true, hasFile: false },
    { id: 4, title: 'The Batman 2', year: 2026, tmdbId: 786892, digitalRelease: daysFromNow(3), monitored: true, hasFile: false },
    { id: 5, title: 'Captain America: Brave New World', year: 2025, tmdbId: 822119, digitalRelease: daysFromNow(5), monitored: true, hasFile: false },
    { id: 6, title: 'Thunderbolts', year: 2025, tmdbId: 986056, digitalRelease: daysFromNow(7), monitored: true, hasFile: false },
    { id: 7, title: 'Blade', year: 2025, tmdbId: 617127, digitalRelease: daysFromNow(10), monitored: true, hasFile: false },
    { id: 8, title: 'Fantastic Four', year: 2025, tmdbId: 617126, digitalRelease: daysFromNow(14), monitored: true, hasFile: false },
    { id: 9, title: 'Deadpool 4', year: 2026, tmdbId: 999999, digitalRelease: daysFromNow(21), monitored: true, hasFile: false },
    { id: 10, title: 'Jurassic World 4', year: 2025, tmdbId: 940721, digitalRelease: daysFromNow(28), monitored: true, hasFile: false },
];

/** Simulate Radarr 4K calendar */
const RADARR_4K_CALENDAR = [
    { id: 1, title: 'Gladiator II (4K)', year: 2024, tmdbId: 558449, digitalRelease: daysFromNow(0), monitored: true, hasFile: false },
    { id: 2, title: 'Wicked (4K)', year: 2024, tmdbId: 402431, digitalRelease: daysFromNow(1), monitored: true, hasFile: false },
    { id: 3, title: 'Dune: Part Two (4K)', year: 2024, tmdbId: 693134, digitalRelease: daysFromNow(3), monitored: true, hasFile: false },
    { id: 4, title: 'Oppenheimer (4K)', year: 2023, tmdbId: 872585, digitalRelease: daysFromNow(5), monitored: true, hasFile: false },
    { id: 5, title: 'Barbie (4K)', year: 2023, tmdbId: 346698, digitalRelease: daysFromNow(8), monitored: true, hasFile: false },
    { id: 6, title: 'Interstellar (4K Remaster)', year: 2014, tmdbId: 157336, digitalRelease: daysFromNow(12), monitored: true, hasFile: false },
    { id: 7, title: 'The Dark Knight (4K)', year: 2008, tmdbId: 155, digitalRelease: daysFromNow(15), monitored: true, hasFile: false },
    { id: 8, title: 'Inception (4K)', year: 2010, tmdbId: 27205, digitalRelease: daysFromNow(20), monitored: true, hasFile: false },
];

/** Simulate Sonarr calendar (upcoming TV episodes) */
const SONARR_CALENDAR = [
    { id: 1, seriesId: 1, seasonNumber: 2, episodeNumber: 5, title: 'The Reckoning', airDateUtc: daysFromNow(0), hasFile: false, monitored: true, series: { id: 1, title: 'House of the Dragon', tvdbId: 371572, year: 2022 } },
    { id: 2, seriesId: 1, seasonNumber: 2, episodeNumber: 6, title: 'Fire and Blood', airDateUtc: daysFromNow(7), hasFile: false, monitored: true, series: { id: 1, title: 'House of the Dragon', tvdbId: 371572, year: 2022 } },
    { id: 3, seriesId: 2, seasonNumber: 3, episodeNumber: 1, title: 'Season Premiere', airDateUtc: daysFromNow(1), hasFile: false, monitored: true, series: { id: 2, title: 'The Last of Us', tvdbId: 392256, year: 2023 } },
    { id: 4, seriesId: 2, seasonNumber: 3, episodeNumber: 2, title: 'The Journey', airDateUtc: daysFromNow(8), hasFile: false, monitored: true, series: { id: 2, title: 'The Last of Us', tvdbId: 392256, year: 2023 } },
    { id: 5, seriesId: 3, seasonNumber: 2, episodeNumber: 1, title: 'Reset', airDateUtc: daysFromNow(2), hasFile: false, monitored: true, series: { id: 3, title: 'Severance', tvdbId: 371980, year: 2022 } },
    { id: 6, seriesId: 3, seasonNumber: 2, episodeNumber: 2, title: 'The Break Room', airDateUtc: daysFromNow(9), hasFile: false, monitored: true, series: { id: 3, title: 'Severance', tvdbId: 371980, year: 2022 } },
    { id: 7, seriesId: 4, seasonNumber: 5, episodeNumber: 10, title: 'Series Finale', airDateUtc: daysFromNow(3), hasFile: false, monitored: true, series: { id: 4, title: 'Yellowstone', tvdbId: 351094, year: 2018 } },
    { id: 8, seriesId: 5, seasonNumber: 1, episodeNumber: 1, title: 'Pilot', airDateUtc: daysFromNow(4), hasFile: false, monitored: true, series: { id: 5, title: 'Percy Jackson', tvdbId: 396398, year: 2023 } },
    { id: 9, seriesId: 5, seasonNumber: 1, episodeNumber: 2, title: 'The Quest Begins', airDateUtc: daysFromNow(11), hasFile: false, monitored: true, series: { id: 5, title: 'Percy Jackson', tvdbId: 396398, year: 2023 } },
    { id: 10, seriesId: 6, seasonNumber: 2, episodeNumber: 8, title: 'Finale', airDateUtc: daysFromNow(5), hasFile: false, monitored: true, series: { id: 6, title: 'Shogun', tvdbId: 126166, year: 2024 } },
    { id: 11, seriesId: 7, seasonNumber: 3, episodeNumber: 1, title: 'New Beginnings', airDateUtc: daysFromNow(6), hasFile: false, monitored: true, series: { id: 7, title: 'The Bear', tvdbId: 396213, year: 2022 } },
    { id: 12, seriesId: 7, seasonNumber: 3, episodeNumber: 2, title: 'Kitchen Wars', airDateUtc: daysFromNow(13), hasFile: false, monitored: true, series: { id: 7, title: 'The Bear', tvdbId: 396213, year: 2022 } },
    { id: 13, seriesId: 8, seasonNumber: 4, episodeNumber: 1, title: 'The Return', airDateUtc: daysFromNow(10), hasFile: false, monitored: true, series: { id: 8, title: 'Stranger Things', tvdbId: 305288, year: 2016 } },
    { id: 14, seriesId: 8, seasonNumber: 4, episodeNumber: 2, title: 'Eleven', airDateUtc: daysFromNow(17), hasFile: false, monitored: true, series: { id: 8, title: 'Stranger Things', tvdbId: 305288, year: 2016 } },
    { id: 15, seriesId: 9, seasonNumber: 1, episodeNumber: 5, title: 'The Truth', airDateUtc: daysFromNow(14), hasFile: false, monitored: true, series: { id: 9, title: 'Fallout', tvdbId: 400059, year: 2024 } },
];

// =============================================================================
// MIDDLEWARE
// =============================================================================

app.use(express.json());

// =============================================================================
// SERVICE MONITORING SIMULATION
// =============================================================================

/** Track simulated service status - toggle via /toggle-service/:name */
const serviceStatus: Record<string, boolean> = {
    radarr1080p: true,
    radarr4k: true,
    sonarr: true,
    overseerr: true,
};

// Toggle service status endpoint - useful for testing service monitor notifications
app.post('/toggle-service/:name', (req: Request, res: Response) => {
    const name = (req.params.name as string).toLowerCase();
    if (!(name in serviceStatus)) {
        res.status(400).json({ error: 'Unknown service', available: Object.keys(serviceStatus) });
        return;
    }
    serviceStatus[name] = !serviceStatus[name];
    console.log(`[MOCK] Service ${name} is now ${serviceStatus[name] ? 'UP' : 'DOWN'}`);
    res.json({ service: name, status: serviceStatus[name] ? 'up' : 'down' });
});

// View all service statuses
app.get('/service-status', (_req: Request, res: Response) => {
    const statuses = Object.entries(serviceStatus).map(([name, up]) => ({
        name,
        status: up ? 'up' : 'down',
    }));
    res.json(statuses);
});

// Middleware to check if service is "down" - returns 503 for down services
const checkServiceDown = (serviceName: string) => (_req: Request, res: Response, next: NextFunction) => {
    if (!serviceStatus[serviceName]) {
        console.log(`[MOCK] Service ${serviceName} is DOWN - returning 503`);
        res.status(503).json({ error: 'Service Unavailable' });
        return;
    }
    next();
};

// Log all requests
app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[MOCK] ${req.method} ${req.path}`);
    next();
});

// =============================================================================
// OVERSEERR ROUTES
// =============================================================================

// Simple root endpoint for service monitoring (responds to http://localhost:9999/overseerr)
app.get('/overseerr', checkServiceDown('overseerr'), (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'overseerr' });
});

// Settings endpoints (return configured servers WITH API keys)
app.get('/overseerr/api/v1/settings/radarr', (_req: Request, res: Response) => {
    res.json(OVERSEERR_RADARR_SETTINGS);
});

app.get('/overseerr/api/v1/settings/sonarr', (_req: Request, res: Response) => {
    res.json(OVERSEERR_SONARR_SETTINGS);
});

// Service endpoints (used by some Overseerr features, doesn't include apiKey)
app.get('/overseerr/api/v1/service/radarr', (_req: Request, res: Response) => {
    // This endpoint does NOT include apiKey - that's why we use /settings instead
    res.json(OVERSEERR_RADARR_SETTINGS.map(({ apiKey: _apiKey, ...rest }) => rest));
});

app.get('/overseerr/api/v1/service/sonarr', (_req: Request, res: Response) => {
    res.json(OVERSEERR_SONARR_SETTINGS.map(({ apiKey: _apiKey, ...rest }) => rest));
});

// Requests endpoint
app.get('/overseerr/api/v1/request', (req: Request, res: Response) => {
    const take = parseInt(req.query.take as string) || 20;
    const skip = parseInt(req.query.skip as string) || 0;

    res.json({
        pageInfo: {
            pages: 1,
            pageSize: take,
            results: OVERSEERR_REQUESTS.length,
            page: Math.floor(skip / take) + 1,
        },
        results: OVERSEERR_REQUESTS.slice(skip, skip + take),
    });
});

// Status endpoint (health check)
app.get('/overseerr/api/v1/status', (_req: Request, res: Response) => {
    res.json({
        version: '1.33.2',
        commitTag: 'mock',
        updateAvailable: false,
        commitsBehind: 0,
    });
});

// Settings public endpoint (used for connection test)
app.get('/overseerr/api/v1/settings/public', (_req: Request, res: Response) => {
    res.json({
        initialized: true,
        applicationTitle: 'Mock Overseerr',
        applicationUrl: 'http://localhost:9999/overseerr',
        localLogin: true,
        movie4kEnabled: true,
        series4kEnabled: true,
        region: 'US',
        originalLanguage: 'en',
        version: '1.33.2',
    });
});

// =============================================================================
// TMDB DETAIL ENDPOINTS (used by tmdbEnrichment service)
// The Framerr backend calls these to get titles, posters, and metadata
// =============================================================================

/** Mock TMDB movie/TV details keyed by tmdbId */
const TMDB_MOVIE_DETAILS: Record<number, { title: string; posterPath: string; overview: string; releaseDate: string; voteAverage: number; runtime: number }> = {
    98: { title: 'Gladiator', posterPath: '/ehGpN04mLJIrSnxcZBMvHeG0eDc.jpg', overview: 'In the year 180, the death of emperor Marcus Aurelius throws the Roman Empire into chaos.', releaseDate: '2000-05-01', voteAverage: 8.2, runtime: 155 },
    693134: { title: 'Dune: Part Two', posterPath: '/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg', overview: 'Paul Atreides unites with Chani and the Fremen while seeking revenge against those who destroyed his family.', releaseDate: '2024-02-27', voteAverage: 8.1, runtime: 166 },
    872585: { title: 'Oppenheimer', posterPath: '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', overview: 'The story of J. Robert Oppenheimer and the creation of the atomic bomb.', releaseDate: '2023-07-19', voteAverage: 8.1, runtime: 180 },
    402431: { title: 'Wicked', posterPath: '/2C0A2gj4kqW2s9z2jOJD8WvmA5s.jpg', overview: 'The story of how a green-skinned woman becomes the Wicked Witch of the West.', releaseDate: '2024-11-22', voteAverage: 7.6, runtime: 160 },
    558449: { title: 'Gladiator II', posterPath: '/2cxhvwyEwRlysAmRH4iodkvo0z5.jpg', overview: 'Lucius must enter the Colosseum and find the courage to return the glory of Rome to its people.', releaseDate: '2024-11-13', voteAverage: 6.8, runtime: 148 },
    346698: { title: 'Barbie', posterPath: '/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg', overview: 'Barbie and Ken are having the time of their lives in the colorful and seemingly perfect world of Barbie Land.', releaseDate: '2023-07-19', voteAverage: 7.0, runtime: 114 },
    157336: { title: 'Interstellar', posterPath: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', overview: 'Interstellar chronicles the adventures of a group of explorers who travel through a wormhole in search of a new home for humanity.', releaseDate: '2014-11-05', voteAverage: 8.4, runtime: 169 },
    155: { title: 'The Dark Knight', posterPath: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg', overview: 'Batman raises the stakes in his war on crime. With the help of Lt. Jim Gordon and DA Harvey Dent, Batman sets out to dismantle the remaining criminal organizations.', releaseDate: '2008-07-16', voteAverage: 8.5, runtime: 152 },
    27205: { title: 'Inception', posterPath: '/9gk7adHYeDvHkCSEqAvQNLV5Ber.jpg', overview: 'Cobb, a skilled thief who commits corporate espionage by infiltrating the subconscious of his targets, is offered a chance to regain his old life.', releaseDate: '2010-07-15', voteAverage: 8.4, runtime: 148 },
    575264: { title: 'Mission: Impossible 8', posterPath: '/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg', overview: 'Ethan Hunt and the IMF team embark on their most dangerous mission yet.', releaseDate: '2026-05-23', voteAverage: 0, runtime: 160 },
    83533: { title: 'Avatar 3', posterPath: '/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg', overview: 'The saga continues on Pandora.', releaseDate: '2026-12-19', voteAverage: 0, runtime: 180 },
    822119: { title: 'Captain America: Brave New World', posterPath: '/pzIddUEMWhFCfFj3ELqvVcspmJc.jpg', overview: 'Sam Wilson, the new Captain America, finds himself in the middle of an international incident.', releaseDate: '2025-02-12', voteAverage: 5.8, runtime: 118 },
    986056: { title: 'Thunderbolts*', posterPath: '/m3LslH3zNJHVKSMlNOWDqp1IhVE.jpg', overview: 'A group of antiheroes are recruited by the government to go on dangerous missions.', releaseDate: '2025-04-30', voteAverage: 0, runtime: 127 },
};

const TMDB_TV_DETAILS: Record<number, { name: string; posterPath: string; overview: string; firstAirDate: string; voteAverage: number; numberOfSeasons: number }> = {
    1399: { name: 'Game of Thrones', posterPath: '/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg', overview: 'Seven noble families fight for control of the mythical land of Westeros.', firstAirDate: '2011-04-17', voteAverage: 8.4, numberOfSeasons: 8 },
    94997: { name: 'House of the Dragon', posterPath: '/t9XkeE7HzOsdQcDDDapDYh8Rrmt.jpg', overview: 'The Targaryen civil war that tore apart the Seven Kingdoms.', firstAirDate: '2022-08-21', voteAverage: 8.4, numberOfSeasons: 2 },
    66732: { name: 'Stranger Things', posterPath: '/x2LSRK2Cm7MZhjluni1msVJ3wDF.jpg', overview: 'When a young boy disappears, his mother, a police chief and his friends must confront terrifying supernatural forces.', firstAirDate: '2016-07-15', voteAverage: 8.6, numberOfSeasons: 4 },
    100088: { name: 'The Last of Us', posterPath: '/dmo1WLKp2W5rS2rGEhU9CBnZQFz.jpg', overview: 'Twenty years after modern civilization has been destroyed, Joel, a hardened survivor, is hired to smuggle Ellie through a dangerous journey across the US.', firstAirDate: '2023-01-15', voteAverage: 8.6, numberOfSeasons: 2 },
    95396: { name: 'Severance', posterPath: '/lFf6DEhtrGqLNhJXFGQXU8q1Zm1.jpg', overview: 'Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives.', firstAirDate: '2022-02-18', voteAverage: 8.3, numberOfSeasons: 2 },
    136315: { name: 'The Bear', posterPath: '/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg', overview: 'A young chef from the fine dining world comes home to Chicago to run his family sandwich shop.', firstAirDate: '2022-06-23', voteAverage: 8.0, numberOfSeasons: 3 },
    1396: { name: 'Breaking Bad', posterPath: '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg', overview: 'A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine.', firstAirDate: '2008-01-20', voteAverage: 8.9, numberOfSeasons: 5 },
};

// Movie detail endpoint (used by tmdbEnrichment service)
app.get('/overseerr/api/v1/movie/:tmdbId', (req: Request, res: Response) => {
    const tmdbId = parseInt(req.params.tmdbId as string);
    const details = TMDB_MOVIE_DETAILS[tmdbId];
    if (details) {
        res.json({
            id: tmdbId,
            title: details.title,
            originalTitle: details.title,
            posterPath: details.posterPath,
            backdropPath: null,
            overview: details.overview,
            releaseDate: details.releaseDate,
            voteAverage: details.voteAverage,
            voteCount: 1000,
            genres: [{ id: 1, name: 'Action' }, { id: 2, name: 'Drama' }],
            runtime: details.runtime,
            tagline: '',
            status: 'Released',
        });
    } else {
        res.status(404).json({ error: 'Movie not found' });
    }
});

// TV detail endpoint (used by tmdbEnrichment service)
app.get('/overseerr/api/v1/tv/:tmdbId', (req: Request, res: Response) => {
    const tmdbId = parseInt(req.params.tmdbId as string);
    const details = TMDB_TV_DETAILS[tmdbId];
    if (details) {
        res.json({
            id: tmdbId,
            name: details.name,
            originalName: details.name,
            posterPath: details.posterPath,
            backdropPath: null,
            overview: details.overview,
            firstAirDate: details.firstAirDate,
            voteAverage: details.voteAverage,
            voteCount: 500,
            genres: [{ id: 1, name: 'Drama' }, { id: 2, name: 'Sci-Fi & Fantasy' }],
            numberOfSeasons: details.numberOfSeasons,
            tagline: '',
            status: 'Returning Series',
        });
    } else {
        res.status(404).json({ error: 'TV show not found' });
    }
});


// =============================================================================
// RADARR 1080P ROUTES
// =============================================================================

// Simple root endpoint for service monitoring
app.get('/radarr-1080p', checkServiceDown('radarr1080p'), (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'radarr-1080p' });
});

app.get('/radarr-1080p/api/v3/queue', (_req: Request, res: Response) => {
    res.json(RADARR_1080P_QUEUE);
});

app.get('/radarr-1080p/api/v3/system/status', checkServiceDown('radarr1080p'), (_req: Request, res: Response) => {
    res.json({
        appName: 'Radarr',
        instanceName: 'Radarr 1080p',
        version: '5.2.6.8376',
    });
});

app.get('/radarr-1080p/api/v3/calendar', (_req: Request, res: Response) => {
    res.json(RADARR_1080P_CALENDAR);
});

// =============================================================================
// RADARR 4K ROUTES
// =============================================================================

// Simple root endpoint for service monitoring
app.get('/radarr-4k', checkServiceDown('radarr4k'), (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'radarr-4k' });
});

app.get('/radarr-4k/api/v3/queue', (_req: Request, res: Response) => {
    res.json(RADARR_4K_QUEUE);
});

app.get('/radarr-4k/api/v3/system/status', checkServiceDown('radarr4k'), (_req: Request, res: Response) => {
    res.json({
        appName: 'Radarr',
        instanceName: 'Radarr 4K',
        version: '5.2.6.8376',
    });
});

app.get('/radarr-4k/api/v3/calendar', (_req: Request, res: Response) => {
    res.json(RADARR_4K_CALENDAR);
});

// =============================================================================
// SONARR ROUTES
// =============================================================================

// Simple root endpoint for service monitoring
app.get('/sonarr', checkServiceDown('sonarr'), (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'sonarr' });
});

app.get('/sonarr/api/v3/queue', (_req: Request, res: Response) => {
    res.json(SONARR_QUEUE);
});

app.get('/sonarr/api/v3/system/status', checkServiceDown('sonarr'), (_req: Request, res: Response) => {
    res.json({
        appName: 'Sonarr',
        instanceName: 'Sonarr',
        version: '4.0.1.929',
    });
});

app.get('/sonarr/api/v3/calendar', (_req: Request, res: Response) => {
    res.json(SONARR_CALENDAR);
});

// =============================================================================
// CATCH-ALL FOR DEBUGGING
// =============================================================================

// Express 5 requires explicit path pattern instead of '*'
app.use((req: Request, res: Response) => {
    console.log(`[MOCK] Unhandled: ${req.method} ${req.path}`);
    console.log('  Headers:', JSON.stringify(req.headers, null, 2));
    res.status(404).json({ error: 'Not found', path: req.path });
});

// =============================================================================
// START SERVER
// =============================================================================

app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  MOCK MEDIA SERVERS RUNNING');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('  Configure Framerr integrations with these settings:');
    console.log('');
    console.log('  Overseerr:');
    console.log(`    URL:     http://localhost:${PORT}/overseerr`);
    console.log(`    API Key: ${API_KEYS.overseerr}`);
    console.log('');
    console.log('  Radarr 1080p:');
    console.log(`    URL:     http://localhost:${PORT}/radarr-1080p`);
    console.log(`    API Key: ${API_KEYS.radarr1080p}`);
    console.log('');
    console.log('  Radarr 4K:');
    console.log(`    URL:     http://localhost:${PORT}/radarr-4k`);
    console.log(`    API Key: ${API_KEYS.radarr4k}`);
    console.log('');
    console.log('  Sonarr:');
    console.log(`    URL:     http://localhost:${PORT}/sonarr`);
    console.log(`    API Key: ${API_KEYS.sonarr}`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('  Mock Downloads:');
    console.log('    - Gladiator (1080p) - 75% complete');
    console.log('    - Wicked (1080p) - 100% (importing)');
    console.log('    - Dune: Part Two (4K) - 25% complete');
    console.log('    - Game of Thrones S01E01-03 - various progress');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('  SERVICE MONITORING TEST COMMANDS:');
    console.log('  ─────────────────────────────────');
    console.log('');
    console.log('  View status:');
    console.log(`    curl http://localhost:${PORT}/service-status`);
    console.log('');
    console.log('  Toggle service DOWN (for notification testing):');
    console.log(`    curl -X POST http://localhost:${PORT}/toggle-service/radarr1080p`);
    console.log(`    curl -X POST http://localhost:${PORT}/toggle-service/radarr4k`);
    console.log(`    curl -X POST http://localhost:${PORT}/toggle-service/sonarr`);
    console.log(`    curl -X POST http://localhost:${PORT}/toggle-service/overseerr`);
    console.log('');
    console.log('  When DOWN, service returns 503. Toggle again to bring UP.');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('  Press Ctrl+C to stop');
    console.log('');
});
