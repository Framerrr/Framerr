/**
 * Mock SABnzbd Server
 *
 * Simulates the SABnzbd API (port 8085) for testing the Downloads widget
 * and SABnzbd integration without real infrastructure.
 *
 * **Built from the official SABnzbd API documentation** — responses match
 * the real API shapes exactly, including all fields the real server returns,
 * not just the ones our widget currently uses. This lets us catch issues
 * where our poller/adapter/widget might be mishandling real API data.
 *
 * Supported API modes:
 *   - mode=version          — Server version (connection test)
 *   - mode=queue            — Active download queue
 *   - mode=history          — Completed/failed download history
 *   - mode=get_files        — Files within a queue job
 *   - mode=server_stats     — Per-server download statistics
 *   - mode=status           — Server status with connection info
 *   - mode=get_cats         — Available categories
 *   - mode=get_scripts      — Available post-processing scripts
 *   - mode=queue&name=pause/resume/delete/priority — Queue actions
 *   - mode=pause/resume     — Global pause/resume
 *   - mode=change_cat       — Change job category
 *
 * Usage:
 *   npx tsx scripts/mock-sabnzbd-server.ts
 *
 * Configure Framerr:
 *   - URL:     http://localhost:8085
 *   - API Key: mock-sabnzbd-key
 */

import express, { Request, Response } from 'express';

// =============================================================================
// CONFIGURATION
// =============================================================================

const PORT = 8085;
const API_KEY = 'mock-sabnzbd-key';
const SAB_VERSION = '4.4.1';

// =============================================================================
// MOCK DATA — Faithful to real SABnzbd API response shapes
// =============================================================================

// Queue slots — exact shape from SABnzbd API docs
// Fields: status, index, password, avg_age, time_added, script, direct_unpack,
//         mb, mbleft, mbmissing, size, sizeleft, filename, labels, priority,
//         cat, timeleft, percentage, nzo_id, unpackopts
interface QueueSlot {
    status: string;
    index: number;
    password: string;
    avg_age: string;
    time_added: number;
    script: string;
    direct_unpack: string | null;
    mb: string;
    mbleft: string;
    mbmissing: string;
    size: string;
    sizeleft: string;
    filename: string;
    labels: string[];
    priority: string;
    cat: string;
    timeleft: string;
    percentage: string;
    nzo_id: string;
    unpackopts: string;
}

// History slots — exact shape from SABnzbd API docs
// Many more fields than our poller extracts — this is intentional!
interface HistorySlot {
    action_line: string;
    duplicate_key: string;
    meta: null | Record<string, unknown>;
    fail_message: string;
    loaded: boolean;
    size: string;
    category: string;
    pp: string;
    retry: number;
    script: string;
    nzb_name: string;
    download_time: number;
    storage: string;
    has_rating: boolean;
    status: string;
    script_line: string;
    completed: number;
    time_added: number;
    nzo_id: string;
    downloaded: number;
    report: string;
    password: string;
    path: string;
    postproc_time: number;
    name: string;
    url: string;
    md5sum: string;
    archive: boolean;
    bytes: number;
    url_info: string;
    stage_log: { name: string; actions: string[] }[];
}

// File entries — exact shape from SABnzbd API docs
interface FileEntry {
    status: string;        // 'finished', 'active', 'queued'
    mbleft: string;
    mb: string;
    age: string;
    bytes: string;         // Note: string in the real API!
    filename: string;
    nzf_id: string;
    set?: string;          // Only on par2 files
}

// =============================================================================
// MUTABLE STATE — simulates a live SABnzbd instance
// =============================================================================

let globalPaused = false;
let speedLimitPercent = '100';
// Track items that were individually paused BEFORE global pause
// so global resume doesn't accidentally resume them
const individuallyPaused = new Set<string>();

