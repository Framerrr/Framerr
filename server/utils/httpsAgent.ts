import https from 'https';

/**
 * HTTPS Agent for handling self-signed certificates
 * 
 * This agent disables certificate validation to allow connections
 * to services with self-signed certificates (common in homelab environments).
 * 
 * WARNING: Only use in trusted local network environments.
 * For production with public internet, use proper CA certificates.
 */
export const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});
