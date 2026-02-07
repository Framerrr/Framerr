/**
 * Logger Test Script
 * 
 * Run this to see how the logger behaves in different environments:
 * 
 * Production mode:
 *   NODE_ENV=production node test-logger.js
 * 
 * Development mode (default):
 *   node test-logger.js
 * 
 * Debug mode:
 *   LOG_LEVEL=debug node test-logger.js
 */

const logger = require('./logger');

console.log('\n=== Testing Logger ===\n');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Log Level: ${process.env.LOG_LEVEL || 'info'}\n`);

// Test startup banner
logger.startup('Homelab Dashboard', {
    version: '0.1.0',
    port: 3001,
    env: process.env.NODE_ENV || 'development'
});

console.log('\n--- Testing log levels ---\n');

// Test each log level
logger.error('This is an error message', {
    error: 'Something went wrong',
    code: 'ERR_TEST'
});

logger.warn('This is a warning message', {
    reason: 'Deprecated API usage'
});

logger.info('This is an info message', {
    action: 'User logged in',
    username: 'admin'
});

logger.debug('This is a debug message', {
    details: 'Only visible with LOG_LEVEL=debug',
    data: { foo: 'bar' }
});

console.log('\n=== Test Complete ===\n');