// Active queue items
let queueSlots: QueueSlot[] = [
    {
        status: 'Downloading',
        index: 0,
        password: '',
        avg_age: '142d',
        time_added: Math.floor(Date.now() / 1000) - 300,
        script: 'None',
        direct_unpack: '8/24',
        mb: '4521.33',
        mbleft: '1267.97',
        mbmissing: '0.0',
        size: '4.4 GB',
        sizeleft: '1.2 GB',
        filename: 'Movie.2024.1080p.WEB-DL.DDP5.1.H.264-GROUP',
        labels: [],
        priority: 'Normal',
        cat: 'movies',
        timeleft: '0:05:12',
        percentage: '72',
        nzo_id: 'SABnzbd_nzo_abc123',
        unpackopts: '3',
    },
    {
        status: 'Downloading',
        index: 1,
        password: '',
        avg_age: '89d',
        time_added: Math.floor(Date.now() / 1000) - 600,
        script: 'None',
        direct_unpack: null,
        mb: '812.44',
        mbleft: '406.22',
        mbmissing: '0.0',
        size: '812.4 MB',
        sizeleft: '406.2 MB',
        filename: 'TV.Show.S03E08.720p.HDTV.x264-FLEET',
        labels: [],
        priority: 'High',
        cat: 'tv',
        timeleft: '0:01:45',
        percentage: '50',
        nzo_id: 'SABnzbd_nzo_def456',
        unpackopts: '3',
    },
    {
        status: 'Paused',
        index: 2,
        password: '',
        avg_age: '2105d',
        time_added: Math.floor(Date.now() / 1000) - 1200,
        script: 'notify.py',
        direct_unpack: null,
        mb: '2048.00',
        mbleft: '2048.00',
        mbmissing: '0.0',
        size: '2.0 GB',
        sizeleft: '2.0 GB',
        filename: 'Old.Movie.1999.Remaster.BluRay.x264-SPARKS',
        labels: ['DUPLICATE'],
        priority: 'Low',
        cat: 'movies',
        timeleft: '0:00:00',
        percentage: '0',
        nzo_id: 'SABnzbd_nzo_ghi789',
        unpackopts: '3',
    },
    {
        status: 'Queued',
        index: 3,
        password: '',
        avg_age: '45d',
        time_added: Math.floor(Date.now() / 1000) - 1800,
        script: 'None',
        direct_unpack: null,
        mb: '350.50',
        mbleft: '350.50',
        mbmissing: '0.0',
        size: '350.5 MB',
        sizeleft: '350.5 MB',
        filename: 'Album.Artist.2024.FLAC-GROUP',
        labels: [],
        priority: 'Normal',
        cat: 'audio',
        timeleft: '0:00:00',
        percentage: '0',
        nzo_id: 'SABnzbd_nzo_jkl012',
        unpackopts: '3',
    },
    {
        status: 'Fetching',
        index: 4,
        password: '',
        avg_age: '12d',
        time_added: Math.floor(Date.now() / 1000) - 120,
        script: 'None',
        direct_unpack: null,
        mb: '1500.00',
        mbleft: '0.00',
        mbmissing: '150.00',
        size: '1.5 GB',
        sizeleft: '0 ',
        filename: 'Software.Pack.2024.x64',
        labels: ['ENCRYPTED'],
        priority: 'Force',
        cat: 'software',
        timeleft: '0:00:00',
        percentage: '100',
        nzo_id: 'SABnzbd_nzo_mno345',
        unpackopts: '3',
    },
];

