const { hasPermission } = require('./permissions');
const { getSystemConfig } = require('../db/systemConfig');
const logger = require('./logger');

async function testPermissions() {
    logger.info('Testing Permission System...');

    try {
        // Mock users
        const adminUser = { username: 'admin', group: 'admin' };
        const normalUser = { username: 'user', group: 'user' };
        const guestUser = { username: 'guest', group: 'guest' };

        // 1. Test Admin (Wildcard)
        if (!await hasPermission(adminUser, 'view_dashboard')) throw new Error('Admin should have view_dashboard');
        if (!await hasPermission(adminUser, 'random_permission')) throw new Error('Admin should have *');
        logger.info('Admin Permissions Verified ✅');

        // 2. Test User
        if (!await hasPermission(normalUser, 'view_dashboard')) throw new Error('User should have view_dashboard');
        if (await hasPermission(normalUser, 'manage_system')) throw new Error('User should NOT have manage_system');
        logger.info('User Permissions Verified ✅');

        // 3. Test Guest
        if (!await hasPermission(guestUser, 'view_dashboard')) throw new Error('Guest should have view_dashboard');
        if (await hasPermission(guestUser, 'manage_widgets')) throw new Error('Guest should NOT have manage_widgets');
        logger.info('Guest Permissions Verified ✅');

        logger.info('Permission System Test Passed ✅');
    } catch (error) {
        logger.error('Permission Test Failed ❌', { error: error.message });
        process.exit(1);
    }
}

testPermissions();
