import { defineConfig, createLogger } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Custom Framerr-branded logger
const framerrLogger = createLogger('info', {
    prefix: '[Framerr]',
});

// Framerr branding plugin for dev server
function framerrBrandingPlugin() {
    return {
        name: 'framerr-branding',
        configureServer(server) {
            server.httpServer?.once('listening', () => {
                const address = server.httpServer?.address();
                const port = typeof address === 'object' ? address?.port : 5173;

                // Clear console and print branded banner
                console.clear();
                console.log('\x1b[36m%s\x1b[0m', `
  ╔═══════════════════════════════════════════════════╗
  ║                                                   ║
  ║   🎬  F R A M E R R   D E V   S E R V E R  🎬    ║
  ║                                                   ║
  ╚═══════════════════════════════════════════════════╝
`);
                console.log('\x1b[32m%s\x1b[0m', '  ✓ Frontend ready');
                console.log('\x1b[90m%s\x1b[0m', `    ➜ Local:   http://localhost:${port}/`);
                console.log('\x1b[90m%s\x1b[0m', '    ➜ Backend: http://localhost:3001/');
                console.log('');
                console.log('\x1b[33m%s\x1b[0m', '  📝 Watching for file changes...\n');
            });
        },
    };
}

export default defineConfig({
    plugins: [react(), framerrBrandingPlugin()],
    customLogger: framerrLogger,
    build: {
        sourcemap: process.env.NODE_ENV === 'development',
        minify: process.env.NODE_ENV === 'production' ? 'esbuild' : false,
        outDir: 'dist',
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@shared': path.resolve(__dirname, './shared'),
            '@widgets': path.resolve(__dirname, './src/widgets'),
            '@features': path.resolve(__dirname, './src/features'),
        },
    },
    server: {
        port: 5173,
        host: true, // Allow external access
        allowedHosts: true, // Allow all hosts (for reverse proxy support)
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
                secure: false,
            },
            // Favicon routes must go through backend for custom/default logic
            '/favicon': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            '/favicon-default': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/test/setup.ts',
    },
});