// Completed/failed history items (with ALL fields from the real API)
const now = Math.floor(Date.now() / 1000);
let historySlots: HistorySlot[] = [
    {
        action_line: '',
        duplicate_key: 'Movie.2024/1',
        meta: null,
        fail_message: '',
        loaded: false,
        size: '4.2 GB',
        category: 'movies',
        pp: 'D',
        retry: 0,
        script: 'None',
        nzb_name: 'Movie.2024.2160p.WEB-DL.DDP5.1.DV.HDR.H.265-GROUP.nzb',
        download_time: 720,
        storage: '/data/complete/movies/Movie.2024.2160p.WEB-DL',
        has_rating: false,
        status: 'Completed',
        script_line: '',
        completed: now - 7200,
        time_added: now - 8000,
        nzo_id: 'SABnzbd_nzo_hist01',
        downloaded: 4509715660,
        report: '',
        password: '',
        path: '/data/incomplete/Movie.2024.2160p.WEB-DL',
        postproc_time: 180,
        name: 'Movie.2024.2160p.WEB-DL.DDP5.1.DV.HDR.H.265-GROUP',
        url: 'Movie.2024.2160p.WEB-DL.DDP5.1.DV.HDR.H.265-GROUP.nzb',
        md5sum: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
        archive: false,
        bytes: 4509715660,
        url_info: '',
        stage_log: [
            { name: 'Source', actions: ['Movie.2024.2160p.WEB-DL.DDP5.1.DV.HDR.H.265-GROUP.nzb'] },
            { name: 'Download', actions: ['Downloaded in 12 min at an average of 5.9 MB/s<br/>Age: 142d<br/>2 articles were malformed'] },
            { name: 'Servers', actions: ['NewsServer1=4.2 GB'] },
            { name: 'Repair', actions: ['[abcde12345] Repaired in 45 seconds'] },
            { name: 'Unpack', actions: ['[abcde12345] Unpacked 1 files/folders in 120 seconds'] },
        ],
    },
    {
        action_line: '',
        duplicate_key: 'TV.Show/3/7',
        meta: null,
        fail_message: '',
        loaded: false,
        size: '1.1 GB',
        category: 'tv',
        pp: 'D',
        retry: 0,
        script: 'notify.py',
        nzb_name: 'TV.Show.S03E07.1080p.HDTV.x264-FLEET.nzb',
        download_time: 240,
        storage: '/data/complete/tv/TV.Show.S03E07',
        has_rating: false,
        status: 'Completed',
        script_line: 'Notification sent successfully',
        completed: now - 18000,
        time_added: now - 18500,
        nzo_id: 'SABnzbd_nzo_hist02',
        downloaded: 1181116006,
        report: '',
        password: '',
        path: '/data/incomplete/TV.Show.S03E07',
        postproc_time: 60,
        name: 'TV.Show.S03E07.1080p.HDTV.x264-FLEET',
        url: 'TV.Show.S03E07.1080p.HDTV.x264-FLEET.nzb',
        md5sum: 'e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        archive: false,
        bytes: 1181116006,
        url_info: '',
        stage_log: [
            { name: 'Source', actions: ['TV.Show.S03E07.1080p.HDTV.x264-FLEET.nzb'] },
            { name: 'Download', actions: ['Downloaded in 4 min at an average of 4.7 MB/s<br/>Age: 89d'] },
            { name: 'Servers', actions: ['NewsServer1=1.1 GB'] },
            { name: 'Repair', actions: ['[fghij67890] Quick Check OK'] },
            { name: 'Unpack', actions: ['[fghij67890] Unpacked 1 files/folders in 12 seconds'] },
        ],
    },
    {
        action_line: '',
        duplicate_key: 'Failed.Download/1',
        meta: null,
        fail_message: 'Unpacking failed, write error or disk full?',
        loaded: false,
        size: '3.5 GB',
        category: 'movies',
        pp: 'D',
        retry: 1,
        script: 'None',
        nzb_name: 'Failed.Download.2024.BluRay.x264-GROUP.nzb',
        download_time: 600,
        storage: '',
        has_rating: false,
        status: 'Failed',
        script_line: '',
        completed: now - 86400,
        time_added: now - 87400,
        nzo_id: 'SABnzbd_nzo_hist03',
        downloaded: 3758096384,
        report: '',
        password: '',
        path: '/data/incomplete/Failed.Download.2024',
        postproc_time: 15,
        name: 'Failed.Download.2024.BluRay.x264-GROUP',
        url: 'Failed.Download.2024.BluRay.x264-GROUP.nzb',
        md5sum: 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
        archive: false,
        bytes: 3758096384,
        url_info: '',
        stage_log: [
            { name: 'Source', actions: ['Failed.Download.2024.BluRay.x264-GROUP.nzb'] },
            { name: 'Download', actions: ['Downloaded in 10 min at an average of 5.9 MB/s<br/>Age: 200d<br/>45 articles were missing'] },
            { name: 'Servers', actions: ['NewsServer1=3.1 GB', 'BackupServer=400 MB'] },
            { name: 'Repair', actions: ['[klmno54321] Repair failed, not enough repair blocks (0/12 blocks available)'] },
        ],
    },
    {
        action_line: '',
        duplicate_key: 'Another.Show/1/5',
        meta: null,
        fail_message: '',
        loaded: false,
        size: '850 MB',
        category: 'tv',
        pp: 'U',
        retry: 0,
        script: 'None',
        nzb_name: 'Another.Show.S01E05.720p.WEB-DL.nzb',
        download_time: 180,
        storage: '/data/complete/tv/Another.Show.S01E05',
        has_rating: false,
        status: 'Completed',
        script_line: '',
        completed: now - 172800,
        time_added: now - 173200,
        nzo_id: 'SABnzbd_nzo_hist04',
        downloaded: 891289600,
        report: '',
        password: '',
        path: '/data/incomplete/Another.Show.S01E05',
        postproc_time: 30,
        name: 'Another.Show.S01E05.720p.WEB-DL',
        url: 'Another.Show.S01E05.720p.WEB-DL.nzb',
        md5sum: 'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1',
        archive: true,
        bytes: 891289600,
        url_info: '',
        stage_log: [
            { name: 'Source', actions: ['Another.Show.S01E05.720p.WEB-DL.nzb'] },
            { name: 'Download', actions: ['Downloaded in 3 min at an average of 4.4 MB/s<br/>Age: 30d'] },
            { name: 'Servers', actions: ['NewsServer1=850 MB'] },
            { name: 'Repair', actions: ['[pqrst09876] Quick Check OK'] },
            { name: 'Unpack', actions: ['[pqrst09876] Unpacked 1 files/folders in 8 seconds'] },
        ],
    },
    {
        action_line: '',
        duplicate_key: 'Audiobook/1',
        meta: null,
        fail_message: 'Out of retention',
        loaded: false,
        size: '600 MB',
        category: 'audio',
        pp: 'D',
        retry: 0,
        script: 'None',
        nzb_name: 'Audiobook.Complete.2024.nzb',
        download_time: 0,
        storage: '',
        has_rating: false,
        status: 'Failed',
        script_line: '',
        completed: now - 259200,
        time_added: now - 259400,
        nzo_id: 'SABnzbd_nzo_hist05',
        downloaded: 0,
        report: '',
        password: '',
        path: '/data/incomplete/Audiobook.Complete.2024',
        postproc_time: 0,
        name: 'Audiobook.Complete.2024',
        url: 'Audiobook.Complete.2024.nzb',
        md5sum: 'f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
        archive: false,
        bytes: 0,
        url_info: '',
        stage_log: [
            { name: 'Source', actions: ['Audiobook.Complete.2024.nzb'] },
            { name: 'Download', actions: ['All articles were missing, out of retention (3000+ days)'] },
            { name: 'Servers', actions: ['NewsServer1=0 B'] },
        ],
    },
];

