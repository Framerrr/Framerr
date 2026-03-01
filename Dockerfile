# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build frontend
RUN npm run build

# Stage 2: Production runtime
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    su-exec

WORKDIR /app

# Copy backend package files
COPY server/package*.json ./server/

# Install build dependencies, install npm packages (including devDeps for TypeScript)
# This ensures better-sqlite3 native module is compiled for the correct architecture
# Note: sharp uses prebuilt binaries with bundled libvips, no compilation needed
RUN apk add --no-cache --virtual .build-deps \
    python3 \
    make \
    g++ \
    && cd server \
    && npm ci \
    && apk del .build-deps

# Copy backend code
COPY server/ ./server/

# Copy TypeScript config and shared types for compilation
COPY tsconfig.base.json ./
COPY shared/ ./shared/

# Compile TypeScript to JavaScript
RUN cd server && npm run build

# Copy non-TypeScript files that aren't included in compilation
# - migrations folder for database migrations (0001 creates base schema)
# - public folder for default favicon files
# - assets folder for bundled system icons + icon catalog
RUN cp -r server/database/migrations server/dist/server/database/ && \
    cp -r server/public server/dist/server/ && \
    cp -r server/assets server/dist/server/

# Copy package.json to dist/server for require('./package.json') in compiled code
RUN cp server/package.json server/dist/server/

# Remove devDependencies after build to reduce image size
RUN cd server && npm prune --omit=dev

# Register CLI command (framerr reset-password -u <username>)
RUN cd server && npm link

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/dist ./dist

# Copy entrypoint script and convert to Unix line endings (fixes Windows CRLF issue)
COPY docker-entrypoint.sh /
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

# Create config directory
RUN mkdir -p /config

# Volumes
VOLUME ["/config"]

# Environment defaults
ENV NODE_ENV=production \
    PORT=3001 \
    PUID=0 \
    PGID=0 \
    TZ=UTC \
    DATA_DIR=/config

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use entrypoint for PUID/PGID support
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["dumb-init", "node", "server/dist/server/index.js"]

# Version and channel from build args (set by release workflow, defaults for local builds)
ARG APP_VERSION=dev
ARG FRAMERR_CHANNEL=dev
ENV FRAMERR_CHANNEL=${FRAMERR_CHANNEL}

# Labels
LABEL org.opencontainers.image.title="Framerr" \
    org.opencontainers.image.description="Modern homelab dashboard with iframe tabs - Organizr alternative" \
    org.opencontainers.image.authors="pickels23" \
    org.opencontainers.image.url="https://github.com/pickels23/framerr" \
    org.opencontainers.image.source="https://github.com/pickels23/framerr" \
    org.opencontainers.image.version="${APP_VERSION}"
