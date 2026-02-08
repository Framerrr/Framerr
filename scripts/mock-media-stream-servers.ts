/**
 * Mock Jellyfin & Emby Servers
 * 
 * Simulates Jellyfin (port 8096) and Emby (port 8097) APIs for testing
 * Media Stream Widget integration without real infrastructure.
 * 
 * Features:
 * - Real TMDB IDs for accurate metadata matching
 * - Proxied poster images from TMDB CDN
 * - Active playback sessions simulation
 * - Library sync endpoints
 * - WebSocket support for real-time updates (toggleable)
 * 
 * Usage:
 *   npx tsx scripts/mock-media-stream-servers.ts
 *   npx tsx scripts/mock-media-stream-servers.ts --no-websocket  # Disable WS to test polling fallback
 * 
 * Configure Framerr:
 *   - Jellyfin: http://localhost:8096 (API key: mock-jellyfin-key, User ID: mock-user-id)
 *   - Emby: http://localhost:8097 (API key: mock-emby-key, User ID: mock-user-id)
 */

import express, { Request, Response } from 'express';
import https from 'https';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

// =============================================================================
// CONFIGURATION
// =============================================================================

const JELLYFIN_PORT = 8096;
const EMBY_PORT = 8097;

// Parse CLI args for WebSocket toggle
const WEBSOCKET_ENABLED = !process.argv.includes('--no-websocket');

const API_KEYS = {
    jellyfin: 'mock-jellyfin-key',
    emby: 'mock-emby-key',
};

const MOCK_USER_ID = 'mock-user-id';
const MOCK_SERVER_ID = 'mock-server-id-12345';

// =============================================================================
// MOCK LIBRARY DATA - Real TMDB IDs and Poster Paths
// =============================================================================

interface MockItem {
    id: string;
    name: string;
    type: 'Movie' | 'Series' | 'Episode';
    tmdbId: number;
    posterPath: string | null;
    year?: number;
    overview?: string;
    // Rich metadata for modal display
    summary?: string;
    rating?: number;
    genres?: string[];
    actors?: string[];
    directors?: string[];
    resolution?: string;
    // For episodes
    seriesName?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    // Runtime in ticks (1 tick = 100 nanoseconds, 10000 ticks = 1ms)
    runTimeTicks?: number;
}