// Per-job file lists — only returned for queue items
const jobFiles: Record<string, FileEntry[]> = {
    'SABnzbd_nzo_abc123': [
        { status: 'finished', mbleft: '0.00', mb: '0.05', age: '142d', bytes: '52161.00', filename: 'movie2024.par2', nzf_id: 'SABnzbd_nzf_f1a' },
        { status: 'finished', mbleft: '0.00', mb: '95.20', age: '142d', bytes: '99824640.00', filename: 'movie2024.part01.rar', nzf_id: 'SABnzbd_nzf_f1b' },
        { status: 'finished', mbleft: '0.00', mb: '95.20', age: '142d', bytes: '99824640.00', filename: 'movie2024.part02.rar', nzf_id: 'SABnzbd_nzf_f1c' },
        { status: 'active', mbleft: '45.30', mb: '95.20', age: '142d', bytes: '99824640.00', filename: 'movie2024.part03.rar', nzf_id: 'SABnzbd_nzf_f1d' },
        { status: 'queued', set: 'movie2024', mbleft: '12.50', mb: '12.50', age: '142d', bytes: '13107200.00', filename: 'movie2024.vol000+04.par2', nzf_id: 'SABnzbd_nzf_f1e' },
        { status: 'queued', set: 'movie2024', mbleft: '25.00', mb: '25.00', age: '142d', bytes: '26214400.00', filename: 'movie2024.vol004+08.par2', nzf_id: 'SABnzbd_nzf_f1f' },
    ],
    'SABnzbd_nzo_def456': [
        { status: 'finished', mbleft: '0.00', mb: '0.03', age: '89d', bytes: '31457.00', filename: 'tvshow.s03e08.par2', nzf_id: 'SABnzbd_nzf_f2a' },
        { status: 'active', mbleft: '200.00', mb: '405.00', age: '89d', bytes: '424673280.00', filename: 'tvshow.s03e08.part01.rar', nzf_id: 'SABnzbd_nzf_f2b' },
        { status: 'queued', mbleft: '405.00', mb: '405.00', age: '89d', bytes: '424673280.00', filename: 'tvshow.s03e08.part02.rar', nzf_id: 'SABnzbd_nzf_f2c' },
        { status: 'queued', set: 'tvshow.s03e08', mbleft: '5.00', mb: '5.00', age: '89d', bytes: '5242880.00', filename: 'tvshow.s03e08.vol000+02.par2', nzf_id: 'SABnzbd_nzf_f2d' },
    ],
};

// Server statistics — exact shape from SABnzbd API docs
const serverStats = {
    day: 5234567890,
    week: 38456789012,
    month: 198765432100,
    total: 845678901234,
    servers: {
        'NewsServer1': {
            week: 28456789012,
            total: 545678901234,
            day: 4234567890,
            month: 148765432100,
            daily: { '2024-01-15': 2345678, '2024-01-16': 3456789 },
            articles_tried: 1234567,
            articles_success: 1198765,
        },
        'BackupServer': {
            week: 10000000000,
            total: 300000000000,
            day: 1000000000,
            month: 50000000000,
            daily: { '2024-01-15': 456789, '2024-01-16': 567890 },
            articles_tried: 89012,
            articles_success: 45678,
        },
    },
};

// Categories and scripts
const categories = ['*', 'movies', 'tv', 'audio', 'software', 'ebooks'];
const scripts = ['None', 'notify.py', 'cleanup.sh', 'post-process.py'];

// =============================================================================
// PROGRESS SIMULATION — Move downloads forward over time
// =============================================================================

function simulateProgress(): void {
    for (const slot of queueSlots) {
        if (slot.status === 'Downloading' && !globalPaused) {
            const totalMb = parseFloat(slot.mb);
            let remaining = parseFloat(slot.mbleft);
            // Download ~5-15 MB per tick (5 seconds)
            const downloaded = 5 + Math.random() * 10;
            remaining = Math.max(0, remaining - downloaded);
            slot.mbleft = remaining.toFixed(2);
            const pct = ((totalMb - remaining) / totalMb * 100);
            slot.percentage = Math.min(100, pct).toFixed(0);
            slot.sizeleft = `${(remaining / 1024).toFixed(1)} GB`;

            // Calculate ETA
            if (remaining > 0) {
                const secsLeft = Math.round(remaining / (downloaded / 5));
                const h = Math.floor(secsLeft / 3600);
                const m = Math.floor((secsLeft % 3600) / 60);
                const s = secsLeft % 60;
                slot.timeleft = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            } else {
                slot.timeleft = '0:00:00';
                // Move to post-processing states
                slot.status = 'Verifying';
                setTimeout(() => {
                    if (slot.status === 'Verifying') {
                        slot.status = 'Repairing';
                        setTimeout(() => {
                            if (slot.status === 'Repairing') {
                                slot.status = 'Extracting';
                                setTimeout(() => {
                                    if (slot.status === 'Extracting') {
                                        // Move to history
                                        moveToHistory(slot);
                                    }
                                }, 8000);
                            }
                        }, 5000);
                    }
                }, 3000);
            }
        }
    }
}

