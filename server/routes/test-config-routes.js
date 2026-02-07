const express = require('express');
const request = require('supertest');
const configRoutes = require('./config');
const { createUser, deleteUser } = require('../db/users');
const logger = require('../utils/logger');

// Mock app for testing
const app = express();
app.use(express.json());

// Mock auth middleware for testing
app.use((req, res, next) => {
    // Default to admin user for tests unless specified
    req.user = req.headers['x-test-user'] ? JSON.parse(req.headers['x-test-user']) : {
        id: 'test-admin-id',
        username: 'admin',
        group: 'admin'
    };
    next();
});

app.use('/api/config', configRoutes);

async function testConfigRoutes() {
    logger.info('Testing Config Routes...');

    try {
        // 1. Test System Config (Admin)
        logger.info('Testing GET /api/config/system (Admin)...');
        const sysRes = await request(app)
            .get('/api/config/system')
            .set('x-test-user', JSON.stringify({ id: 'admin', username: 'admin', group: 'admin' }));

        if (sysRes.status !== 200) throw new Error(`GET /system failed: ${sysRes.status}`);
        if (!sysRes.body.server) throw new Error('Invalid system config response');

        // 2. Test System Config (Non-Admin)
        logger.info('Testing GET /api/config/system (User)...');
        const forbiddenRes = await request(app)
            .get('/api/config/system')
            .set('x-test-user', JSON.stringify({ id: 'user', username: 'user', group: 'user' }));

        if (forbiddenRes.status !== 403) throw new Error(`Expected 403, got ${forbiddenRes.status}`);

        // 3. Test User Config
        logger.info('Testing GET /api/config/user...');
        // Create a real user for this test to ensure DB lookup works
        const user = await createUser({ username: 'route-test', passwordHash: 'hash', group: 'user' });

        const userRes = await request(app)
            .get('/api/config/user')
            .set('x-test-user', JSON.stringify({ id: user.id, username: user.username, group: 'user' }));

        if (userRes.status !== 200) throw new Error(`GET /user failed: ${userRes.status}`);
        if (!userRes.body.theme) throw new Error('Invalid user config response');

        // Cleanup
        await deleteUser(user.id);

        logger.info('Config Routes Test Passed ✅');
    } catch (error) {
        logger.error('Config Routes Test Failed ❌', { error: error.message });
        process.exit(1);
    }
}

testConfigRoutes();
