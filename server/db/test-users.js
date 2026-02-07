const { createUser, listUsers, deleteUser } = require('./users');
const logger = require('../utils/logger');

async function testUsersDB() {
    logger.info('Testing Users DB...');

    try {
        // Cleanup existing test user if exists
        const users = await listUsers();
        const existing = users.find(u => u.username === 'testuser');
        if (existing) {
            await deleteUser(existing.id);
        }

        // Create user
        const user = await createUser({
            username: 'testuser',
            passwordHash: 'hash123',
            group: 'admin',
            preferences: { theme: 'light' }
        });

        if (user.username !== 'testuser' || user.group !== 'admin' || user.preferences.theme !== 'light') {
            throw new Error('User creation failed verification');
        }

        logger.info('User creation verified');

        // Clean up
        await deleteUser(user.id);
        logger.info('User deletion verified');

        logger.info('Users DB Test Passed ✅');
    } catch (error) {
        logger.error('Users DB Test Failed ❌', { error: error.message });
        process.exit(1);
    }
}

testUsersDB();