function moveToHistory(slot: QueueSlot): void {
    const totalBytes = parseFloat(slot.mb) * 1024 * 1024;
    const histEntry: HistorySlot = {
        action_line: '',
        duplicate_key: slot.filename.replace(/\./g, '/').substring(0, 20),
        meta: null,
        fail_message: '',
        loaded: false,
        size: slot.size,
        category: slot.cat,
        pp: 'D',
        retry: 0,
        script: slot.script,
        nzb_name: `${slot.filename}.nzb`,
        download_time: Math.floor(Math.random() * 600) + 60,
        storage: `/data/complete/${slot.cat}/${slot.filename}`,
        has_rating: false,
        status: 'Completed',
        script_line: '',
        completed: Math.floor(Date.now() / 1000),
        time_added: slot.time_added,
        nzo_id: slot.nzo_id,
        downloaded: totalBytes,
        report: '',
        password: slot.password,
        path: `/data/incomplete/${slot.filename}`,
        postproc_time: Math.floor(Math.random() * 120) + 10,
        name: slot.filename,
        url: `${slot.filename}.nzb`,
        md5sum: Math.random().toString(16).substring(2, 34).padEnd(32, '0'),
        archive: false,
        bytes: totalBytes,
        url_info: '',
        stage_log: [
            { name: 'Source', actions: [`${slot.filename}.nzb`] },
            { name: 'Download', actions: [`Downloaded at an average of 5.2 MB/s<br/>Age: ${slot.avg_age}`] },
            { name: 'Servers', actions: [`NewsServer1=${slot.size}`] },
            { name: 'Repair', actions: ['Quick Check OK'] },
            { name: 'Unpack', actions: ['Unpacked 1 files/folders'] },
        ],
    };

    // Remove from queue, add to history front
    queueSlots = queueSlots.filter(s => s.nzo_id !== slot.nzo_id);
    historySlots.unshift(histEntry);
    console.log(`[SABNZBD] Job completed: ${slot.filename} → moved to history`);
}

// Simulate progress every 5 seconds
setInterval(simulateProgress, 5000);

// =============================================================================
// COMPUTED VALUES
// =============================================================================

function computeQueueTotals() {
    let totalMb = 0;
    let totalLeft = 0;
    for (const s of queueSlots) {
        totalMb += parseFloat(s.mb);
        totalLeft += parseFloat(s.mbleft);
    }
    // Simulated speed: 4-6 MB/s when not paused
    const speed = globalPaused ? 0 : (4000 + Math.random() * 2000);
    const kbpersec = globalPaused ? '0' : speed.toFixed(2);
    const speedStr = globalPaused ? '0 ' : `${(speed / 1024).toFixed(1)} M`;
    const totalTimeleft = globalPaused ? '0:00:00' : (() => {
        const secsLeft = Math.round(totalLeft / (speed / 1024));
        const h = Math.floor(secsLeft / 3600);
        const m = Math.floor((secsLeft % 3600) / 60);
        const s = secsLeft % 60;
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    })();

    return {
        status: globalPaused ? 'Paused' : (queueSlots.some(s => s.status === 'Downloading') ? 'Downloading' : 'Idle'),
        speedlimit: speedLimitPercent,
        speedlimit_abs: `${parseFloat(speedLimitPercent) / 100 * 10 * 1024 * 1024}`,
        paused: globalPaused,
        noofslots_total: queueSlots.length,
        noofslots: queueSlots.length,
        limit: 20,
        start: 0,
        timeleft: totalTimeleft,
        speed: speedStr,
        kbpersec,
        size: `${(totalMb / 1024).toFixed(1)} GB`,
        sizeleft: `${(totalLeft / 1024).toFixed(1)} GB`,
        mb: totalMb.toFixed(2),
        mbleft: totalLeft.toFixed(2),
    };
}

// =============================================================================
// EXPRESS APP
// =============================================================================

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
    const mode = req.query.mode || req.body?.mode || '?';
    console.log(`[SABNZBD] ${req.method} ${req.path} mode=${mode}`);
    next();
});

// =============================================================================
// API ENDPOINT — All SABnzbd API calls go to /api with query params
// =============================================================================

