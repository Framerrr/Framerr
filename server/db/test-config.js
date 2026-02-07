const { getSystemConfig, updateSystemConfig } = require('./systemConfig');
const { getUserConfig, updateUserConfig } = require('./userConfig');
const { createUser, deleteUser, listUsers } = require('./users');
const logger = require('../utils/logger');

async function testConfig() {
    logger.info('Testing Configuration Systems...');

    try {
        // 1. Test System Config
        logger.info('Testing System Config...');
        const sysConfig = await getSystemConfig();
        if (!sysConfig.server) throw new Error('Invalid system config structure');

        await updateSystemConfig({ server: { ...sysConfig.server, name: 'Test Server' } });
        const updatedSys = await getSystemConfig();
        if (updatedSys.server.name !== 'Test Server') throw new Error('System config update failed');
        logger.info('System Config Verified ✅');

        // 2. Test User Config Isolation
        logger.info('Testing User Isolation...');

        // Create two test users
        const user1 = await createUser({ username: 'user1', passwordHash: 'hash', group: 'user' });
        const user2 = await createUser({ username: 'user2', passwordHash: 'hash', group: 'user' });

        // Update user1 config
        await updateUserConfig(user1.id, { theme: { mode: 'dark' } });

        // Update user2 config
        await updateUserConfig(user2.id, { theme: { mode: 'light' } });

        // Verify isolation
        const config1 = await getUserConfig(user1.id);
        const config2 = await getUserConfig(user2.id);

        if (config1.theme.mode !== 'dark') throw new Error('User 1 config failed');
        if (config2.theme.mode !== 'light') throw new Error('User 2 config failed');
        if (config1.theme.mode === config2.theme.mode) throw new Error('Isolation failed - configs are identical');

        logger.info('User Isolation Verified ✅');

        // Cleanup
        await deleteUser(user1.id);
        await deleteUser(user2.id);

        logger.info('Config Systems Test Passed ✅');
    } catch (error) {
        logger.error('Config Test Failed ❌', { error: error.message });
        process.exit(1);
    }
}

testConfig();