// 50 Movies with real TMDB IDs and poster paths
const MOCK_MOVIES: MockItem[] = [
    { id: 'movie-1', name: 'Dune: Part Two', type: 'Movie', tmdbId: 693134, posterPath: '/8b8R8l88Qje9dn9OE8PY05Nxl1X.jpg', year: 2024, runTimeTicks: 166 * 60 * 10000000 },
    { id: 'movie-2', name: 'Gladiator II', type: 'Movie', tmdbId: 558449, posterPath: '/2cxhvwyEwRlysAmRH4iodkvo0z5.jpg', year: 2024, runTimeTicks: 148 * 60 * 10000000 },
    { id: 'movie-3', name: 'Wicked', type: 'Movie', tmdbId: 402431, posterPath: '/2C0A2gj4kqW2s9z2jOJD8WvmA5s.jpg', year: 2024, runTimeTicks: 160 * 60 * 10000000 },
    { id: 'movie-4', name: 'Oppenheimer', type: 'Movie', tmdbId: 872585, posterPath: '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', year: 2023, runTimeTicks: 180 * 60 * 10000000 },
    { id: 'movie-5', name: 'Barbie', type: 'Movie', tmdbId: 346698, posterPath: '/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg', year: 2023, runTimeTicks: 114 * 60 * 10000000 },
    { id: 'movie-6', name: 'The Batman', type: 'Movie', tmdbId: 414906, posterPath: '/74xTEgt7R36Fvdq4aQvXLmDqHWg.jpg', year: 2022, runTimeTicks: 176 * 60 * 10000000 },
    { id: 'movie-7', name: 'Top Gun: Maverick', type: 'Movie', tmdbId: 361743, posterPath: '/62HCnUTziyWcpDaBO2i1DX17ljH.jpg', year: 2022, runTimeTicks: 130 * 60 * 10000000 },
    { id: 'movie-8', name: 'Spider-Man: No Way Home', type: 'Movie', tmdbId: 634649, posterPath: '/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg', year: 2021, runTimeTicks: 148 * 60 * 10000000 },
    { id: 'movie-9', name: 'Avatar: The Way of Water', type: 'Movie', tmdbId: 76600, posterPath: '/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg', year: 2022, runTimeTicks: 192 * 60 * 10000000 },
    { id: 'movie-10', name: 'The Dark Knight', type: 'Movie', tmdbId: 155, posterPath: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg', year: 2008, runTimeTicks: 152 * 60 * 10000000 },
    { id: 'movie-11', name: 'Inception', type: 'Movie', tmdbId: 27205, posterPath: '/9gk7adHYeDvHkCSEqAvQNLV5Ber.jpg', year: 2010, runTimeTicks: 148 * 60 * 10000000 },
    { id: 'movie-12', name: 'Interstellar', type: 'Movie', tmdbId: 157336, posterPath: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', year: 2014, runTimeTicks: 169 * 60 * 10000000 },
    { id: 'movie-13', name: 'The Shawshank Redemption', type: 'Movie', tmdbId: 278, posterPath: '/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg', year: 1994, runTimeTicks: 142 * 60 * 10000000 },
    { id: 'movie-14', name: 'Pulp Fiction', type: 'Movie', tmdbId: 680, posterPath: '/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg', year: 1994, runTimeTicks: 154 * 60 * 10000000 },
    { id: 'movie-15', name: 'Fight Club', type: 'Movie', tmdbId: 550, posterPath: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg', year: 1999, runTimeTicks: 139 * 60 * 10000000 },
    { id: 'movie-16', name: 'The Matrix', type: 'Movie', tmdbId: 603, posterPath: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg', year: 1999, runTimeTicks: 136 * 60 * 10000000 },
    { id: 'movie-17', name: 'Forrest Gump', type: 'Movie', tmdbId: 13, posterPath: '/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg', year: 1994, runTimeTicks: 142 * 60 * 10000000 },
    { id: 'movie-18', name: 'The Godfather', type: 'Movie', tmdbId: 238, posterPath: '/3bhkrj58Vtu7enYsRolD1fZdja1.jpg', year: 1972, runTimeTicks: 175 * 60 * 10000000 },
    { id: 'movie-19', name: 'Goodfellas', type: 'Movie', tmdbId: 769, posterPath: '/aKuFiU82s5ISJpGZp7YkIr3kCUd.jpg', year: 1990, runTimeTicks: 145 * 60 * 10000000 },
    { id: 'movie-20', name: 'The Lord of the Rings: The Fellowship of the Ring', type: 'Movie', tmdbId: 120, posterPath: '/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg', year: 2001, runTimeTicks: 178 * 60 * 10000000 },
    { id: 'movie-21', name: 'The Lord of the Rings: The Two Towers', type: 'Movie', tmdbId: 121, posterPath: '/5VTN0pR8gcqV3EPUHHfMGnJYN9L.jpg', year: 2002, runTimeTicks: 179 * 60 * 10000000 },
    { id: 'movie-22', name: 'The Lord of the Rings: The Return of the King', type: 'Movie', tmdbId: 122, posterPath: '/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg', year: 2003, runTimeTicks: 201 * 60 * 10000000 },
    { id: 'movie-23', name: 'Star Wars: Episode IV - A New Hope', type: 'Movie', tmdbId: 11, posterPath: '/6FfCtAuVAW8XJjZ7eWeLibRLWTw.jpg', year: 1977, runTimeTicks: 121 * 60 * 10000000 },
    { id: 'movie-24', name: 'The Empire Strikes Back', type: 'Movie', tmdbId: 1891, posterPath: '/nNAeTmF4CtdSgMDplXTDPOpYzsX.jpg', year: 1980, runTimeTicks: 124 * 60 * 10000000 },
    { id: 'movie-25', name: 'Return of the Jedi', type: 'Movie', tmdbId: 1892, posterPath: '/jQYlydvHm3kRy8EV6F63PiMnmTO.jpg', year: 1983, runTimeTicks: 132 * 60 * 10000000 },
    { id: 'movie-26', name: 'Avengers: Endgame', type: 'Movie', tmdbId: 299534, posterPath: '/or06FN3Dka5tukK1e9sl16pB3iy.jpg', year: 2019, runTimeTicks: 181 * 60 * 10000000 },
    { id: 'movie-27', name: 'Avengers: Infinity War', type: 'Movie', tmdbId: 299536, posterPath: '/7WsyChQLEftFiDOVTGkv3hFpyht.jpg', year: 2018, runTimeTicks: 149 * 60 * 10000000 },
    { id: 'movie-28', name: 'Iron Man', type: 'Movie', tmdbId: 1726, posterPath: '/78lPtwv72eTNqFW9COBYI0dWDJa.jpg', year: 2008, runTimeTicks: 126 * 60 * 10000000 },
    { id: 'movie-29', name: 'Black Panther', type: 'Movie', tmdbId: 284054, posterPath: '/uxzzxijgPIY7slzFvMotPv8wjKA.jpg', year: 2018, runTimeTicks: 134 * 60 * 10000000 },
    { id: 'movie-30', name: 'Guardians of the Galaxy', type: 'Movie', tmdbId: 118340, posterPath: '/r7vmZjiyZw9rpJMQJdXpjgiCOk9.jpg', year: 2014, runTimeTicks: 121 * 60 * 10000000 },
    { id: 'movie-31', name: 'Joker', type: 'Movie', tmdbId: 475557, posterPath: '/udDclJoHjfjb8Ekgsd4FDteOkCU.jpg', year: 2019, runTimeTicks: 122 * 60 * 10000000 },
    { id: 'movie-32', name: 'Parasite', type: 'Movie', tmdbId: 496243, posterPath: '/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg', year: 2019, runTimeTicks: 132 * 60 * 10000000 },
    { id: 'movie-33', name: 'Get Out', type: 'Movie', tmdbId: 419430, posterPath: '/tFXcEccSQMf3lfhfXKSU9iRBpa3.jpg', year: 2017, runTimeTicks: 104 * 60 * 10000000 },
    { id: 'movie-34', name: 'A Quiet Place', type: 'Movie', tmdbId: 447332, posterPath: '/nAU74GmpUk7t5iklEp3bufwDq4n.jpg', year: 2018, runTimeTicks: 90 * 60 * 10000000 },
    { id: 'movie-35', name: 'Hereditary', type: 'Movie', tmdbId: 493922, posterPath: '/p9fmuz2Emvz5tBaLzBVPaIvKR0P.jpg', year: 2018, runTimeTicks: 127 * 60 * 10000000 },
    { id: 'movie-36', name: 'Mad Max: Fury Road', type: 'Movie', tmdbId: 76341, posterPath: '/8tZYtuWezp8JbcsvHYO0O46tFbo.jpg', year: 2015, runTimeTicks: 120 * 60 * 10000000 },
    { id: 'movie-37', name: 'John Wick', type: 'Movie', tmdbId: 245891, posterPath: '/fZPSd91yGE9fCcCe6OoQr6E3Bev.jpg', year: 2014, runTimeTicks: 101 * 60 * 10000000 },
    { id: 'movie-38', name: 'John Wick: Chapter 4', type: 'Movie', tmdbId: 603692, posterPath: '/vZloFAK7NmvMGKE7VkatL8K0CJN.jpg', year: 2023, runTimeTicks: 169 * 60 * 10000000 },
    { id: 'movie-39', name: 'The Social Network', type: 'Movie', tmdbId: 37799, posterPath: '/n0ybibhJtQ5icDqTp8eRytcIHJx.jpg', year: 2010, runTimeTicks: 120 * 60 * 10000000 },
    { id: 'movie-40', name: 'Whiplash', type: 'Movie', tmdbId: 244786, posterPath: '/7fn624j5lj3xTme2SgiLCeuedmO.jpg', year: 2014, runTimeTicks: 107 * 60 * 10000000 },
    { id: 'movie-41', name: 'La La Land', type: 'Movie', tmdbId: 313369, posterPath: '/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg', year: 2016, runTimeTicks: 128 * 60 * 10000000 },
    { id: 'movie-42', name: 'The Grand Budapest Hotel', type: 'Movie', tmdbId: 120467, posterPath: '/eWdyYQreja6JGCzqHWXpWHDrrPo.jpg', year: 2014, runTimeTicks: 99 * 60 * 10000000 },
    { id: 'movie-43', name: 'Blade Runner 2049', type: 'Movie', tmdbId: 335984, posterPath: '/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg', year: 2017, runTimeTicks: 164 * 60 * 10000000 },
    { id: 'movie-44', name: 'Arrival', type: 'Movie', tmdbId: 329865, posterPath: '/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg', year: 2016, runTimeTicks: 116 * 60 * 10000000 },
    { id: 'movie-45', name: 'Ex Machina', type: 'Movie', tmdbId: 264660, posterPath: '/btbRB7BrD887j5NrvjxCeRHbR1.jpg', year: 2014, runTimeTicks: 108 * 60 * 10000000 },
    { id: 'movie-46', name: 'Everything Everywhere All at Once', type: 'Movie', tmdbId: 545611, posterPath: '/w3LxiVYdWWRvEVdn5RYq6jIqBVW.jpg', year: 2022, runTimeTicks: 139 * 60 * 10000000 },
    { id: 'movie-47', name: 'The Whale', type: 'Movie', tmdbId: 785084, posterPath: '/jQ0gylJMx9X4sPoBmLPXMIYdNi3.jpg', year: 2022, runTimeTicks: 117 * 60 * 10000000 },
    { id: 'movie-48', name: 'Poor Things', type: 'Movie', tmdbId: 792307, posterPath: '/kCGlIMHnOm8JPXq3rXM6c5wMxcT.jpg', year: 2023, runTimeTicks: 141 * 60 * 10000000 },
    { id: 'movie-49', name: 'Killers of the Flower Moon', type: 'Movie', tmdbId: 466420, posterPath: '/dB6Krk806zeqd0YNp2ngQ9zXteH.jpg', year: 2023, runTimeTicks: 206 * 60 * 10000000 },
    { id: 'movie-50', name: 'The Holdovers', type: 'Movie', tmdbId: 840430, posterPath: '/VHSzNBTwxV8vh7wylo7O9CLdac.jpg', year: 2023, runTimeTicks: 133 * 60 * 10000000 },
];

// 35 TV Series with real TMDB IDs
const MOCK_SERIES: MockItem[] = [
    { id: 'series-1', name: 'Breaking Bad', type: 'Series', tmdbId: 1396, posterPath: '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg', year: 2008 },
    { id: 'series-2', name: 'Game of Thrones', type: 'Series', tmdbId: 1399, posterPath: '/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg', year: 2011 },
    { id: 'series-3', name: 'The Sopranos', type: 'Series', tmdbId: 1398, posterPath: '/rTc7ZXdroqjkKivFPvCPX0Ru7uw.jpg', year: 1999 },
    { id: 'series-4', name: 'The Wire', type: 'Series', tmdbId: 1438, posterPath: '/4lbclFySvugI51fwsyxBTOm4DqK.jpg', year: 2002 },
    { id: 'series-5', name: 'Stranger Things', type: 'Series', tmdbId: 66732, posterPath: '/x2LSRK2Cm7MZhjluni1msVJ3wDF.jpg', year: 2016 },
    { id: 'series-6', name: 'The Office', type: 'Series', tmdbId: 2316, posterPath: '/qWnJzyZhyy74gjpSjIXWmuk0ifX.jpg', year: 2005 },
    { id: 'series-7', name: 'Friends', type: 'Series', tmdbId: 1668, posterPath: '/f496cm9enuEsZkSPzCwnTESEK5s.jpg', year: 1994 },
    { id: 'series-8', name: 'The Mandalorian', type: 'Series', tmdbId: 82856, posterPath: '/eU1i6eHXlzMOlEq0ku1Rzq7Y4wA.jpg', year: 2019 },
    { id: 'series-9', name: 'House of the Dragon', type: 'Series', tmdbId: 94997, posterPath: '/t9XkeE7HzOsdQcDDDapDYh8Rrmt.jpg', year: 2022 },
    { id: 'series-10', name: 'The Last of Us', type: 'Series', tmdbId: 100088, posterPath: '/dmo1WLKp2W5rS2rGEhU9CBnZQFz.jpg', year: 2023 },
    { id: 'series-11', name: 'Succession', type: 'Series', tmdbId: 76331, posterPath: '/7HW47XbkNQ5fiwQFYGWdw9gs144.jpg', year: 2018 },
    { id: 'series-12', name: 'The Bear', type: 'Series', tmdbId: 136315, posterPath: '/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg', year: 2022 },
    { id: 'series-13', name: 'Severance', type: 'Series', tmdbId: 95396, posterPath: '/lFf6DEhtrGqLNhJXFGQXU8q1Zm1.jpg', year: 2022 },
    { id: 'series-14', name: 'Better Call Saul', type: 'Series', tmdbId: 60059, posterPath: '/fC2HDm5t0kHl7mTm7jxMR31b7by.jpg', year: 2015 },
    { id: 'series-15', name: 'The Boys', type: 'Series', tmdbId: 76479, posterPath: '/stTEycfG9928HYGEISBFaG1ngjM.jpg', year: 2019 },
    { id: 'series-16', name: 'Peaky Blinders', type: 'Series', tmdbId: 60574, posterPath: '/vUUqzWa2LnHIVqkaKVlVGkVcZIW.jpg', year: 2013 },
    { id: 'series-17', name: 'The Crown', type: 'Series', tmdbId: 65494, posterPath: '/1M876KPjulVwppEpldhdc8V4o68.jpg', year: 2016 },
    { id: 'series-18', name: 'Dark', type: 'Series', tmdbId: 70523, posterPath: '/apbrbWs8M9lyOpJYU5WXrpFbk1M.jpg', year: 2017 },
    { id: 'series-19', name: 'Chernobyl', type: 'Series', tmdbId: 87108, posterPath: '/hlLXt2tOPT6RRnjiUmoxyG1LTFi.jpg', year: 2019 },
    { id: 'series-20', name: 'True Detective', type: 'Series', tmdbId: 46648, posterPath: '/aowr0hxSVP4E0mHmQXkfBcfPdP8.jpg', year: 2014 },
    { id: 'series-21', name: 'Fallout', type: 'Series', tmdbId: 106379, posterPath: '/AnsSKR9LuK0T9bAOcPVA3LZlKqs.jpg', year: 2024 },
    { id: 'series-22', name: 'Shogun', type: 'Series', tmdbId: 126308, posterPath: '/7ObQDCKa6UqWmITtj0dHLrPEX0u.jpg', year: 2024 },
    { id: 'series-23', name: 'The White Lotus', type: 'Series', tmdbId: 111803, posterPath: '/m7l1gWQOLfnKy1FuQ9VIp1sJG3M.jpg', year: 2021 },
    { id: 'series-24', name: 'Euphoria', type: 'Series', tmdbId: 85552, posterPath: '/3Q0hd3heuWwDWpwcDkhQOA6TYWI.jpg', year: 2019 },
    { id: 'series-25', name: 'Black Mirror', type: 'Series', tmdbId: 42009, posterPath: '/7PRddO7z7mF2sFOF3XEOenNYQ.jpg', year: 2011 },
    { id: 'series-26', name: 'Arcane', type: 'Series', tmdbId: 94605, posterPath: '/fqldf2t8ztc9aiwn3k6mlX3tvRT.jpg', year: 2021 },
    { id: 'series-27', name: 'Wednesday', type: 'Series', tmdbId: 119051, posterPath: '/9PFonBhy4cQy7Jz20NpMygczOkv.jpg', year: 2022 },
    { id: 'series-28', name: 'Beef', type: 'Series', tmdbId: 154521, posterPath: '/kbXe8OPjqGXYptkAfY6OHXHK7oQ.jpg', year: 2023 },
    { id: 'series-29', name: 'The Witcher', type: 'Series', tmdbId: 71912, posterPath: '/7vjaCdMw15FEbXyLQTVa04URsPm.jpg', year: 2019 },
    { id: 'series-30', name: 'Squid Game', type: 'Series', tmdbId: 93405, posterPath: '/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg', year: 2021 },
    { id: 'series-31', name: 'Money Heist', type: 'Series', tmdbId: 71446, posterPath: '/reEMJA1uzscCbkpeRJeTT2bjqUp.jpg', year: 2017 },
    { id: 'series-32', name: 'Ozark', type: 'Series', tmdbId: 69740, posterPath: '/m73bD8VjibBfieqUNPHAmLkLKnS.jpg', year: 2017 },
    { id: 'series-33', name: 'Fargo', type: 'Series', tmdbId: 60622, posterPath: '/6U9CPeD8obHzweikFhiLhpc7YBT.jpg', year: 2014 },
    { id: 'series-34', name: 'Mr. Robot', type: 'Series', tmdbId: 62560, posterPath: '/oKIBhzZzDX07SoE2bOLhq2EE8rf.jpg', year: 2015 },
    { id: 'series-35', name: 'Atlanta', type: 'Series', tmdbId: 65495, posterPath: '/8HLvTxOzRkg6X1cyDw4tBNMNtyV.jpg', year: 2016 },
];

// =============================================================================
// MOCK METADATA ENRICHMENT
// =============================================================================

const MOCK_GENRES = ['Action', 'Adventure', 'Comedy', 'Crime', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western'];
const MOCK_ACTORS = [
    'Tom Hanks', 'Leonardo DiCaprio', 'Brad Pitt', 'Margot Robbie', 'Scarlett Johansson',
    'Robert Downey Jr.', 'Chris Evans', 'Florence Pugh', 'Timothée Chalamet', 'Zendaya',
    'Cillian Murphy', 'Emily Blunt', 'Ryan Gosling', 'Emma Stone', 'Christian Bale'
];
const MOCK_DIRECTORS = [
    'Christopher Nolan', 'Denis Villeneuve', 'Quentin Tarantino', 'Martin Scorsese',
    'Steven Spielberg', 'Greta Gerwig', 'Jordan Peele', 'David Fincher', 'Wes Anderson'
];
const MOCK_SUMMARIES = [
    'An epic tale of heroism and sacrifice that will leave audiences breathless.',
    'A gripping psychological thriller that keeps you guessing until the very end.',
    'A heartwarming story about love, loss, and the power of human connection.',
    'An action-packed adventure set in a richly imagined world full of wonder.',
    'A thought-provoking exploration of complex themes told through stunning visuals.',
    'A masterpiece of storytelling that redefines what cinema can achieve.',
    'An unforgettable journey through time and space that challenges our understanding.',
    'A bold and innovative film that pushes the boundaries of the medium.',
];
const RESOLUTIONS = ['4K', '1080p', '720p', 'HDR', '4K HDR', 'Dolby Vision'];

function enrichWithMockMetadata(items: MockItem[]): MockItem[] {
    return items.map((item, index) => ({
        ...item,
        summary: MOCK_SUMMARIES[index % MOCK_SUMMARIES.length],
        rating: parseFloat((5.5 + (Math.random() * 4.5)).toFixed(1)), // 5.5 - 10.0
        genres: [
            MOCK_GENRES[index % MOCK_GENRES.length],
            MOCK_GENRES[(index + 3) % MOCK_GENRES.length],
            MOCK_GENRES[(index + 7) % MOCK_GENRES.length],
        ],
        actors: [
            MOCK_ACTORS[index % MOCK_ACTORS.length],
            MOCK_ACTORS[(index + 2) % MOCK_ACTORS.length],
            MOCK_ACTORS[(index + 5) % MOCK_ACTORS.length],
            MOCK_ACTORS[(index + 8) % MOCK_ACTORS.length],
            MOCK_ACTORS[(index + 11) % MOCK_ACTORS.length],
        ],
        directors: [MOCK_DIRECTORS[index % MOCK_DIRECTORS.length]],
        resolution: RESOLUTIONS[index % RESOLUTIONS.length],
    }));
}

// Enrich items with mock metadata
const ENRICHED_MOVIES = enrichWithMockMetadata(MOCK_MOVIES);
const ENRICHED_SERIES = enrichWithMockMetadata(MOCK_SERIES);

// Combine for all items
const ALL_ITEMS = [...ENRICHED_MOVIES, ...ENRICHED_SERIES];

// =============================================================================
// MOCK SESSIONS DATA
// =============================================================================

interface MockSession {
    Id: string;
    UserName: string;
    Client: string;
    DeviceName: string;
    DeviceId: string;
    NowPlayingItem: {
        Id: string;
        Name: string;
        Type: string;
        RunTimeTicks: number;
        SeriesName?: string;
        SeasonNumber?: number;
        EpisodeNumber?: number;
        // Jellyfin/Emby use ImageTags for images
        ImageTags?: { Primary?: string; Thumb?: string };
        BackdropImageTags?: string[];
    } | null;
    PlayState: {
        PositionTicks: number;
        IsPaused: boolean;
        IsMuted: boolean;
    };
    SupportsMediaControl: boolean;
    SupportsRemoteControl: boolean;
}

// Start with some active sessions
let mockSessions: MockSession[] = [
    {
        Id: 'session-1',
        UserName: 'Tom',
        Client: 'Jellyfin Web',
        DeviceName: 'Chrome Browser',
        DeviceId: 'device-1',
        NowPlayingItem: {
            Id: 'movie-1',
            Name: 'Dune: Part Two',
            Type: 'Movie',
            RunTimeTicks: 166 * 60 * 10000000,
            ImageTags: { Primary: 'primary-tag' },
            BackdropImageTags: ['backdrop-tag'],
        },
        PlayState: {
            PositionTicks: 75 * 60 * 10000000, // 45% through
            IsPaused: false,
            IsMuted: false,
        },
        SupportsMediaControl: true,
        SupportsRemoteControl: true,
    },
    {
        Id: 'session-2',
        UserName: 'Jane',
        Client: 'Jellyfin Android TV',
        DeviceName: 'Living Room TV',
        DeviceId: 'device-2',
        NowPlayingItem: {
            Id: 'series-1-s5e16',
            Name: 'Felina',
            Type: 'Episode',
            RunTimeTicks: 55 * 60 * 10000000,
            SeriesName: 'Breaking Bad',
            SeasonNumber: 5,
            EpisodeNumber: 16,
            ImageTags: { Primary: 'primary-tag' },
        },
        PlayState: {
            PositionTicks: 11 * 60 * 10000000, // 20% through
            IsPaused: false,
            IsMuted: false,
        },
        SupportsMediaControl: true,
        SupportsRemoteControl: true,
    },
    {
        Id: 'session-3',
        UserName: 'Bob',
        Client: 'Jellyfin iOS',
        DeviceName: 'iPhone 15 Pro',
        DeviceId: 'device-3',
        NowPlayingItem: {
            Id: 'movie-4',
            Name: 'Oppenheimer',
            Type: 'Movie',
            RunTimeTicks: 180 * 60 * 10000000,
            ImageTags: { Primary: 'primary-tag' },
            BackdropImageTags: ['backdrop-tag'],
        },
        PlayState: {
            PositionTicks: 90 * 60 * 10000000, // 50% paused
            IsPaused: true,
            IsMuted: false,
        },
        SupportsMediaControl: true,
        SupportsRemoteControl: true,
    },
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function findItem(id: string): MockItem | undefined {
    // Direct match first
    const directMatch = ALL_ITEMS.find(item => item.id === id);
    if (directMatch) return directMatch;

    // Fallback: episode IDs like 'series-1-s5e16' → try parent series 'series-1'
    const seriesMatch = id.match(/^(series-\d+)-s\d+e\d+$/);
    if (seriesMatch) {
        return ALL_ITEMS.find(item => item.id === seriesMatch[1]);
    }

    return undefined;
}

/**
 * Proxy image from TMDB CDN
 */
async function proxyTmdbImage(posterPath: string, width: number, res: Response): Promise<void> {
    const tmdbSize = width > 300 ? 'w500' : 'w300';
    const imageUrl = `https://image.tmdb.org/t/p/${tmdbSize}${posterPath}`;

    return new Promise((resolve, reject) => {
        https.get(imageUrl, (proxyRes) => {
            res.set('Content-Type', proxyRes.headers['content-type'] || 'image/jpeg');
            res.set('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
            proxyRes.pipe(res);
            proxyRes.on('end', resolve);
            proxyRes.on('error', reject);
        }).on('error', (err) => {
            console.error('[MOCK] Image proxy error:', err.message);
            res.status(500).send('Image proxy failed');
            reject(err);
        });
    });
}

// =============================================================================
// CREATE SERVER APPS
// =============================================================================

function createMediaServerApp(serverType: 'jellyfin' | 'emby') {
    const app = express();
    app.use(express.json());

    // Request logging
    app.use((req, _res, next) => {
        console.log(`[${serverType.toUpperCase()}] ${req.method} ${req.path}`);
        next();
    });

    // -------------------------------------------------------------------------
    // SYSTEM INFO (Connection Test)
    // -------------------------------------------------------------------------
    app.get('/System/Info', (_req, res) => {
        res.json({
            ServerName: `Mock ${serverType === 'jellyfin' ? 'Jellyfin' : 'Emby'} Server`,
            Version: serverType === 'jellyfin' ? '10.8.13' : '4.8.0.0',
            Id: MOCK_SERVER_ID,
            OperatingSystem: 'Linux',
            HasPendingRestart: false,
            CanSelfRestart: true,
            HasUpdateAvailable: false,
        });
    });

    // -------------------------------------------------------------------------
    // SESSIONS
    // -------------------------------------------------------------------------
    app.get('/Sessions', (_req, res) => {
        // Return sessions with NowPlayingItem
        res.json(mockSessions);
    });

    // Stop playback
    app.post('/Sessions/:sessionId/Playing/Stop', (req, res) => {
        const { sessionId } = req.params;
        const session = mockSessions.find(s => s.Id === sessionId);
        if (session) {
            session.NowPlayingItem = null;
            console.log(`[${serverType.toUpperCase()}] Stopped playback for session ${sessionId}`);
        }
        res.status(204).send();
    });

    // -------------------------------------------------------------------------
    // LIBRARY VIEWS
    // -------------------------------------------------------------------------
    app.get('/Users/:userId/Views', (_req, res) => {
        res.json({
            Items: [
                { Id: 'view-movies', Name: 'Movies', CollectionType: 'movies', Type: 'CollectionFolder' },
                { Id: 'view-tvshows', Name: 'TV Shows', CollectionType: 'tvshows', Type: 'CollectionFolder' },
            ],
            TotalRecordCount: 2,
        });
    });

    // -------------------------------------------------------------------------
    // LIBRARY ITEMS
    // -------------------------------------------------------------------------
    app.get('/Users/:userId/Items', (req, res) => {
        const parentId = req.query.parentId as string;
        let items: MockItem[] = [];

        if (parentId === 'view-movies') {
            items = ENRICHED_MOVIES;
        } else if (parentId === 'view-tvshows') {
            items = ENRICHED_SERIES;
        } else {
            items = ALL_ITEMS;
        }

        // Format for Jellyfin/Emby response with rich metadata
        const formattedItems = items.map(item => ({
            Id: item.id,
            Name: item.name,
            Type: item.type,
            ProductionYear: item.year,
            RunTimeTicks: item.runTimeTicks,
            ProviderIds: {
                Tmdb: String(item.tmdbId),
            },
            ImageTags: item.posterPath ? { Primary: 'primary' } : {},
            // Rich metadata for modal display
            Overview: item.summary,
            CommunityRating: item.rating,
            Genres: item.genres,
            MediaStreams: item.resolution ? [{ DisplayTitle: item.resolution, Type: 'Video' }] : [],
            People: [
                ...(item.directors || []).map(name => ({ Name: name, Type: 'Director' })),
                ...(item.actors || []).map(name => ({ Name: name, Type: 'Actor' })),
            ],
        }));

        res.json({
            Items: formattedItems,
            TotalRecordCount: formattedItems.length,
        });
    });

    // -------------------------------------------------------------------------
    // IMAGES (Proxy from TMDB)
    // -------------------------------------------------------------------------
    app.get('/Items/:itemId/Images/:imageType', async (req, res) => {
        const { itemId } = req.params;
        const width = parseInt(req.query.fillWidth as string) || parseInt(req.query.width as string) || 300;

        const item = findItem(itemId);
        if (!item || !item.posterPath) {
            // Return a placeholder SVG for items without posters
            const svg = `<svg width="${width}" height="${Math.round(width * 1.5)}" xmlns="http://www.w3.org/2000/svg">
                <rect fill="#1a1a2e" width="100%" height="100%"/>
                <text x="50%" y="50%" fill="#666" font-family="sans-serif" font-size="14" text-anchor="middle">${item?.name || 'No Image'}</text>
            </svg>`;
            res.type('image/svg+xml').send(svg);
            return;
        }

        try {
            await proxyTmdbImage(item.posterPath, width, res);
        } catch {
            res.status(500).send('Image proxy failed');
        }
    });

    // -------------------------------------------------------------------------
    // CONTROL ENDPOINTS (for testing)
    // -------------------------------------------------------------------------

    // Toggle session on/off
    app.post('/mock/toggle-session/:sessionId', (req, res) => {
        const { sessionId } = req.params;
        const sessionIndex = mockSessions.findIndex(s => s.Id === sessionId);

        if (sessionIndex >= 0) {
            // Toggle NowPlayingItem
            const session = mockSessions[sessionIndex];
            if (session.NowPlayingItem) {
                session.NowPlayingItem = null;
            } else {
                // Restore to default
                session.NowPlayingItem = {
                    Id: 'movie-1',
                    Name: 'Dune: Part Two',
                    Type: 'Movie',
                    RunTimeTicks: 166 * 60 * 10000000,
                };
            }
            res.json({ session, hasPlayback: !!session.NowPlayingItem });
        } else {
            res.status(404).json({ error: 'Session not found' });
        }
    });

    // View all sessions
    app.get('/mock/sessions', (_req, res) => {
        res.json(mockSessions);
    });

    // -------------------------------------------------------------------------
    // WEB UI (for "Open in" button testing)
    // -------------------------------------------------------------------------

    // Jellyfin/Emby web UI - returns a success page
    app.get('/web/index.html', (req, res) => {
        const itemId = req.query.id as string;
        const item = findItem(itemId);
        const serverName = serverType === 'jellyfin' ? 'Jellyfin' : 'Emby';
        const brandColor = serverType === 'jellyfin' ? '#9b59b6' : '#52b54b';

        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>${item?.name || 'Media'} - ${serverName}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }
        .container {
            text-align: center;
            padding: 3rem;
            background: rgba(255,255,255,0.05);
            border-radius: 1rem;
            border: 1px solid rgba(255,255,255,0.1);
            max-width: 500px;
        }
        .icon {
            width: 80px;
            height: 80px;
            background: ${brandColor};
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 1.5rem;
            font-size: 2rem;
        }
        h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
        .title { color: ${brandColor}; font-size: 1.25rem; margin-bottom: 1rem; }
        p { color: rgba(255,255,255,0.7); line-height: 1.6; }
        .badge {
            display: inline-block;
            background: ${brandColor}22;
            color: ${brandColor};
            padding: 0.25rem 0.75rem;
            border-radius: 1rem;
            font-size: 0.875rem;
            margin-top: 1rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">✓</div>
        <h1>Mock ${serverName} Web UI</h1>
        ${item ? `<div class="title">${item.name} (${item.year})</div>` : ''}
        <p>This is a mock endpoint to test the "Open in ${serverName}" button.</p>
        <p>In production, this would open the real ${serverName} web interface.</p>
        <div class="badge">Item ID: ${itemId || 'none'}</div>
    </div>
</body>
</html>`;
        res.type('html').send(html);
    });

    // Catch-all for debugging
    app.use((req, res) => {
        console.log(`[${serverType.toUpperCase()}] Unhandled: ${req.method} ${req.path}`);
        res.status(404).json({ error: 'Not found', path: req.path });
    });

    return app;
}

// =============================================================================
// WEBSOCKET SERVER MANAGEMENT
// =============================================================================

// Track connected WebSocket clients per server
const wsClients: { jellyfin: Set<WebSocket>; emby: Set<WebSocket> } = {
    jellyfin: new Set(),
    emby: new Set(),
};

/**
 * Broadcast session update to all connected clients
 */
function broadcastSessions(serverType: 'jellyfin' | 'emby'): void {
    const activeSessions = mockSessions.filter(s => s.NowPlayingItem !== null);
    const message = JSON.stringify({
        MessageType: 'Sessions',
        Data: activeSessions,
    });

    const clients = wsClients[serverType];
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });

    if (clients.size > 0) {
        console.log(`[${serverType.toUpperCase()}] Broadcast sessions to ${clients.size} client(s)`);
    }
}

/**
 * Setup WebSocket server for a given HTTP server
 */
function setupWebSocketServer(server: http.Server, serverType: 'jellyfin' | 'emby'): void {
    const wss = new WebSocketServer({ noServer: true });

    // Handle WebSocket upgrade
    server.on('upgrade', (request, socket, head) => {
        const url = new URL(request.url || '', `http://${request.headers.host}`);

        // Jellyfin uses /socket path, Emby uses root path
        // Accept both to match real API behavior
        const isJellyfinPath = url.pathname === '/socket';
        const isEmbyPath = url.pathname === '/' || url.pathname === '';

        if ((serverType === 'jellyfin' && isJellyfinPath) ||
            (serverType === 'emby' && isEmbyPath)) {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
            });
        } else {
            socket.destroy();
        }
    });

    wss.on('connection', (ws) => {
        console.log(`[${serverType.toUpperCase()}] WebSocket client connected`);
        wsClients[serverType].add(ws);

        // Send initial session data
        const activeSessions = mockSessions.filter(s => s.NowPlayingItem !== null);
        ws.send(JSON.stringify({
            MessageType: 'Sessions',
            Data: activeSessions,
        }));

        // Handle incoming messages
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                console.log(`[${serverType.toUpperCase()}] WS received: ${message.MessageType || 'unknown'}`);

                // Respond to keep-alive
                if (message.MessageType === 'KeepAlive') {
                    ws.send(JSON.stringify({ MessageType: 'KeepAlive' }));
                }
            } catch {
                // Ignore parse errors
            }
        });

        ws.on('close', () => {
            console.log(`[${serverType.toUpperCase()}] WebSocket client disconnected`);
            wsClients[serverType].delete(ws);
        });

        ws.on('error', (err) => {
            console.error(`[${serverType.toUpperCase()}] WebSocket error:`, err.message);
            wsClients[serverType].delete(ws);
        });
    });
}

// =============================================================================
// START SERVERS
// =============================================================================

const jellyfinApp = createMediaServerApp('jellyfin');
const embyApp = createMediaServerApp('emby');

// Add endpoint to trigger session broadcasts (for testing)
jellyfinApp.post('/mock/broadcast', (_req, res) => {
    broadcastSessions('jellyfin');
    res.json({ success: true, clients: wsClients.jellyfin.size });
});

embyApp.post('/mock/broadcast', (_req, res) => {
    broadcastSessions('emby');
    res.json({ success: true, clients: wsClients.emby.size });
});

// Update toggle-session to also broadcast
const originalToggleHandler = (serverType: 'jellyfin' | 'emby') => (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const sessionIndex = mockSessions.findIndex(s => s.Id === sessionId);

    if (sessionIndex >= 0) {
        const session = mockSessions[sessionIndex];
        if (session.NowPlayingItem) {
            session.NowPlayingItem = null;
        } else {
            session.NowPlayingItem = {
                Id: 'movie-1',
                Name: 'Dune: Part Two',
                Type: 'Movie',
                RunTimeTicks: 166 * 60 * 10000000,
            };
        }

        // Broadcast change via WebSocket
        if (WEBSOCKET_ENABLED) {
            broadcastSessions(serverType);
        }

        res.json({ session, hasPlayback: !!session.NowPlayingItem });
    } else {
        res.status(404).json({ error: 'Session not found' });
    }
};

// Override the toggle handlers
jellyfinApp.post('/mock/toggle-session/:sessionId', originalToggleHandler('jellyfin'));
embyApp.post('/mock/toggle-session/:sessionId', originalToggleHandler('emby'));

// Create HTTP servers
const jellyfinServer = http.createServer(jellyfinApp);
const embyServer = http.createServer(embyApp);

// Setup WebSocket if enabled
if (WEBSOCKET_ENABLED) {
    setupWebSocketServer(jellyfinServer, 'jellyfin');
    setupWebSocketServer(embyServer, 'emby');
}

// Start servers
jellyfinServer.listen(JELLYFIN_PORT, '0.0.0.0', () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  MOCK JELLYFIN SERVER RUNNING');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('  Configure in Framerr:');
    console.log(`    URL:      http://localhost:${JELLYFIN_PORT}`);
    console.log(`    API Key:  ${API_KEYS.jellyfin}`);
    console.log(`    User ID:  ${MOCK_USER_ID}`);
    console.log('');
    console.log(`  WebSocket:  ${WEBSOCKET_ENABLED ? '✅ ENABLED' : '❌ DISABLED (polling fallback mode)'}`);
    console.log('');
});

embyServer.listen(EMBY_PORT, '0.0.0.0', () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  MOCK EMBY SERVER RUNNING');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('  Configure in Framerr:');
    console.log(`    URL:      http://localhost:${EMBY_PORT}`);
    console.log(`    API Key:  ${API_KEYS.emby}`);
    console.log(`    User ID:  ${MOCK_USER_ID}`);
    console.log('');
    console.log(`  WebSocket:  ${WEBSOCKET_ENABLED ? '✅ ENABLED' : '❌ DISABLED (polling fallback mode)'}`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('  Library Stats:');
    console.log(`    - ${MOCK_MOVIES.length} Movies`);
    console.log(`    - ${MOCK_SERIES.length} TV Series`);
    console.log(`    - ${mockSessions.length} Active Sessions`);
    console.log('');
    console.log('  Mock Control Endpoints:');
    console.log(`    GET  http://localhost:${JELLYFIN_PORT}/mock/sessions`);
    console.log(`    POST http://localhost:${JELLYFIN_PORT}/mock/toggle-session/session-1`);
    console.log(`    POST http://localhost:${JELLYFIN_PORT}/mock/broadcast`);
    console.log('');
    console.log('  To test polling fallback (no WebSocket):');
    console.log('    npx tsx scripts/mock-media-stream-servers.ts --no-websocket');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('  Press Ctrl+C to stop');
    console.log('');
});