app.get('/api', (req: Request, res: Response): void => {
    const { mode, apikey, name, value, value2, limit, start, search, cat: catFilter, nzo_ids } = req.query as Record<string, string>;

    // Auth check
    if (apikey !== API_KEY) {
        res.status(403).json({ error: 'API Key Required' });
        return;
    }

    switch (mode) {
        // -----------------------------------------------------------------
        // mode=version — Connection test
        // -----------------------------------------------------------------
        case 'version':
            res.json({ version: SAB_VERSION });
            break;

        // -----------------------------------------------------------------
        // mode=queue — Full queue output
        // -----------------------------------------------------------------
        case 'queue': {
            // Handle queue sub-actions via name parameter
            if (name) {
                handleQueueAction(name, value, value2, res);
                return;
            }

            const totals = computeQueueTotals();
            let slots = [...queueSlots];

            // Filter by nzo_ids
            if (nzo_ids) {
                const ids = nzo_ids.split(',');
                slots = slots.filter(s => ids.includes(s.nzo_id));
            }
            // Filter by category
            if (catFilter && catFilter !== '*') {
                slots = slots.filter(s => s.cat === catFilter);
            }
            // Search
            if (search) {
                const q = search.toLowerCase();
                slots = slots.filter(s => s.filename.toLowerCase().includes(q));
            }
            // Pagination
            const startIdx = parseInt(start || '0');
            const limitN = parseInt(limit || '20');
            slots = slots.slice(startIdx, startIdx + limitN);

            res.json({
                queue: {
                    ...totals,
                    slots,
                    diskspace1: '500.00',
                    diskspace2: '500.00',
                    diskspacetotal1: '1000.00',
                    diskspacetotal2: '1000.00',
                    diskspace1_norm: '500.0 G',
                    diskspace2_norm: '500.0 G',
                    have_warnings: '0',
                    pause_int: '0',
                    left_quota: '0 ',
                    version: SAB_VERSION,
                    finish: queueSlots.length,
                    cache_art: '64',
                    cache_size: '32 MB',
                    finishaction: null,
                    paused_all: globalPaused,
                    quota: '0 ',
                    have_quota: false,
                },
            });
            break;
        }

        // -----------------------------------------------------------------
        // mode=history — Full history output
        // -----------------------------------------------------------------
        case 'history': {
            let slots = [...historySlots];

            // Filter by nzo_ids
            if (nzo_ids) {
                const ids = nzo_ids.split(',');
                slots = slots.filter(s => ids.includes(s.nzo_id));
            }
            // Filter by category
            if (catFilter && catFilter !== '*') {
                slots = slots.filter(s => s.category === catFilter);
            }
            // Search
            if (search) {
                const q = search.toLowerCase();
                slots = slots.filter(s => s.name.toLowerCase().includes(q));
            }
            // Pagination
            const startIdx = parseInt(start || '0');
            const limitN = parseInt(limit || '20');
            slots = slots.slice(startIdx, startIdx + limitN);

            const totalBytes = historySlots.reduce((s, h) => s + h.bytes, 0);
            res.json({
                history: {
                    noofslots: historySlots.length,
                    ppslots: 0,
                    day_size: `${(totalBytes / 1024 / 1024 / 1024 * 0.1).toFixed(1)} G`,
                    week_size: `${(totalBytes / 1024 / 1024 / 1024 * 0.3).toFixed(1)} G`,
                    month_size: `${(totalBytes / 1024 / 1024 / 1024 * 0.8).toFixed(1)} G`,
                    total_size: `${(totalBytes / 1024 / 1024 / 1024).toFixed(1)} G`,
                    last_history_update: Math.floor(Date.now() / 1000),
                    slots,
                },
            });
            break;
        }

        // -----------------------------------------------------------------
        // mode=get_files — Files within a queue job
        // -----------------------------------------------------------------
        case 'get_files': {
            const nzoId = value;
            const files = jobFiles[nzoId] || [];
            res.json({ files });
            break;
        }

        // -----------------------------------------------------------------
        // mode=server_stats — Download statistics per server
        // -----------------------------------------------------------------
        case 'server_stats':
            res.json(serverStats);
            break;

        // -----------------------------------------------------------------
        // mode=status — Server status with connection info
        // -----------------------------------------------------------------
        case 'status':
            res.json({
                status: {
                    localipv4: '192.168.1.100',
                    ipv6: null,
                    publicipv4: '',
                    dnslookup: 'OK',
                    folders: [],
                    cpumodel: 'Mock CPU',
                    pystone: 100000,
                    loadavg: '',
                    downloaddir: '/data/incomplete',
                    downloaddirspeed: 0,
                    completedir: '/data/complete',
                    completedirspeed: 0,
                    loglevel: '1',
                    logfile: '/var/log/sabnzbd.log',
                    configfn: '/etc/sabnzbd.ini',
                    nt: false,
                    darwin: false,
                    uptime: '2d 5h',
                    color_scheme: 'Default',
                    active_lang: 'en',
                    restart_req: false,
                    power_options: true,
                    pp_pause_event: false,
                    pid: 12345,
                    weblogfile: null,
                    new_release: false,
                    new_rel_url: null,
                    have_warnings: '0',
                    warnings: [],
                    servers: [
                        {
                            servername: 'NewsServer1',
                            servertotalconn: 30,
                            serverssl: 1,
                            serveractiveconn: 25,
                            serveroptional: 0,
                            serveractive: true,
                            servererror: '',
                            serverpriority: 0,
                            serverbps: globalPaused ? '0 ' : '4.8 M',
                            serverconnections: globalPaused ? [] : [
                                { thrdnum: 1, nzo_name: queueSlots[0]?.filename || '', nzf_name: 'file.part01.rar', art_name: '1234567890$poster@usenet' },
                                { thrdnum: 2, nzo_name: queueSlots[0]?.filename || '', nzf_name: 'file.part02.rar', art_name: '1234567891$poster@usenet' },
                            ],
                        },
                        {
                            servername: 'BackupServer',
                            servertotalconn: 10,
                            serverssl: 1,
                            serveractiveconn: 0,
                            serveroptional: 1,
                            serveractive: true,
                            servererror: '',
                            serverpriority: 1,
                            serverbps: '0 ',
                            serverconnections: [],
                        },
                    ],
                },
            });
            break;

        // -----------------------------------------------------------------
        // mode=get_cats — Available categories
        // -----------------------------------------------------------------
        case 'get_cats':
            res.json({ categories });
            break;

        // -----------------------------------------------------------------
        // mode=get_scripts — Available post-processing scripts
        // -----------------------------------------------------------------
        case 'get_scripts':
            res.json({ scripts });
            break;

        // -----------------------------------------------------------------
        // mode=pause — Global pause (matches real SABnzbd: items become 'Paused')
        // -----------------------------------------------------------------
        case 'pause':
            globalPaused = true;
            // Real SABnzbd changes individual item statuses to 'Paused'
            individuallyPaused.clear();
            for (const slot of queueSlots) {
                if (slot.status === 'Paused') {
                    // Already individually paused — remember so we don't auto-resume
                    individuallyPaused.add(slot.nzo_id);
                } else if (slot.status === 'Downloading') {
                    slot.status = 'Paused';
                }
            }
            console.log('[SABNZBD] Global PAUSE — all downloading items set to Paused');
            res.json({ status: true });
            break;

        // -----------------------------------------------------------------
        // mode=resume — Global resume (matches real SABnzbd: items resume)
        // -----------------------------------------------------------------
        case 'resume':
            globalPaused = false;
            // Real SABnzbd resumes items that weren't individually paused
            for (const slot of queueSlots) {
                if (slot.status === 'Paused' && !individuallyPaused.has(slot.nzo_id)) {
                    slot.status = 'Downloading';
                }
            }
            individuallyPaused.clear();
            console.log('[SABNZBD] Global RESUME — paused items restored to Downloading');
            res.json({ status: true });
            break;

        // -----------------------------------------------------------------
        // mode=change_cat — Change job category
        // -----------------------------------------------------------------
        case 'change_cat': {
            const nzoId = value;
            const newCat = value2;
            const slot = queueSlots.find(s => s.nzo_id === nzoId);
            if (slot && newCat) {
                const oldCat = slot.cat;
                slot.cat = newCat;
                console.log(`[SABNZBD] Category changed: ${nzoId} ${oldCat} → ${newCat}`);
            }
            res.json({ status: true });
            break;
        }

        // -----------------------------------------------------------------
        // mode=change_opts — Change job post-processing options
        // -----------------------------------------------------------------
        case 'change_opts': {
            const nzoId = value;
            const newOpts = value2;
            const slot = queueSlots.find(s => s.nzo_id === nzoId);
            if (slot && newOpts) {
                slot.unpackopts = newOpts;
                console.log(`[SABNZBD] PP options changed: ${nzoId} → ${newOpts}`);
            }
            res.json({ status: true });
            break;
        }

        // -----------------------------------------------------------------
        // Unknown mode
        // -----------------------------------------------------------------
        default:
            console.log(`[SABNZBD] Unknown mode: ${mode}`);
            res.json({ error: `Unknown mode: ${mode}` });
            break;
    }
});

// Also handle POST for API (some clients POST)
app.post('/api', (req: Request, res: Response): void => {
    // Forward to GET handler by merging body into query
    req.query = { ...req.query, ...req.body };
    app.handle(req, res, () => { });
});

// =============================================================================
// QUEUE SUB-ACTIONS (mode=queue&name=ACTION)
// =============================================================================

function handleQueueAction(action: string, nzoId: string, value2: string, res: Response): void {
    switch (action) {
        case 'pause': {
            const slot = queueSlots.find(s => s.nzo_id === nzoId);
            if (slot) {
                slot.status = 'Paused';
                console.log(`[SABNZBD] Paused: ${slot.filename}`);
            }
            res.json({ status: true });
            break;
        }

        case 'resume': {
            const slot = queueSlots.find(s => s.nzo_id === nzoId);
            if (slot) {
                slot.status = 'Downloading';
                console.log(`[SABNZBD] Resumed: ${slot.filename}`);
            }
            res.json({ status: true });
            break;
        }

        case 'delete': {
            const before = queueSlots.length;
            queueSlots = queueSlots.filter(s => s.nzo_id !== nzoId);
            if (queueSlots.length < before) {
                console.log(`[SABNZBD] Deleted from queue: ${nzoId}`);
            }
            res.json({ status: true });
            break;
        }

        case 'priority': {
            const slot = queueSlots.find(s => s.nzo_id === nzoId);
            if (slot && value2) {
                const priMap: Record<string, string> = { '-1': 'Low', '0': 'Normal', '1': 'High', '2': 'Force' };
                slot.priority = priMap[value2] || 'Normal';
                console.log(`[SABNZBD] Priority: ${slot.filename} → ${slot.priority}`);
            }
            // SABnzbd returns the new position after reprioritization
            res.json({ result: 0, position: 0 });
            break;
        }

        case 'rename': {
            const slot = queueSlots.find(s => s.nzo_id === nzoId);
            if (slot && value2) {
                const oldName = slot.filename;
                slot.filename = value2;
                console.log(`[SABNZBD] Renamed: ${oldName} → ${value2}`);
            }
            res.json({ status: true });
            break;
        }

        default:
            console.log(`[SABNZBD] Unknown queue action: ${action}`);
            res.json({ status: false, error: `Unknown action: ${action}` });
    }
}

// =============================================================================
// MOCK CONTROL ENDPOINTS (for manual testing)
// =============================================================================

// View current state
app.get('/mock/state', (_req, res) => {
    res.json({
        globalPaused,
        speedLimitPercent,
        queueItems: queueSlots.length,
        historyItems: historySlots.length,
        queue: queueSlots.map(s => ({ nzo_id: s.nzo_id, filename: s.filename, status: s.status, percentage: s.percentage })),
        history: historySlots.map(s => ({ nzo_id: s.nzo_id, name: s.name, status: s.status })),
    });
});

// Add a new queue item
app.post('/mock/add', (req, res) => {
    const { filename, size, cat, priority } = req.body as {
        filename?: string; size?: number; cat?: string; priority?: string;
    };
    const mb = (size || 1000).toString();
    const newSlot: QueueSlot = {
        status: 'Queued',
        index: queueSlots.length,
        password: '',
        avg_age: '5d',
        time_added: Math.floor(Date.now() / 1000),
        script: 'None',
        direct_unpack: null,
        mb,
        mbleft: mb,
        mbmissing: '0.0',
        size: `${(parseFloat(mb) / 1024).toFixed(1)} GB`,
        sizeleft: `${(parseFloat(mb) / 1024).toFixed(1)} GB`,
        filename: filename || `New.Download.${Date.now()}.nzb`,
        labels: [],
        priority: priority || 'Normal',
        cat: cat || 'movies',
        timeleft: '0:00:00',
        percentage: '0',
        nzo_id: `SABnzbd_nzo_${Date.now().toString(36)}`,
        unpackopts: '3',
    };
    queueSlots.push(newSlot);
    console.log(`[SABNZBD] Mock: Added queue item "${newSlot.filename}"`);
    res.json({ status: true, nzo_id: newSlot.nzo_id });
});

// Reset to defaults
app.post('/mock/reset', (_req, res) => {
    console.log('[SABNZBD] Mock: Resetting state to defaults');
    globalPaused = false;
    speedLimitPercent = '100';
    // Slots will persist — restart the server for full reset
    res.json({ status: true });
});

// Catch-all for unknown routes
app.use((req, res) => {
    console.log(`[SABNZBD] Unhandled: ${req.method} ${req.path}`);
    res.status(404).json({ error: 'Not found', path: req.path });
});

// =============================================================================
// START SERVER
// =============================================================================

app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  MOCK SABNZBD SERVER RUNNING');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('  Configure in Framerr:');
    console.log(`    URL:      http://localhost:${PORT}`);
    console.log(`    API Key:  ${API_KEY}`);
    console.log('');
    console.log('  Mock Data:');
    console.log(`    - ${queueSlots.length} Queue items (various states)`);
    console.log(`    - ${historySlots.length} History items (completed + failed)`);
    console.log(`    - 2 Usenet servers (primary + backup)`);
    console.log(`    - ${categories.length} Categories`);
    console.log(`    - ${scripts.length} Scripts`);
    console.log('');
    console.log('  Features:');
    console.log('    - Live progress simulation (downloads advance every 5s)');
    console.log('    - Post-processing states (Verifying → Repairing → Extracting)');
    console.log('    - Items auto-move to history on completion');
    console.log('    - All action endpoints functional (pause/resume/delete/priority)');
    console.log('');
    console.log('  Mock Control:');
    console.log(`    GET  http://localhost:${PORT}/mock/state   — View current state`);
    console.log(`    POST http://localhost:${PORT}/mock/add     — Add queue item`);
    console.log(`    POST http://localhost:${PORT}/mock/reset   — Reset pause/speed`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
});
